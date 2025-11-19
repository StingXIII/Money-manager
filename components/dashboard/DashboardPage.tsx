
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Transaction, Account, Loan, PaymentSchedule, Category } from '../../types';
import Card from '../ui/Card';
import Spinner from '../ui/Spinner';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { useLanguage } from '../../contexts/LanguageContext';
import MonthSelector from '../ui/MonthSelector';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const { t } = useLanguage();
    const { selectedDate } = useDateFilter();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loans, setLoans] = useState<(Loan & { schedule: PaymentSchedule[] })[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Fetch transactions for the SELECTED month
                const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

                const transactionsQuery = query(
                    collection(db, `users/${user.uid}/transactions`),
                    where('date', '>=', Timestamp.fromDate(startOfMonth)),
                    where('date', '<=', Timestamp.fromDate(endOfMonth))
                );
                const transactionsSnapshot = await getDocs(transactionsQuery);
                const fetchedTransactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
                setTransactions(fetchedTransactions);

                // Fetch other data
                const accountsQuery = collection(db, `users/${user.uid}/accounts`);
                const accountsSnapshot = await getDocs(accountsQuery);
                setAccounts(accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
                
                const categoriesQuery = collection(db, `users/${user.uid}/categories`);
                const categoriesSnapshot = await getDocs(categoriesQuery);
                setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));

                const loansQuery = collection(db, `users/${user.uid}/loans`);
                const loansSnapshot = await getDocs(loansQuery);
                const fetchedLoans = await Promise.all(loansSnapshot.docs.map(async (loanDoc) => {
                    const loanData = { id: loanDoc.id, ...loanDoc.data() } as Loan;
                    const scheduleQuery = query(collection(db, `users/${user.uid}/loans/${loanData.id}/paymentSchedule`), where('isPaid', '==', false));
                    const scheduleSnapshot = await getDocs(scheduleQuery);
                    const schedule = scheduleSnapshot.docs.map(doc => ({...doc.data(), id: doc.id } as PaymentSchedule));
                    return { ...loanData, schedule };
                }));
                setLoans(fetchedLoans);

            } catch (error) {
                console.error("Error fetching dashboard data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, selectedDate]); // Re-fetch when date changes

    const dashboardSummary = useMemo(() => {
        // In: Monthly Income
        const monthlyIncome = transactions
            .filter(t => t.transactionType === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        // Out: Monthly Expense
        const monthlyExpense = transactions
            .filter(t => t.transactionType === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Tiền Thực tế (Actual Cash)
        const actualCash = accounts
            .filter(acc => ['bank', 'wallet', 'wallet_group'].includes(acc.type))
            .reduce((sum, acc) => sum + (acc.balance || 0), 0);
            
        // Nợ thẻ tín dụng (Credit Card Debt)
        const creditDebt = accounts
            .filter(acc => acc.type === 'credit')
            .reduce((sum, acc) => sum + (acc.currentDebt || 0), 0);
            
        // Tổng Nợ (Total Debt) now only includes credit card debt.
        const totalDebt = creditDebt;

        // Dự trù tiền tổng (Total Projected Cash)
        const projectedCash = actualCash - totalDebt;

        return {
            monthlyIncome,
            monthlyExpense,
            actualCash,
            totalDebt,
            projectedCash,
        };
    }, [transactions, accounts, loans]);
    
    const chartData = useMemo(() => {
        const parentCategories = categories.filter(c => c.parentId === null && c.type === 'expense');
        const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));
        
        // Virtual ID for grouping loan payments
        const DEBT_REPAYMENT_ID = 'debt-repayment-virtual';

        const expenseByParentCategory = transactions
            .filter(t => t.transactionType === 'expense')
            .reduce<Record<string, number>>((acc, t) => {
                if (t.categoryId) {
                    const category = categoryMap.get(t.categoryId);
                    if (category) {
                        const parentId = category.parentId || category.id;
                        acc[parentId] = (acc[parentId] || 0) + t.amount;
                    }
                } else {
                    // If a transaction is an expense but has no category, it's a Loan Repayment
                    acc[DEBT_REPAYMENT_ID] = (acc[DEBT_REPAYMENT_ID] || 0) + t.amount;
                }
                return acc;
            }, {});

        const data = parentCategories.map(pCat => ({
            name: pCat.name,
            value: expenseByParentCategory[pCat.id] || 0
        }));
        
        // Add Debt Repayment slice if there is data
        if (expenseByParentCategory[DEBT_REPAYMENT_ID] > 0) {
            data.push({
                name: 'Trả nợ (Vay)',
                value: expenseByParentCategory[DEBT_REPAYMENT_ID]
            });
        }

        return data.filter(d => d.value > 0);

    }, [transactions, categories]);

    const reminders = useMemo(() => {
        const now = new Date(); // Reminders are usually strictly about "Current/Future" status, so we keep `now` for logic or use `selectedDate` if we want to see what WAS due.
        // For UX, "Upcoming" usually implies real-time upcoming. 
        // However, if we are looking at a past month, "Upcoming" is weird.
        // Let's keep reminders strictly relative to Real Time for utility.
        
        const upcomingReminders: {text: string, date: Date}[] = [];

        // Credit card payments
        accounts.filter(a => a.type === 'credit' && a.statementDate && a.paymentDueDateOffset != null).forEach(acc => {
            const getStatementDay = (year: number, month: number) => {
                if (acc.statementDate === 'EOM') {
                    return new Date(year, month + 1, 0).getDate();
                }
                return parseInt(acc.statementDate as string, 10);
            };

            const currentMonthStatementDay = getStatementDay(now.getFullYear(), now.getMonth());
            if (isNaN(currentMonthStatementDay)) return;

            let relevantStatementDate: Date;
            if (now.getDate() > currentMonthStatementDay) {
                relevantStatementDate = new Date(now.getFullYear(), now.getMonth(), currentMonthStatementDay);
            } else {
                const lastMonthStatementDay = getStatementDay(now.getFullYear(), now.getMonth() - 1);
                relevantStatementDate = new Date(now.getFullYear(), now.getMonth() - 1, lastMonthStatementDay);
            }

            let paymentDueDate = new Date(relevantStatementDate);
            paymentDueDate.setDate(paymentDueDate.getDate() + acc.paymentDueDateOffset!);
            
            if (paymentDueDate < now) {
                relevantStatementDate.setMonth(relevantStatementDate.getMonth() + 1);
                const nextStatementDay = getStatementDay(relevantStatementDate.getFullYear(), relevantStatementDate.getMonth());
                relevantStatementDate.setDate(nextStatementDay);
                
                paymentDueDate = new Date(relevantStatementDate);
                paymentDueDate.setDate(paymentDueDate.getDate() + acc.paymentDueDateOffset!);
            }

            upcomingReminders.push({ text: `Payment for ${acc.name}`, date: paymentDueDate });
        });

        // Loan payments
        loans.forEach(loan => {
            const nextPayment = loan.schedule.sort((a,b) => a.paymentDate.toMillis() - b.paymentDate.toMillis())[0];
            if(nextPayment) {
                 upcomingReminders.push({ text: `Payment for ${loan.name}`, date: nextPayment.paymentDate.toDate() });
            }
        });
        
        return upcomingReminders.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);

    }, [accounts, loans]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943', '#795548', '#607D8B'];

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('nav_dashboard')}</h1>
                <MonthSelector />
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                <Card className="md:col-span-2 bg-green-100 dark:bg-green-900/50 border-l-4 border-green-500">
                    <h2 className="text-gray-600 dark:text-green-200">{t('dash_income')}</h2>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">{dashboardSummary.monthlyIncome.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </Card>
                <Card className="md:col-span-2 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500">
                    <h2 className="text-gray-600 dark:text-red-200">{t('dash_expense')}</h2>
                    <p className="text-3xl font-bold text-red-700 dark:text-red-300">{dashboardSummary.monthlyExpense.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </Card>
                 <Card className="md:col-span-2 bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500">
                    <h2 className="text-gray-600 dark:text-blue-200">{t('dash_real_money')}</h2>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{dashboardSummary.actualCash.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </Card>
                <Card className="md:col-span-3 bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500">
                    <h2 className="text-gray-600 dark:text-yellow-200">{t('dash_total_debt')}</h2>
                    <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{dashboardSummary.totalDebt.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </Card>
                 <Card className={`md:col-span-3 border-l-4 ${dashboardSummary.projectedCash >= 0 ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500' : 'bg-pink-100 dark:bg-pink-900/50 border-pink-500'}`}>
                    <h2 className={`text-gray-600 ${dashboardSummary.projectedCash >= 0 ? 'dark:text-indigo-200' : 'dark:text-pink-200'}`}>{t('dash_projected')}</h2>
                    <p className={`text-3xl font-bold ${dashboardSummary.projectedCash >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-pink-700 dark:text-pink-300'}`}>{dashboardSummary.projectedCash.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</p>
                </Card>
            </div>

            {/* Charts and Reminders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">{t('dash_expense_breakdown')} ({selectedDate.toLocaleDateString('en-US', {month: 'short'})})</h2>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value: number) => value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                  contentStyle={{ backgroundColor: theme === 'dark' ? '#334155' : '#fff', border: 'none', borderRadius: '0.5rem' }}
                                  labelStyle={{ color: theme === 'dark' ? '#cbd5e1' : '#1f2937' }}
                                />
                                <Legend wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#4b5563' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('dash_no_data')}</div>
                    )}
                </Card>
                <Card>
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">{t('dash_upcoming')}</h2>
                    {reminders.length > 0 ? (
                        <ul className="space-y-3">
                            {reminders.map((r, i) => (
                                <li key={i} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <span className="text-gray-800 dark:text-gray-200">{r.text}</span>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">{r.date.toLocaleDateString('en-GB')}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">{t('dash_no_upcoming')}</div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default DashboardPage;


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, addDoc, doc, writeBatch, Timestamp, query, orderBy, increment, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Card from '../ui/Card';
import { Account, Transaction, TransactionEndpoint, TransactionType, Category, Plan, Loan, PaymentSchedule } from '../../types';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useDateFilter } from '../../contexts/DateFilterContext';
import MonthSelector from '../ui/MonthSelector';
import { useLanguage } from '../../contexts/LanguageContext';

// Helpers
const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    return parseInt(rawValue, 10).toLocaleString('vi-VN');
};
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;

const initialFormState = {
    reason: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    transactionType: 'expense' as TransactionType,
    sourceId: '',
    sourceName: '',
    destinationId: '',
    destinationName: '',
    categoryId: '',
};

// Interface for the combined list items
interface PlannedItem {
    type: 'plan' | 'loan' | 'credit';
    id: string; // Plan ID or Schedule ID or Account ID
    date?: Date; // Schedule date for loans or Due Date for cards
    name: string;
    amount: number;
    raw: Plan | { loan: Loan, schedule: PaymentSchedule } | Account; // Original data
}

interface TransactionsPageProps {
    onNavigate?: (page: string) => void;
}

const TransactionsPage: React.FC<TransactionsPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const { selectedDate } = useDateFilter(); // Use global date state
    const { t, language } = useLanguage();
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loans, setLoans] = useState<(Loan & { schedule: PaymentSchedule[] })[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    // Tracking for special transaction types
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [linkedPlanId, setLinkedPlanId] = useState<string | null>(null);
    const [linkedLoanData, setLinkedLoanData] = useState<{ loanId: string, scheduleId: string, principal: number } | null>(null);
    
    // Delete Modal State
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Transaction Type Names for UI
    const TransactionTypeNames: Record<TransactionType, string> = {
        income: language === 'vi' ? 'Thu nhập' : 'Income',
        expense: language === 'vi' ? 'Chi tiêu' : 'Expense',
        transfer: language === 'vi' ? 'Chuyển khoản' : 'Transfer',
        payment: language === 'vi' ? 'Thanh toán' : 'Payment',
        cashback: 'Cashback',
    };

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const accQuery = collection(db, `users/${user.uid}/accounts`);
            const accSnapshot = await getDocs(accQuery);
            const fetchedAccounts = accSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            setAccounts(fetchedAccounts);
            
            const catQuery = collection(db, `users/${user.uid}/categories`);
            const catSnapshot = await getDocs(catQuery);
            const fetchedCategories = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
            setCategories(fetchedCategories);

            // Filter transactions: Fetch from Start of Selected Month until NOW (and future).
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            
            const transQuery = query(
                collection(db, `users/${user.uid}/transactions`), 
                where('date', '>=', Timestamp.fromDate(startOfMonth)),
                orderBy('date', 'desc')
            );
            
            const transSnapshot = await getDocs(transQuery);
            const fetchedTransactions = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(fetchedTransactions);

            const plansQuery = collection(db, `users/${user.uid}/plans`);
            const plansSnapshot = await getDocs(plansQuery);
            setPlans(plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan)));

            // Fetch Loans and their Schedules
            const loansQuery = collection(db, `users/${user.uid}/loans`);
            const loansSnapshot = await getDocs(loansQuery);
            const fetchedLoans = await Promise.all(loansSnapshot.docs.map(async (loanDoc) => {
                const loanData = { id: loanDoc.id, ...loanDoc.data() } as Loan;
                const scheduleQuery = collection(db, `users/${user.uid}/loans/${loanData.id}/paymentSchedule`);
                const scheduleSnapshot = await getDocs(scheduleQuery);
                const schedule = scheduleSnapshot.docs.map(doc => ({...doc.data(), id: doc.id } as PaymentSchedule));
                return { ...loanData, schedule };
            }));
            setLoans(fetchedLoans);

        } catch (err) {
            console.error(err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, [user, selectedDate]); 

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visibleTransactions = useMemo(() => {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
        
        return transactions.filter(t => {
            const d = t.date.toDate();
            return d >= startOfMonth && d <= endOfMonth;
        });
    }, [transactions, selectedDate]);

    const calculateDueDate = (account: Account) => {
        if (!account.statementDate || account.paymentDueDateOffset == null) return null;
        
        const viewYear = selectedDate.getFullYear();
        const viewMonth = selectedDate.getMonth();

        const getStatementDay = (month: number, year: number) => {
            if (account.statementDate === 'EOM') {
                return new Date(year, month + 1, 0).getDate();
            }
            return parseInt(account.statementDate as string, 10);
        };

        const statementDay = getStatementDay(viewMonth, viewYear);
        const statementDate = new Date(viewYear, viewMonth, statementDay);
        
        const dueDate = new Date(statementDate);
        dueDate.setDate(dueDate.getDate() + account.paymentDueDateOffset);
        return dueDate;
    };

    const combinedPlannedItems = useMemo<PlannedItem[]>(() => {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const selectedMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const selectedMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
        
        const isFutureOrCurrent = selectedMonthStart.getTime() >= currentMonthStart.getTime();

        const pendingPlans: PlannedItem[] = [];

        // 1. Recurring Plans
        if (isFutureOrCurrent) {
            pendingPlans.push(
                ...plans
                .filter(plan => !visibleTransactions.some(t => t.planId === plan.id))
                .map(plan => ({
                    type: 'plan' as const,
                    id: plan.id,
                    name: plan.name,
                    amount: plan.amount,
                    raw: plan
                }))
            );
        }

        // 2. Loan Payments
        const pendingLoans: PlannedItem[] = [];
        loans.forEach(loan => {
            loan.schedule.forEach(item => {
                const pDate = item.paymentDate.toDate();
                if (pDate.getMonth() === selectedDate.getMonth() && 
                    pDate.getFullYear() === selectedDate.getFullYear() && 
                    !item.isPaid) {
                    
                    pendingLoans.push({
                        type: 'loan' as const,
                        id: item.id,
                        date: pDate,
                        name: `Payment: ${loan.name}`,
                        amount: item.totalPayment,
                        raw: { loan, schedule: item }
                    });
                }
            });
        });

        // 3. Credit Card Debt
        const pendingCards: PlannedItem[] = [];
        accounts.filter(a => a.type === 'credit').forEach(card => {
             let debtAtStartOfMonth = card.currentDebt || 0;
             transactions.forEach(t => {
                 if (t.source.id === card.id && ['expense', 'transfer'].includes(t.transactionType)) {
                     debtAtStartOfMonth -= t.amount;
                 }
                 if (t.destination.id === card.id && ['payment', 'transfer', 'income'].includes(t.transactionType)) {
                     debtAtStartOfMonth += t.amount;
                 }
                 if (t.source.id === card.id && t.transactionType === 'cashback') {
                     debtAtStartOfMonth += t.amount;
                 }
             });
             const paymentsInSelectedMonth = transactions
                .filter(t => {
                    const d = t.date.toDate();
                    return d <= selectedMonthEnd && t.destination.id === card.id && t.transactionType === 'payment';
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
             const remainingPlanAmount = debtAtStartOfMonth - paymentsInSelectedMonth;
             if (remainingPlanAmount > 0) {
                 const dueDate = calculateDueDate(card);
                 pendingCards.push({
                     type: 'credit' as const,
                     id: card.id,
                     date: dueDate || undefined,
                     name: `Bill: ${card.name}`,
                     amount: remainingPlanAmount,
                     raw: card
                 });
             }
        });

        return [...pendingPlans, ...pendingLoans, ...pendingCards].sort((a, b) => {
            if (a.date && b.date) {
                return a.date.getTime() - b.date.getTime();
            }
            if (a.date) return -1;
            if (b.date) return 1;
            return 0;
        });

    }, [plans, loans, transactions, visibleTransactions, selectedDate, accounts]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'amount') {
             setFormData(prev => ({ ...prev, [name]: formatCurrencyInput(value)}));
             return;
        }

        if (name === 'sourceId' || name === 'destinationId') {
            const selectedAccount = accounts.find(acc => acc.id === value);
            const nameField = name === 'sourceId' ? 'sourceName' : 'destinationName';
            setFormData(prev => ({ ...prev, [name]: value, [nameField]: selectedAccount?.name || '' }));
            return;
        }

        if (name === 'transactionType') {
             setFormData(prev => ({ 
                 ...prev, 
                 transactionType: value as TransactionType,
                 sourceId: '', sourceName: '',
                 destinationId: '', destinationName: '',
                 categoryId: ''
             }));
             return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenModal = (txToEdit?: Transaction) => {
        setError('');
        setLinkedPlanId(null); 
        setLinkedLoanData(null);
        if (txToEdit) {
            setEditingTransactionId(txToEdit.id);
            setFormData({
                reason: txToEdit.reason,
                amount: txToEdit.amount.toLocaleString('vi-VN'),
                date: new Date(txToEdit.date.toMillis()).toISOString().split('T')[0],
                transactionType: txToEdit.transactionType,
                sourceId: txToEdit.source.id,
                sourceName: txToEdit.source.name,
                destinationId: txToEdit.destination.id,
                destinationName: txToEdit.destination.name,
                categoryId: txToEdit.categoryId || '',
            });
        } else {
            setEditingTransactionId(null);
            const now = new Date();
            let defaultDate = now.toISOString().split('T')[0];
            if (selectedDate.getMonth() !== now.getMonth() || selectedDate.getFullYear() !== now.getFullYear()) {
                 const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                 const offset = firstOfMonth.getTimezoneOffset();
                 const adjustedDate = new Date(firstOfMonth.getTime() - (offset*60*1000));
                 defaultDate = adjustedDate.toISOString().split('T')[0];
            }

            setFormData({
                ...initialFormState,
                date: defaultDate
            });
        }
        setIsModalOpen(true);
    };
    
    const handlePayItem = (item: PlannedItem) => {
        setError('');
        setEditingTransactionId(null);
        setLinkedPlanId(null);
        setLinkedLoanData(null);
        
        const defaultDate = new Date().toISOString().split('T')[0];

        if (item.type === 'plan') {
            const plan = item.raw as Plan;
            setLinkedPlanId(plan.id);
            setFormData({
                ...initialFormState,
                reason: plan.name,
                amount: plan.amount.toLocaleString('vi-VN'),
                transactionType: plan.type,
                categoryId: plan.categoryId,
                date: defaultDate
            });
        } else if (item.type === 'credit') {
            const card = item.raw as Account;
            setFormData({
                ...initialFormState,
                reason: `Payment for ${card.name}`,
                amount: item.amount.toLocaleString('vi-VN'), 
                transactionType: 'payment',
                destinationId: card.id,
                destinationName: card.name,
                date: defaultDate
            });
        } else {
            const { loan, schedule } = item.raw as { loan: Loan, schedule: PaymentSchedule };
            setLinkedLoanData({
                loanId: loan.id,
                scheduleId: schedule.id,
                principal: schedule.principal
            });
            
            setFormData({
                ...initialFormState,
                reason: `Loan Pay: ${loan.name} (Month ${schedule.id})`,
                amount: schedule.totalPayment.toLocaleString('vi-VN'),
                transactionType: 'expense',
                date: defaultDate,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTransactionId(null);
        setLinkedPlanId(null);
        setLinkedLoanData(null);
        setFormData(initialFormState);
        setError('');
    };

    const executeDelete = async () => {
        if (!user || !transactionToDelete) return;
        setIsDeleting(true);
        setError('');

        try {
            const batch = writeBatch(db);
            const txDocRef = doc(db, `users/${user.uid}/transactions`, transactionToDelete.id);
            batch.delete(txDocRef);

            const { source, destination, amount, transactionType } = transactionToDelete;

            if (source.id !== 'external') {
                const sourceAccRef = doc(db, `users/${user.uid}/accounts`, source.id);
                const sourceAccount = accounts.find(a => a.id === source.id);
                if (sourceAccount) { 
                    if (sourceAccount.type === 'credit') {
                        const debtIncrement = transactionType === 'cashback' ? amount : -amount;
                        batch.update(sourceAccRef, { currentDebt: increment(debtIncrement) });
                    } else {
                        batch.update(sourceAccRef, { balance: increment(amount) });
                    }
                }
            }

            if (destination.id !== 'external') {
                const destAccRef = doc(db, `users/${user.uid}/accounts`, destination.id);
                const destAccount = accounts.find(a => a.id === destination.id);
                if (destAccount) { 
                    if (destAccount.type === 'credit') {
                        batch.update(destAccRef, { currentDebt: increment(amount) });
                    } else {
                        batch.update(destAccRef, { balance: increment(-amount) });
                    }
                }
            }
            
            await batch.commit();
            setTransactionToDelete(null);
            await fetchData(); 
        } catch (err: any) {
            console.error("Failed to delete transaction:", err);
            setError(`Failed to delete transaction: ${err.message || 'Unknown error'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user || !formData.amount || !formData.reason) {
            return setError("Please fill in Reason and Amount.");
        }
        
        const { transactionType, sourceId, sourceName, destinationId, destinationName, categoryId } = formData;
        const amount = parseCurrency(formData.amount);

        if (['expense', 'transfer', 'payment'].includes(transactionType) && sourceId) {
             const sourceAccount = accounts.find(a => a.id === sourceId);
             if (sourceAccount && ['bank', 'wallet'].includes(sourceAccount.type)) {
                 let availableBalance = sourceAccount.balance || 0;
                 if (editingTransactionId) {
                     const originalTx = transactions.find(t => t.id === editingTransactionId);
                     if (originalTx && originalTx.source.id === sourceId) {
                         availableBalance += originalTx.amount;
                     }
                 }
                 if (amount > availableBalance) {
                     return setError(`Insufficient funds in ${sourceAccount.name}. Available: ${availableBalance.toLocaleString('vi-VN')} đ`);
                 }
             }
        }

        let source: TransactionEndpoint;
        let destination: TransactionEndpoint;

        switch (transactionType) {
            case 'income':
                if (!destinationId || !categoryId) return setError("Please select a destination account and category.");
                source = { id: 'external', name: sourceName || 'External Income' };
                destination = { id: destinationId, name: destinationName };
                break;
            case 'expense':
                if (!sourceId || (!categoryId && !linkedLoanData)) return setError("Please select a source account and category.");
                source = { id: sourceId, name: sourceName };
                destination = { id: 'external', name: destinationName || 'External Expense' };
                break;
            case 'payment':
                 if (!sourceId) return setError("Please select a source account.");
                 source = { id: sourceId, name: sourceName };
                 destination = { id: 'external', name: formData.destinationName || 'External Payment' };
                 if (destinationId && accounts.some(a => a.id === destinationId)) {
                     destination = { id: destinationId, name: destinationName };
                 }
                 break;
            case 'cashback':
                 if (!sourceId) return setError("Please select the credit card that earned the cashback.");
                 source = { id: sourceId, name: sourceName };
                 destination = { id: 'external', name: destinationName || 'Cashback Reward' };
                 break;
            case 'transfer':
                 if (!sourceId || !destinationId || sourceId === destinationId) return setError("Please select two different accounts for transfer.");
                 source = { id: sourceId, name: sourceName };
                 destination = { id: destinationId, name: destinationName };
                 break;
            default:
                return setError("Invalid transaction type.");
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const finalTransactionData: any = {
                reason: formData.reason,
                amount,
                transactionType,
                source,
                destination,
                date: Timestamp.fromDate(new Date(formData.date)),
                ...(categoryId && { categoryId }),
            };
            
            if (linkedPlanId) finalTransactionData.planId = linkedPlanId;
            
            if (editingTransactionId) {
                const originalTx = transactions.find(t => t.id === editingTransactionId);
                if (!originalTx) throw new Error("Original transaction not found for update.");

                if (originalTx.source.id !== 'external') {
                    const oldSourceAccRef = doc(db, `users/${user.uid}/accounts`, originalTx.source.id);
                    const isCredit = accounts.find(a => a.id === originalTx.source.id)?.type === 'credit';
                    if(isCredit) {
                         const debtIncrement = originalTx.transactionType === 'cashback' ? originalTx.amount : -originalTx.amount;
                         batch.update(oldSourceAccRef, { currentDebt: increment(debtIncrement) });
                    } else {
                         batch.update(oldSourceAccRef, { balance: increment(originalTx.amount) });
                    }
                }
                if (originalTx.destination.id !== 'external') {
                    const oldDestAccRef = doc(db, `users/${user.uid}/accounts`, originalTx.destination.id);
                    const isCredit = accounts.find(a => a.id === originalTx.destination.id)?.type === 'credit';
                    if(isCredit) {
                         batch.update(oldDestAccRef, { currentDebt: increment(originalTx.amount) });
                    } else {
                         batch.update(oldDestAccRef, { balance: increment(-originalTx.amount) });
                    }
                }
            }

            if (source.id !== 'external') {
                const sourceAccRef = doc(db, `users/${user.uid}/accounts`, source.id);
                const isCredit = accounts.find(a => a.id === source.id)?.type === 'credit';
                if (isCredit) {
                    batch.update(sourceAccRef, { currentDebt: increment(transactionType === 'cashback' ? -amount : amount) });
                } else {
                    batch.update(sourceAccRef, { balance: increment(-amount) });
                }
            }
            if (destination.id !== 'external') {
                const destAccRef = doc(db, `users/${user.uid}/accounts`, destination.id);
                const isCredit = accounts.find(a => a.id === destination.id)?.type === 'credit';
                if (isCredit) {
                    batch.update(destAccRef, { currentDebt: increment(-amount) });
                } else {
                    batch.update(destAccRef, { balance: increment(amount) });
                }
            }

            if (editingTransactionId) {
                const txDocRef = doc(db, `users/${user.uid}/transactions`, editingTransactionId);
                batch.update(txDocRef, finalTransactionData);
            } else {
                const newTransactionRef = doc(collection(db, `users/${user.uid}/transactions`));
                batch.set(newTransactionRef, finalTransactionData);
            }

            if (linkedLoanData && !editingTransactionId) {
                const scheduleDocRef = doc(db, `users/${user.uid}/loans/${linkedLoanData.loanId}/paymentSchedule`, linkedLoanData.scheduleId);
                batch.update(scheduleDocRef, { isPaid: true });
                const loanDocRef = doc(db, `users/${user.uid}/loans`, linkedLoanData.loanId);
                batch.update(loanDocRef, { remainingBalance: increment(-linkedLoanData.principal) });
            }

            await batch.commit();
            handleCloseModal();
            await fetchData();
        } catch (err) {
            console.error(err);
            setError("Failed to save transaction.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const accountOptions = useMemo(() => {
        const typeFilter = (types: Account['type'][]) => accounts.filter(a => types.includes(a.type));
        return {
            source: {
                expense: typeFilter(['bank', 'wallet', 'credit']),
                transfer: typeFilter(['bank', 'wallet']),
                payment: typeFilter(['bank', 'credit']),
                cashback: typeFilter(['credit']),
                bankOnly: typeFilter(['bank']),
            },
            destination: {
                income: typeFilter(['bank', 'wallet']),
                transfer: typeFilter(['bank', 'wallet']),
            }
        };
    }, [accounts]);
    
    const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
    const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);
    
    const renderSourceField = () => {
        const { transactionType, destinationId } = formData;
        if (transactionType === 'income') {
             return (
                 <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-300">From</label>
                    <input type="text" name="sourceName" value={formData.sourceName} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Salary, Gift" />
                </div>
            );
        }
        let options = accountOptions.source[transactionType as keyof typeof accountOptions.source] || [];
        if (transactionType === 'payment' && destinationId) {
            const isPayingCreditCard = accounts.some(a => a.id === destinationId && a.type === 'credit');
            if (isPayingCreditCard) options = accountOptions.source.bankOnly;
        }
        const label = transactionType === 'cashback' ? 'From Credit Card' : 'From Account';
        return (
             <div>
                <label className="block text-sm font-bold mb-2 dark:text-gray-300">{label}</label>
                <select name="sourceId" value={formData.sourceId} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required>
                    <option value="" disabled>Select Source</option>
                    {options.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
            </div>
        );
    };

    const renderDestinationField = () => {
        const { transactionType } = formData;
        if (['expense', 'cashback'].includes(transactionType)) {
            return (
                 <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-300">To</label>
                    <input type="text" name="destinationName" value={formData.destinationName} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Groceries, Rent" />
                </div>
            );
        }
        const options = accountOptions.destination[transactionType as keyof typeof accountOptions.destination] || [];
        const label = transactionType === 'payment' ? 'To Credit Card / Account' : 'To Account';
        const paymentDestOptions = transactionType === 'payment' 
            ? accounts.filter(a => ['credit', 'bank', 'wallet'].includes(a.type)) 
            : options;
        return (
             <div>
                <label className="block text-sm font-bold mb-2 dark:text-gray-300">{label}</label>
                <select name="destinationId" value={formData.destinationId} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required>
                    <option value="" disabled>Select Destination</option>
                    {paymentDestOptions.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
            </div>
        );
    };

    const renderCategoryField = () => {
        const { transactionType } = formData;
        if (['transfer', 'cashback'].includes(transactionType) || linkedLoanData || (transactionType === 'payment')) return null;
        const options = transactionType === 'income' ? incomeCategories : expenseCategories;
        return (
             <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2 dark:text-gray-300">Category</label>
                <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required>
                    <option value="" disabled>Select Category</option>
                    {options.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

    return (
        <div className="p-4 md:p-8 space-y-6 pb-20 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('trans_title')}</h1>
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    <MonthSelector />
                    <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">
                        {t('trans_new')}
                    </button>
                </div>
            </div>
            
             {/* Combined Planned Items Section */}
             {combinedPlannedItems.length > 0 && (
                <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
                        {t('trans_planned_for')} {selectedDate.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {month: 'long'})}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {combinedPlannedItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {item.date ? `Due: ${item.date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB')}` : 'Recurring'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-blue-600 dark:text-blue-400">{item.amount.toLocaleString('vi-VN')} đ</p>
                                    <button onClick={() => handlePayItem(item)} className="text-xs text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded mt-1">
                                        {t('btn_pay_now')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Mobile Transaction List */}
            <div className="md:hidden space-y-3">
                 {visibleTransactions.length > 0 ? visibleTransactions.map((t) => (
                     <div key={t.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 flex items-center justify-between" onClick={() => handleOpenModal(t)}>
                        <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-full ${t.transactionType === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                 {t.transactionType === 'income' ? 
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg> 
                                     : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                 }
                             </div>
                             <div>
                                 <p className="font-semibold text-gray-800 dark:text-gray-200">{t.reason}</p>
                                 <p className="text-xs text-gray-500 dark:text-gray-400">{t.date.toDate().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB')}</p>
                             </div>
                        </div>
                        <div className="text-right">
                            <p className={`font-bold ${t.transactionType === 'income' ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                {t.transactionType === 'income' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                            </p>
                            <p className="text-xs text-gray-400">{t.source.id !== 'external' ? t.source.name : t.destination.name}</p>
                        </div>
                     </div>
                 )) : (
                     <div className="text-center py-10 text-gray-500 dark:text-gray-400">{t('table_no_trans')}</div>
                 )}
            </div>

            {/* Desktop Transaction Table */}
            <Card className="hidden md:block">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('table_date')}</th>
                                <th scope="col" className="px-6 py-3">{t('table_reason')}</th>
                                <th scope="col" className="px-6 py-3">{t('table_type')}</th>
                                <th scope="col" className="px-6 py-3">{t('table_amount')}</th>
                                <th scope="col" className="px-6 py-3">{t('table_account')}</th>
                                <th scope="col" className="px-6 py-3">{t('table_action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTransactions.length > 0 ? visibleTransactions.map((t) => (
                                <tr key={t.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">{t.date.toDate().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB')}</td>
                                    <td className="px-6 py-4">{t.reason}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            t.transactionType === 'income' ? 'bg-green-100 text-green-800' : 
                                            t.transactionType === 'expense' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {TransactionTypeNames[t.transactionType]}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 font-bold ${t.transactionType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.transactionType === 'income' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.source.id !== 'external' ? t.source.name : t.destination.name}
                                    </td>
                                    <td className="px-6 py-4 flex space-x-2">
                                        <button onClick={() => handleOpenModal(t)} className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Edit</button>
                                        <button onClick={() => setTransactionToDelete(t)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('table_no_trans')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add/Edit Transaction Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTransactionId ? 'Edit Transaction' : 'New Transaction'}>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                             <label className="block text-sm font-bold mb-2 dark:text-gray-300">Transaction Type</label>
                             {/* If linked to loan, lock the type */}
                             {linkedLoanData ? (
                                 <div className="py-2 px-3 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200 font-semibold">Expense (Loan Payment)</div>
                             ) : linkedPlanId ? (
                                  <div className="py-2 px-3 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200 font-semibold capitalize">{formData.transactionType} (Planned)</div>
                             ) : (
                                 <select 
                                     name="transactionType"
                                     value={formData.transactionType} 
                                     onChange={handleInputChange}
                                     className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                 >
                                     <option value="expense">Expense</option>
                                     <option value="income">Income</option>
                                     <option value="transfer">Transfer</option>
                                     <option value="payment">Payment</option>
                                     <option value="cashback">Cashback</option>
                                 </select>
                             )}
                         </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Reason</label>
                            <input type="text" name="reason" value={formData.reason} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Amount</label>
                            <input type="text" inputMode="numeric" name="amount" value={formData.amount} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>

                        {renderSourceField()}
                        {renderDestinationField()}
                        {renderCategoryField()}

                    </div>
                    {error && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
                    <div className="mt-6 flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-blue-400 w-full md:w-auto">
                            {isSubmitting ? <Spinner /> : 'Save Transaction'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!transactionToDelete} onClose={() => setTransactionToDelete(null)} title="Delete Transaction">
                <div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Are you sure you want to delete this transaction? This will revert the balance/debt changes.
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setTransactionToDelete(null)} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">
                            Cancel
                        </button>
                        <button onClick={executeDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded flex items-center">
                            {isDeleting ? <Spinner className="h-4 w-4 mr-2"/> : null}
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TransactionsPage;

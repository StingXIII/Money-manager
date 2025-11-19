
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, Timestamp, increment, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Card from '../ui/Card';
import { Plan, Category, Account, TransactionEndpoint, Transaction } from '../../types';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    return parseInt(rawValue, 10).toLocaleString('vi-VN');
};
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;

const PlansPage: React.FC = () => {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]); // Fetch current month txs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Plan Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ 
        id: string | null; 
        name: string; 
        amount: string;
        type: 'expense' | 'income';
        categoryId: string;
    }>({
        id: null,
        name: '',
        amount: '',
        type: 'expense',
        categoryId: '',
    });

    // Delete state
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Credit Card Payment Modal State
    const [isPayCardModalOpen, setIsPayCardModalOpen] = useState(false);
    const [cardToPay, setCardToPay] = useState<Account | null>(null);
    const [payCardData, setPayCardData] = useState({
        sourceAccountId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const categoriesQuery = collection(db, `users/${user.uid}/categories`);
            const categoriesSnapshot = await getDocs(categoriesQuery);
            setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));

            const plansQuery = collection(db, `users/${user.uid}/plans`);
            const plansSnapshot = await getDocs(plansQuery);
            setPlans(plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan)));

            const accountsQuery = collection(db, `users/${user.uid}/accounts`);
            const accountsSnapshot = await getDocs(accountsQuery);
            setAccounts(accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));

            // Fetch transactions for Current Month to check credit card status
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const txQuery = query(
                collection(db, `users/${user.uid}/transactions`),
                where('date', '>=', Timestamp.fromDate(startOfMonth))
            );
            const txSnapshot = await getDocs(txQuery);
            setTransactions(txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));

        } catch (err) {
            console.error(err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Credit Card Logic ---
    const creditCardsWithDebt = useMemo(() => {
        return accounts.filter(acc => acc.type === 'credit');
    }, [accounts]);

    const calculateCardStatus = (card: Account) => {
        // Logic: Remaining Plan = Current Debt - Expenses This Month
        // If Result <= 0, it means we have paid off the Start-of-Month debt (and possibly more).
        const currentDebt = card.currentDebt || 0;
        
        // Expenses incurred on this card this month
        const expensesThisMonth = transactions
            .filter(t => t.source.id === card.id && ['expense', 'transfer'].includes(t.transactionType))
            .reduce((sum, t) => sum + t.amount, 0);
        
        const remainingObligation = currentDebt - expensesThisMonth;
        
        return {
            remainingObligation: Math.max(0, remainingObligation),
            isPaidOff: remainingObligation <= 0
        };
    };

    const calculateDueDate = (account: Account) => {
        if (!account.statementDate || account.paymentDueDateOffset == null) return null;
        
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const getStatementDay = (month: number, year: number) => {
            if (account.statementDate === 'EOM') {
                return new Date(year, month + 1, 0).getDate();
            }
            return parseInt(account.statementDate as string, 10);
        };

        // Determine if we are before or after this month's statement date
        const statementDay = getStatementDay(currentMonth, currentYear);
        
        let relevantStatementDate: Date;
        
        if (now.getDate() > statementDay) {
            relevantStatementDate = new Date(currentYear, currentMonth, statementDay);
        } else {
            const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
            const lastMonthStatementDay = getStatementDay(lastMonthDate.getMonth(), lastMonthDate.getFullYear());
            relevantStatementDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), lastMonthStatementDay);
        }

        const dueDate = new Date(relevantStatementDate);
        dueDate.setDate(dueDate.getDate() + account.paymentDueDateOffset);
        return dueDate;
    };

    const openPayCardModal = (card: Account, suggestedAmount: number) => {
        setCardToPay(card);
        setPayCardData({
            sourceAccountId: '',
            amount: suggestedAmount.toLocaleString('vi-VN'),
            date: new Date().toISOString().split('T')[0]
        });
        setIsPayCardModalOpen(true);
        setError('');
    };

    const handlePayCardSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !cardToPay || !payCardData.sourceAccountId || !payCardData.amount) {
            setError("Please select a source account and amount.");
            return;
        }
        
        setIsSubmitting(true);
        setError('');

        try {
            const amountVal = parseCurrency(payCardData.amount);
            const sourceAccount = accounts.find(a => a.id === payCardData.sourceAccountId);
            
            if (!sourceAccount) throw new Error("Source account not found");

            const batch = writeBatch(db);

            // 1. Create Transaction
            const transactionRef = doc(collection(db, `users/${user.uid}/transactions`));
            const transactionData = {
                reason: `Bill Payment: ${cardToPay.name}`,
                amount: amountVal,
                transactionType: 'payment',
                source: { id: sourceAccount.id, name: sourceAccount.name } as TransactionEndpoint,
                destination: { id: cardToPay.id, name: cardToPay.name } as TransactionEndpoint,
                date: Timestamp.fromDate(new Date(payCardData.date)),
                categoryId: '', // Payments usually don't have a category
            };
            batch.set(transactionRef, transactionData);

            // 2. Update Source Account (Deduct Balance)
            const sourceRef = doc(db, `users/${user.uid}/accounts`, sourceAccount.id);
            batch.update(sourceRef, { balance: increment(-amountVal) });

            // 3. Update Credit Card (Reduce Debt)
            const cardRef = doc(db, `users/${user.uid}/accounts`, cardToPay.id);
            batch.update(cardRef, { currentDebt: increment(-amountVal) });

            await batch.commit();
            
            setIsPayCardModalOpen(false);
            await fetchData(); // Refresh data to show updated debt

        } catch (err) {
            console.error(err);
            setError("Failed to process payment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Plan CRUD ---

    const openAddModal = () => {
        setModalData({ id: null, name: '', amount: '', type: 'expense', categoryId: '' });
        setIsModalOpen(true);
        setError('');
    };

    const openEditModal = (plan: Plan) => {
        setModalData({ 
            id: plan.id, 
            name: plan.name, 
            amount: plan.amount.toLocaleString('vi-VN'),
            type: plan.type,
            categoryId: plan.categoryId 
        });
        setIsModalOpen(true);
        setError('');
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !modalData.name || !modalData.amount || !modalData.categoryId) {
            setError("Please fill in all fields.");
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const payload = {
                name: modalData.name,
                amount: parseCurrency(modalData.amount),
                type: modalData.type,
                categoryId: modalData.categoryId
            };

            if (modalData.id) {
                // Update
                const docRef = doc(db, `users/${user.uid}/plans`, modalData.id);
                await updateDoc(docRef, payload);
            } else {
                // Add
                await addDoc(collection(db, `users/${user.uid}/plans`), payload);
            }
            setIsModalOpen(false);
            await fetchData();
        } catch (err) {
            console.error(err);
            setError("Failed to save plan.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const executeDelete = async () => {
        if (!user || !planToDelete) return;
        
        setIsDeleting(true);
        setError('');
        try {
            await deleteDoc(doc(db, `users/${user.uid}/plans`, planToDelete.id));
            setPlanToDelete(null);
            await fetchData();
        } catch(err) {
            console.error(err);
            setError("Failed to delete plan.");
        } finally {
            setIsDeleting(false);
        }
    }

    const renderCategoryOptions = () => {
        return categories
            .filter(c => c.type === modalData.type)
            .map(c => <option key={c.id} value={c.id}>{c.name}</option>);
    };
    
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('plans_title')}</h1>
            
            {/* Credit Card Repayment Section */}
            <section>
                 <div className="flex items-center mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full mr-3">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('plans_cc_repay')}</h2>
                </div>
                
                <Card className="border-l-4 border-red-500">
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-4 py-3">{t('table_card_name')}</th>
                                    <th scope="col" className="px-4 py-3">{t('table_curr_debt')}</th>
                                    <th scope="col" className="px-4 py-3">{t('table_due_date')}</th>
                                    <th scope="col" className="px-4 py-3">{t('table_statement')}</th>
                                    <th scope="col" className="px-4 py-3">{t('table_action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {creditCardsWithDebt.length > 0 ? creditCardsWithDebt.map(card => {
                                    const dueDate = calculateDueDate(card);
                                    const { remainingObligation, isPaidOff } = calculateCardStatus(card);
                                    
                                    // Hide if 0 debt and paid off
                                    if ((card.currentDebt || 0) === 0 && isPaidOff) return null;

                                    return (
                                        <tr key={card.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{card.name}</td>
                                            <td className="px-4 py-4 font-bold text-red-600 dark:text-red-400">{(card.currentDebt || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                            <td className="px-4 py-4">
                                                {dueDate ? (
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${dueDate < new Date() ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                        {dueDate.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB')}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                             <td className="px-4 py-4 text-gray-500">
                                                {card.statementDate === 'EOM' ? 'End of Month' : `Day ${card.statementDate}`} + {card.paymentDueDateOffset} days
                                            </td>
                                            <td className="px-4 py-4">
                                                {isPaidOff ? (
                                                    <button disabled className="bg-green-500 text-white text-xs font-bold py-2 px-4 rounded opacity-50 cursor-not-allowed">
                                                        {t('btn_done')}
                                                    </button>
                                                ) : (
                                                    <button onClick={() => openPayCardModal(card, remainingObligation)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded">
                                                        {t('btn_pay_bill')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                                            {t('plans_no_cc')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>

            {/* Monthly Plans Section */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mr-3">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('plans_monthly')}</h2>
                    </div>
                    <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                        {t('plans_add')}
                    </button>
                </div>
                
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('table_name')}</th>
                                    <th scope="col" className="px-6 py-3">{t('table_category')}</th>
                                    <th scope="col" className="px-6 py-3">{t('table_type')}</th>
                                    <th scope="col" className="px-6 py-3">{t('table_est_amount')}</th>
                                    <th scope="col" className="px-6 py-3">{t('table_action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.length > 0 ? plans.map(plan => (
                                    <tr key={plan.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{plan.name}</td>
                                        <td className="px-6 py-4">{getCategoryName(plan.categoryId)}</td>
                                        <td className="px-6 py-4 capitalize">{plan.type}</td>
                                        <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400">{plan.amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</td>
                                        <td className="px-6 py-4 space-x-3">
                                            <button onClick={() => openEditModal(plan)} className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Edit</button>
                                            <button onClick={() => setPlanToDelete(plan)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('plans_no_plans')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>

            {error && !isModalOpen && !isPayCardModalOpen && !planToDelete && <p className="text-red-500 text-center">{error}</p>}

            {/* Add/Edit Plan Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalData.id ? 'Edit Plan' : 'Add Plan'}>
                <form onSubmit={handleModalSubmit}>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Plan Name</label>
                            <input
                                type="text"
                                value={modalData.name}
                                onChange={(e) => setModalData(prev => ({ ...prev, name: e.target.value }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="e.g. Electricity Bill"
                                required
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-bold mb-2 dark:text-gray-300">Estimated Amount</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={modalData.amount}
                                onChange={(e) => setModalData(prev => ({ ...prev, amount: formatCurrencyInput(e.target.value) }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Type</label>
                            <select 
                                value={modalData.type}
                                onChange={(e) => setModalData(prev => ({ ...prev, type: e.target.value as 'expense' | 'income', categoryId: '' }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Category</label>
                            <select 
                                value={modalData.categoryId}
                                onChange={(e) => setModalData(prev => ({ ...prev, categoryId: e.target.value }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                required
                            >
                                <option value="" disabled>Select Category</option>
                                {renderCategoryOptions()}
                            </select>
                        </div>
                    </div>
                     {error && isModalOpen && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
                    <div className="mt-6 flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400">
                           {isSubmitting ? <Spinner/> : 'Save Plan'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Pay Credit Card Modal */}
            <Modal isOpen={isPayCardModalOpen} onClose={() => setIsPayCardModalOpen(false)} title="Pay Credit Card Bill">
                <form onSubmit={handlePayCardSubmit}>
                     <div className="p-3 mb-4 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                         <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Paying: {cardToPay?.name}</p>
                         <p className="text-xs text-yellow-700 dark:text-yellow-300">This will create a payment transaction and reduce your credit card debt.</p>
                     </div>

                     <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Pay From (Account)</label>
                            <select 
                                value={payCardData.sourceAccountId}
                                onChange={(e) => setPayCardData(prev => ({ ...prev, sourceAccountId: e.target.value }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                required
                            >
                                <option value="" disabled>Select Bank/Wallet</option>
                                {accounts.filter(a => ['bank', 'wallet'].includes(a.type)).map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance?.toLocaleString('vi-VN')} đ)</option>
                                ))}
                            </select>
                        </div>
                         <div>
                             <label className="block text-sm font-bold mb-2 dark:text-gray-300">Amount to Pay</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={payCardData.amount}
                                onChange={(e) => setPayCardData(prev => ({ ...prev, amount: formatCurrencyInput(e.target.value) }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                required
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-bold mb-2 dark:text-gray-300">Date</label>
                            <input
                                type="date"
                                value={payCardData.date}
                                onChange={(e) => setPayCardData(prev => ({ ...prev, date: e.target.value }))}
                                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                                required
                            />
                        </div>
                     </div>

                     {error && isPayCardModalOpen && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}

                     <div className="mt-6 flex justify-end space-x-3">
                         <button type="button" onClick={() => setIsPayCardModalOpen(false)} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-green-400">
                           {isSubmitting ? <Spinner/> : 'Confirm Payment'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!planToDelete} onClose={() => setPlanToDelete(null)} title="Delete Plan">
                <div>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        Are you sure you want to delete the plan <strong>{planToDelete?.name}</strong>?
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setPlanToDelete(null)} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">
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

export default PlansPage;

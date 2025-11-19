
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, query, orderBy, writeBatch, doc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Card from '../ui/Card';
import { Loan, PaymentSchedule, Account, LoanWithSchedule } from '../../types';
import Spinner from '../ui/Spinner';
import AddLoanModal from './AddLoanModal';
import LoanScheduleModal from './LoanScheduleModal';
import LoanPaymentModal from './LoanPaymentModal';
import EditScheduleItemModal from './EditScheduleItemModal';
import Modal from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

const LoansPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loans, setLoans] = useState<LoanWithSchedule[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
    const [loanToDelete, setLoanToDelete] = useState<LoanWithSchedule | null>(null);
    
    // Data for Modals
    const [selectedLoan, setSelectedLoan] = useState<LoanWithSchedule | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
    const [paymentToEdit, setPaymentToEdit] = useState<PaymentSchedule | null>(null);
    const [loanToEdit, setLoanToEdit] = useState<LoanWithSchedule | null>(null);
    // Holds the balance *before* the item being edited, for interest calculation
    const [previousBalanceForEdit, setPreviousBalanceForEdit] = useState<number>(0);
    // Holds the date of the *previous* payment (or start date) for Actual/365 calc
    const [previousDateForEdit, setPreviousDateForEdit] = useState<Date | null>(null);

    const fetchData = useCallback(async (isRefresh: boolean = false) => {
        if (!user) return;
        if (!isRefresh) setLoading(true);
        setError('');
        try {
            const loansPath = `users/${user.uid}/loans`;

            // Fetch accounts first
            const accQuery = collection(db, `users/${user.uid}/accounts`);
            const accSnapshot = await getDocs(accQuery);
            const fetchedAccounts = accSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            setAccounts(fetchedAccounts);

            // Fetch loans
            const loansQuery = query(collection(db, loansPath), orderBy('startDate', 'desc'));
            const loansSnapshot = await getDocs(loansQuery);
            
            if (loansSnapshot.empty) {
                setLoans([]);
            } else {
                const fetchedLoans = await Promise.all(loansSnapshot.docs.map(async (loanDoc) => {
                    const loanData = { id: loanDoc.id, ...loanDoc.data() } as Loan;
                    // Sort locally to ensure index order is correct for balance calculations
                    const scheduleQuery = query(collection(db, `${loansPath}/${loanData.id}/paymentSchedule`));
                    const scheduleSnapshot = await getDocs(scheduleQuery);
                    const schedule = scheduleSnapshot.docs
                        .map(doc => ({...doc.data(), id: doc.id } as PaymentSchedule))
                        .sort((a, b) => a.paymentDate.toMillis() - b.paymentDate.toMillis());
                    
                    return { ...loanData, schedule };
                }));
                setLoans(fetchedLoans);
            }
        } catch (err) {
            console.error("Error fetching loan data: ", err);
            setError("Failed to load loan data.");
        } finally {
            if (!isRefresh) setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Sync selectedLoan with loans list updates to ensure modal shows fresh data
    useEffect(() => {
        if (selectedLoan) {
            const updatedLoan = loans.find(l => l.id === selectedLoan.id);
            // Only update if reference changed or data is different
            if (updatedLoan && updatedLoan !== selectedLoan) {
                setSelectedLoan(updatedLoan);
            }
        }
    }, [loans, selectedLoan]);

    const handleOpenSchedule = (loan: LoanWithSchedule) => {
        setSelectedLoan(loan);
        setIsScheduleModalOpen(true);
    };
    
    const handleOpenPaymentModal = (loan: LoanWithSchedule, payment: PaymentSchedule) => {
        setSelectedLoan(loan);
        setSelectedPayment(payment);
        setIsPaymentModalOpen(true);
    };
    
    const handleOpenEditItemModal = (payment: PaymentSchedule) => {
        if (!selectedLoan) return;
        
        const currentIndex = selectedLoan.schedule.findIndex(item => item.id === payment.id);
        let prevBalance = 0;
        let prevDate = selectedLoan.startDate.toDate(); // Default to loan start date

        if (currentIndex === 0) {
            prevBalance = selectedLoan.totalAmount;
            prevDate = selectedLoan.startDate.toDate();
        } else if (currentIndex > 0) {
            const prevItem = selectedLoan.schedule[currentIndex - 1];
            
            // Set Previous Balance
            if (prevItem.remainingBalance !== undefined) {
                prevBalance = prevItem.remainingBalance;
            } else {
                // Fallback calculation for legacy data
                const principalPaidSoFar = selectedLoan.schedule
                    .slice(0, currentIndex)
                    .reduce((sum, item) => sum + item.principal, 0);
                prevBalance = selectedLoan.totalAmount - principalPaidSoFar;
            }

            // Set Previous Date
            prevDate = prevItem.paymentDate.toDate();
        }

        setPreviousBalanceForEdit(prevBalance);
        setPreviousDateForEdit(prevDate);
        setPaymentToEdit(payment);
        setIsEditItemModalOpen(true);
    }

    const handleOpenEditModal = (loan: LoanWithSchedule) => {
        setLoanToEdit(loan);
        setIsAddModalOpen(true);
    };

    const promptDeleteLoan = (loan: LoanWithSchedule) => {
        setLoanToDelete(loan);
    };

    const handleDeleteLoan = async () => {
        if (!user || !loanToDelete) return;
        
        const loanId = loanToDelete.id;
        setDeletingId(loanId);
        setLoanToDelete(null); // Close modal immediately
        setError('');

        try {
            const loanPath = `users/${user.uid}/loans/${loanId}`;
            
            // 1. Get all schedule items first
            const scheduleCollectionRef = collection(db, `${loanPath}/paymentSchedule`);
            const scheduleSnapshot = await getDocs(scheduleCollectionRef);

            // 2. Create Batches (Firestore limit is 500 ops per batch)
            const batchSize = 400;
            let currentBatch = writeBatch(db);
            let batchCount = 0;
            const batches = [];

            // Add schedule deletions to batch
            scheduleSnapshot.docs.forEach(doc => {
                currentBatch.delete(doc.ref);
                batchCount++;
                if (batchCount >= batchSize) {
                    batches.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    batchCount = 0;
                }
            });

            // Add loan document deletion to batch
            const loanDocRef = doc(db, loanPath);
            currentBatch.delete(loanDocRef);
            batchCount++;

            // Commit final batch
            if (batchCount > 0) {
                batches.push(currentBatch.commit());
            }

            // Wait for all batches to complete
            await Promise.all(batches);
            
            // Optimistically remove from UI
            setLoans(prev => prev.filter(l => l.id !== loanId));
            
            fetchData(true);
        } catch (err: any) {
            console.error("Error deleting loan: ", err);
            setError(`Failed to delete the loan: ${err.message || 'Please try again.'}`);
            fetchData(true); 
        } finally {
            setDeletingId(null);
        }
    };
    
    const handleMarkAsPaid = async () => {
        if (!user || !selectedLoan || !selectedPayment) return;
        
        try {
            const batch = writeBatch(db);

            // 1. Update Payment Schedule Item
            const scheduleDocRef = doc(db, `users/${user.uid}/loans/${selectedLoan.id}/paymentSchedule`, selectedPayment.id);
            batch.update(scheduleDocRef, { isPaid: true });

            // 2. Update Loan Remaining Balance
            const loanDocRef = doc(db, `users/${user.uid}/loans`, selectedLoan.id);
            batch.update(loanDocRef, { remainingBalance: increment(-selectedPayment.principal) });

            await batch.commit();

            // Optimistic Update: Update local state immediately so UI reflects change without waiting for fetch
            const updatedSchedule = selectedLoan.schedule.map(item => 
                item.id === selectedPayment.id ? { ...item, isPaid: true } : item
            );
            const updatedLoan = { 
                ...selectedLoan, 
                schedule: updatedSchedule, 
                remainingBalance: selectedLoan.remainingBalance - selectedPayment.principal 
            };

            setSelectedLoan(updatedLoan);
            setLoans(prev => prev.map(l => l.id === selectedLoan.id ? updatedLoan : l));

            setIsPaymentModalOpen(false);
            // fetchData(true); // Optional: Re-sync in background if needed
        } catch(err) {
            console.error(err);
            setError("Failed to mark as paid. Please try again.");
            fetchData(true); // Revert on error
        }
    };

    const handleUpdateScheduleItem = async (updatedItem: PaymentSchedule, applyRateToFuture: boolean) => {
        if (!user || !selectedLoan) return;
        try {
            const batch = writeBatch(db);
            
            // 1. Identify the index of the updated item
            const currentIndex = selectedLoan.schedule.findIndex(item => item.id === updatedItem.id);
            if (currentIndex === -1) return;

            // 2. Calculate Remaining Balance for the updated item
            // The modal gives us Principal, Interest, Total, Date, Rate. 
            // We must calculate the remaining balance based on (Previous Balance - New Principal)
            const newRemainingBalanceForCurrent = previousBalanceForEdit - updatedItem.principal;
            
            const fullyUpdatedItem = {
                ...updatedItem,
                remainingBalance: newRemainingBalanceForCurrent
            };

            // Update current item in batch
            const currentItemRef = doc(db, `users/${user.uid}/loans/${selectedLoan.id}/paymentSchedule`, updatedItem.id);
            batch.update(currentItemRef, {
                paymentDate: fullyUpdatedItem.paymentDate,
                principal: fullyUpdatedItem.principal,
                interest: fullyUpdatedItem.interest,
                totalPayment: fullyUpdatedItem.totalPayment,
                interestRateSnapshot: fullyUpdatedItem.interestRateSnapshot,
                remainingBalance: fullyUpdatedItem.remainingBalance
            });

            // 3. Cascade Logic: Recalculate future items
            // We need to clone the schedule to calculate sequentially
            const newSchedule = [...selectedLoan.schedule];
            newSchedule[currentIndex] = fullyUpdatedItem;

            let runningBalance = fullyUpdatedItem.remainingBalance;
            let previousDateObj = fullyUpdatedItem.paymentDate.toDate();
            const newRate = fullyUpdatedItem.interestRateSnapshot;

            for (let i = currentIndex + 1; i < newSchedule.length; i++) {
                const item = newSchedule[i];
                const updates: any = {};
                
                // 3a. Update Rate if requested
                if (applyRateToFuture && newRate !== undefined) {
                    updates.interestRateSnapshot = newRate;
                    // Update local object for calculation
                    item.interestRateSnapshot = newRate; 
                }

                // 3b. Recalculate Interest
                // Inputs: runningBalance (prev remaining), new rate, actual days
                const rateToUse = item.interestRateSnapshot || selectedLoan.interestRate;
                const currentDateObj = item.paymentDate.toDate();
                
                const diffTime = Math.abs(currentDateObj.getTime() - previousDateObj.getTime());
                const actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Formula: PrevBalance * Rate% * Days / 365
                const newInterest = Math.round(runningBalance * (rateToUse / 100) * actualDays / 365);
                
                // 3c. Recalculate Total & Remaining
                // We preserve the Principal set in the schedule (unless it's the very last one and we want to zero out, but simple cascade is safer)
                const newTotal = item.principal + newInterest;
                const newRemaining = runningBalance - item.principal;

                updates.interest = newInterest;
                updates.totalPayment = newTotal;
                updates.remainingBalance = newRemaining;

                // Add to batch
                const nextItemRef = doc(db, `users/${user.uid}/loans/${selectedLoan.id}/paymentSchedule`, item.id);
                batch.update(nextItemRef, updates);

                // Update local array for next iteration
                newSchedule[i] = { ...item, ...updates };
                
                // Update cursors
                runningBalance = newRemaining;
                previousDateObj = currentDateObj;
            }

            // 4. Commit Batch
            await batch.commit();

            // 5. Optimistic Update
            const updatedLoan = { ...selectedLoan, schedule: newSchedule };
            setSelectedLoan(updatedLoan);
            setLoans(prevLoans => prevLoans.map(l => l.id === selectedLoan.id ? updatedLoan : l));

        } catch (err) {
            console.error("Error updating schedule item:", err);
            throw err;
        }
    };


    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('loan_title')}</h1>
                <button onClick={() => { setLoanToEdit(null); setIsAddModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                    {t('loan_add')}
                </button>
            </div>

            {error && <p className="text-red-500 text-center bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}

            {loans.length === 0 && !loading ? (
                 <Card className="text-center py-10">
                    <p className="text-gray-500 dark:text-gray-400">{t('loan_no_loans')}</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loans.map(loan => {
                        const paidAmount = loan.totalAmount - loan.remainingBalance;
                        const progress = loan.totalAmount > 0 ? (paidAmount / loan.totalAmount) * 100 : 0;
                        const startDate = loan.startDate.toDate();
                        // Calculate accurate maturity date
                        const endDate = new Date(startDate);
                        endDate.setMonth(endDate.getMonth() + loan.termMonths);

                        return (
                             <Card key={loan.id} className="flex flex-col justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{loan.name}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('loan_from')}: {loan.fromAccountName}</p>

                                    <div className="my-4">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-base font-medium text-blue-700 dark:text-blue-400">{paidAmount.toLocaleString('vi-VN', {style:'currency', currency:'VND'})}</span>
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{loan.totalAmount.toLocaleString('vi-VN', {style:'currency', currency:'VND'})}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                                        </div>
                                         <p className="text-right text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {t('loan_remaining')}: {loan.remainingBalance.toLocaleString('vi-VN', {style:'currency', currency:'VND'})}
                                         </p>
                                    </div>

                                    <div className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                                        <p><strong>{t('loan_interest')}:</strong> {loan.interestRate}% / year</p>
                                        <p><strong>{t('loan_term')}:</strong> {loan.termMonths} months</p>
                                        <p><strong>{t('loan_period')}:</strong> {startDate.toLocaleDateString('en-GB')} - {endDate.toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center space-x-2">
                                    <button onClick={() => handleOpenSchedule(loan)} className="flex-grow bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">
                                        {t('loan_view_schedule')}
                                    </button>
                                    <button onClick={() => handleOpenEditModal(loan)} disabled={!!deletingId} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Edit Loan">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    </button>
                                    <button onClick={() => promptDeleteLoan(loan)} disabled={!!deletingId} className="p-2 text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Delete Loan">
                                        {deletingId === loan.id ? <Spinner className="h-5 w-5" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
                                    </button>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
            
            <AddLoanModal 
                isOpen={isAddModalOpen} 
                onClose={() => {
                    setIsAddModalOpen(false);
                    setLoanToEdit(null);
                }}
                onSuccess={() => fetchData(true)}
                accounts={accounts}
                loanToEdit={loanToEdit}
            />

            {selectedLoan && (
                <LoanScheduleModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    loan={selectedLoan}
                    onMarkAsPaid={handleOpenPaymentModal}
                    onEdit={handleOpenEditItemModal}
                />
            )}

            {selectedLoan && selectedPayment && (
                 <LoanPaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    payment={selectedPayment}
                    onConfirm={handleMarkAsPaid}
                />
            )}
            
            {paymentToEdit && (
                <EditScheduleItemModal
                    isOpen={isEditItemModalOpen}
                    onClose={() => setIsEditItemModalOpen(false)}
                    item={paymentToEdit}
                    previousBalance={previousBalanceForEdit}
                    previousDate={previousDateForEdit}
                    onSave={handleUpdateScheduleItem}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!loanToDelete} onClose={() => setLoanToDelete(null)} title={t('loan_delete_confirm_title')}>
                <div className="space-y-4">
                     <p className="dark:text-gray-300">
                        {t('loan_delete_confirm_msg')} <strong>{loanToDelete?.name}</strong>? 
                        <br/>
                        {t('loan_delete_confirm_msg_2')}
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setLoanToDelete(null)} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">
                            {t('form_cancel')}
                        </button>
                        <button onClick={handleDeleteLoan} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                            {t('loan_delete')}
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default LoansPage;

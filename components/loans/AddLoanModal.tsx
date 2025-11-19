
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, writeBatch, doc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Account, Loan, PaymentSchedule, LoanWithSchedule } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddLoanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accounts: Account[];
    loanToEdit?: LoanWithSchedule | null;
}

const initialFormState = {
    name: '',
    fromAccountId: '',
    totalAmount: '',
    monthlyPrincipal: '', // New field for custom principal
    interestRate: '',
    termMonths: '',
    startDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    firstPaymentDate: '', // New field for specific payment date
};

// Helpers
const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    return parseInt(rawValue, 10).toLocaleString('vi-VN');
};
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;

// Parse date input string (YYYY-MM-DD) as Local Time 00:00:00
const parseDateInputAsLocal = (dateString: string) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const AddLoanModal: React.FC<AddLoanModalProps> = ({ isOpen, onClose, onSuccess, accounts, loanToEdit }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [formData, setFormData] = useState(initialFormState);
    const [remainingBalanceForEdit, setRemainingBalanceForEdit] = useState(''); // Only used when editing
    const [isManualPrincipal, setIsManualPrincipal] = useState(false); // Track if user manually edited principal
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && loanToEdit) {
            // Try to find the first payment date from the existing schedule
            let firstPayment = '';
            if (loanToEdit.schedule && loanToEdit.schedule.length > 0) {
                // Sort just in case, though usually sorted by fetching logic
                const sortedSchedule = [...loanToEdit.schedule].sort((a,b) => a.paymentDate.toMillis() - b.paymentDate.toMillis());
                firstPayment = new Date(sortedSchedule[0].paymentDate.toMillis()).toISOString().split('T')[0];
            }

            setFormData({
                name: loanToEdit.name,
                fromAccountId: loanToEdit.fromAccountId,
                totalAmount: loanToEdit.totalAmount.toLocaleString('vi-VN'),
                monthlyPrincipal: '', 
                interestRate: String(loanToEdit.interestRate),
                termMonths: String(loanToEdit.termMonths),
                startDate: new Date(loanToEdit.startDate.toMillis()).toISOString().split('T')[0],
                firstPaymentDate: firstPayment,
            });
            setRemainingBalanceForEdit(loanToEdit.remainingBalance.toLocaleString('vi-VN'));
            setIsManualPrincipal(true); 
        } else if (isOpen && !loanToEdit) {
            // Default first payment date to 1 month after current date
            const today = new Date();
            const nextMonth = new Date(today);
            nextMonth.setMonth(today.getMonth() + 1);
            
            setFormData({
                ...initialFormState,
                startDate: today.toISOString().split('T')[0],
                firstPaymentDate: nextMonth.toISOString().split('T')[0]
            }); 
            setRemainingBalanceForEdit('');
            setIsManualPrincipal(false);
        }
    }, [isOpen, loanToEdit]);

    // Auto-calculate monthly principal if not manually set
    useEffect(() => {
        if (!isOpen || isManualPrincipal || loanToEdit) return;

        const total = parseCurrency(formData.totalAmount);
        const term = parseInt(formData.termMonths, 10);

        if (total > 0 && term > 0) {
            const calculated = Math.floor(total / term);
            setFormData(prev => ({
                ...prev,
                monthlyPrincipal: calculated.toLocaleString('vi-VN')
            }));
        }
    }, [formData.totalAmount, formData.termMonths, isManualPrincipal, isOpen, loanToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'monthlyPrincipal') {
            setIsManualPrincipal(true); // User is taking control
            setFormData(prev => ({ ...prev, [name]: formatCurrencyInput(value)}));
        } else if (name === 'totalAmount') {
             setFormData(prev => ({ ...prev, [name]: formatCurrencyInput(value)}));
        } else if (name === 'remainingBalance') {
             setRemainingBalanceForEdit(formatCurrencyInput(value));
        } else {
             setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const endDateDisplay = useMemo(() => {
        if (!formData.startDate || !formData.termMonths) return '---';
        const start = parseDateInputAsLocal(formData.startDate);
        const term = parseInt(formData.termMonths, 10);
        if (isNaN(term)) return '---';
        
        // Maturity Date logic: Start Date + Term Months
        start.setMonth(start.getMonth() + term);
        return start.toLocaleDateString('en-GB'); // dd/mm/yyyy
    }, [formData.startDate, formData.termMonths]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!user) return;

        const { name, fromAccountId, interestRate, termMonths, startDate, firstPaymentDate } = formData;
        const totalAmount = parseCurrency(formData.totalAmount);
        const monthlyPrincipalInput = parseCurrency(formData.monthlyPrincipal);
        
        // If editing, use the visible input. If new, default to totalAmount.
        const remainingBalance = loanToEdit ? parseCurrency(remainingBalanceForEdit) : totalAmount;
        
        if (!name || !fromAccountId || !totalAmount || !interestRate || !termMonths || !startDate || !firstPaymentDate) {
            setError("Please fill out all fields.");
            return;
        }

        if (monthlyPrincipalInput <= 0 && !loanToEdit) {
             setError("Monthly Principal must be greater than 0");
             return;
        }

        setIsSubmitting(true);

        try {
            const batch = writeBatch(db);
            // Use local parsing to avoid timezone shifts
            const loanDateObj = parseDateInputAsLocal(startDate);
            const loanDateTimestamp = Timestamp.fromDate(loanDateObj);

            const isEditing = !!loanToEdit;
            const loanRef = isEditing 
                ? doc(db, `users/${user.uid}/loans`, loanToEdit.id) 
                : doc(collection(db, `users/${user.uid}/loans`));

            const selectedAccount = accounts.find(a => a.id === fromAccountId);
            if (!selectedAccount) throw new Error("Source account not found.");
            
            const loanData: Omit<Loan, 'id'> = {
                name,
                fromAccountId,
                fromAccountName: selectedAccount.name,
                totalAmount,
                interestRate: parseFloat(interestRate),
                termMonths: parseInt(termMonths, 10),
                startDate: loanDateTimestamp,
                remainingBalance,
            };
            
            if (isEditing) {
                batch.update(loanRef, loanData);
                // Delete old schedule before creating new one
                const scheduleCollectionRef = collection(db, `users/${user.uid}/loans/${loanToEdit.id}/paymentSchedule`);
                const scheduleSnapshot = await getDocs(scheduleCollectionRef);
                scheduleSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            } else {
                batch.set(loanRef, loanData);
            }

            // --- GENERATE SCHEDULE: ACTUAL/365 METHOD ---
            
            const ratePerYear = parseFloat(interestRate);
            const n = parseInt(termMonths, 10);
            
            // Use user input for principal, or fallback to standard division
            const basePrincipal = monthlyPrincipalInput > 0 ? monthlyPrincipalInput : Math.floor(totalAmount / n);
            
            let currentRemaining = totalAmount;
            
            // The first "previous date" is the Loan Disbursement Date (Start Date)
            let previousDate = new Date(loanDateObj);
            
            // Use local parsing for First Payment Date
            const baseFirstPaymentDate = parseDateInputAsLocal(firstPaymentDate);

            if (n > 0) {
                for (let k = 1; k <= n; k++) {
                    // 1. Determine Payment Date for this cycle
                    let currentPaymentDate: Date;
                    if (k === 1) {
                        currentPaymentDate = new Date(baseFirstPaymentDate);
                    } else {
                        currentPaymentDate = new Date(baseFirstPaymentDate);
                        currentPaymentDate.setMonth(baseFirstPaymentDate.getMonth() + (k - 1));
                    }

                    // 2. Calculate Actual Days (Date_i - Date_{i-1})
                    // Diff in milliseconds
                    const diffTime = Math.abs(currentPaymentDate.getTime() - previousDate.getTime());
                    // Convert to days (1000ms * 60s * 60m * 24h)
                    const actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // 3. Calculate Interest: Balance * Rate * Days / 365
                    // Formula: currentRemaining * (ratePerYear/100) * (actualDays/365)
                    // We use Math.round for VND currency
                    const interestPayment = Math.round(currentRemaining * (ratePerYear / 100) * actualDays / 365);

                    // 4. Calculate Principal
                    let principalPayment = basePrincipal;
                    
                    // Logic: If it's the LAST month (k=n), pay exactly what is left (currentRemaining).
                    // Also safety check: don't pay more than remaining.
                    if (k === n) {
                        principalPayment = currentRemaining;
                    } else if (currentRemaining < principalPayment) {
                        principalPayment = currentRemaining;
                    }

                    // 5. Total Payment
                    const totalPayment = principalPayment + interestPayment;
                    
                    // 6. Update Remaining Balance *after* this payment
                    const nextRemaining = currentRemaining - principalPayment;

                    const scheduleItemRef = doc(db, `users/${user.uid}/loans/${loanRef.id}/paymentSchedule`, k.toString());
                    const scheduleItem: Omit<PaymentSchedule, 'id'> = {
                        paymentDate: Timestamp.fromDate(currentPaymentDate),
                        principal: principalPayment,
                        interest: interestPayment,
                        totalPayment: totalPayment,
                        isPaid: false,
                        interestRateSnapshot: ratePerYear,
                        remainingBalance: nextRemaining
                    };
                    batch.set(scheduleItemRef, scheduleItem);
                    
                    // Update cursors for next iteration
                    currentRemaining = nextRemaining;
                    previousDate = currentPaymentDate;
                }
            }

            await batch.commit();
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to save loan:", err);
            setError("Failed to save loan. Please check the values and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={loanToEdit ? t('loan_edit') : t('loan_add')}>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_reason')}</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required placeholder="e.g., Mua nhà, Vay kinh doanh" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_source_acc')}</label>
                        <select name="fromAccountId" value={formData.fromAccountId} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required>
                             <option value="" disabled>Select Account</option>
                             {accounts.filter(a => ['bank', 'credit'].includes(a.type)).map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                             ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_interest_rate')}</label>
                        <input type="number" step="0.01" name="interestRate" value={formData.interestRate} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_total_amount')}</label>
                        <input type="text" inputMode="numeric" name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    {/* Conditionally render remaining balance only if editing */}
                    {loanToEdit && (
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_remaining')}</label>
                            <input type="text" inputMode="numeric" name="remainingBalance" value={remainingBalanceForEdit} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_term_months')}</label>
                        <input type="number" name="termMonths" value={formData.termMonths} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_monthly_principal')}</label>
                        <input type="text" inputMode="numeric" name="monthlyPrincipal" value={formData.monthlyPrincipal} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        <p className="text-xs text-gray-500 mt-1">{t('form_auto_calc')}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_start_date')}</label>
                        <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_first_payment')}</label>
                        <input type="date" name="firstPaymentDate" value={formData.firstPaymentDate} onChange={handleInputChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                         <p className="text-xs text-gray-500 mt-1">{t('form_bank_date')}</p>
                    </div>
                     <div className="md:col-span-2">
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('form_maturity_date')}</label>
                        <p className="py-2 px-3 text-gray-500 dark:text-gray-400 font-semibold">{endDateDisplay}</p>
                    </div>
                </div>

                {error && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}

                <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400">
                        {isSubmitting ? <Spinner/> : (loanToEdit ? t('form_update') : t('form_save'))}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddLoanModal;

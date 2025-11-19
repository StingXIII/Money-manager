
import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { PaymentSchedule } from '../../types';
import { Timestamp } from 'firebase/firestore';

interface EditScheduleItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: PaymentSchedule;
    previousBalance: number;
    previousDate: Date | null;
    onSave: (updatedItem: PaymentSchedule, applyToFuture: boolean) => Promise<void>;
}

const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9.]/g, ''); 
    if (rawValue === '') return '';
    const number = parseInt(rawValue.replace(/\./g, ''), 10);
    if (isNaN(number)) return '';
    return number.toLocaleString('vi-VN');
};
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;

const EditScheduleItemModal: React.FC<EditScheduleItemModalProps> = ({ isOpen, onClose, item, previousBalance, previousDate, onSave }) => {
    const [date, setDate] = useState('');
    const [principal, setPrincipal] = useState('');
    const [interest, setInterest] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [applyToFuture, setApplyToFuture] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && item) {
            setDate(item.paymentDate.toDate().toISOString().split('T')[0]);
            setPrincipal(item.principal.toLocaleString('vi-VN'));
            setInterest(item.interest.toLocaleString('vi-VN'));
            setInterestRate(item.interestRateSnapshot?.toString() || '');
            setApplyToFuture(false);
            setError('');
        }
    }, [isOpen, item]);

    // Helper to calculate interest based on current state values
    const calculateInterest = (currentRateStr: string, currentDateStr: string) => {
        if (!previousBalance || !previousDate || !currentRateStr || !currentDateStr) return null;

        const rate = parseFloat(currentRateStr);
        if (isNaN(rate)) return null;

        const currentPaymentDate = new Date(currentDateStr);
        
        // Calculate Actual Days difference
        const diffTime = Math.abs(currentPaymentDate.getTime() - previousDate.getTime());
        const actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Formula: RemainingBalance * Rate% * ActualDays / 365
        // (rate / 100) is rate%
        const newInterest = Math.round(previousBalance * (rate / 100) * actualDays / 365);
        return newInterest;
    };

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newRateStr = e.target.value;
        setInterestRate(newRateStr);

        const newInterest = calculateInterest(newRateStr, date);
        if (newInterest !== null) {
            setInterest(newInterest.toLocaleString('vi-VN'));
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDateStr = e.target.value;
        setDate(newDateStr);

        // Only recalculate if there is a rate present to calculate with
        if (interestRate) {
             const newInterest = calculateInterest(interestRate, newDateStr);
             if (newInterest !== null) {
                setInterest(newInterest.toLocaleString('vi-VN'));
             }
        }
    };

    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, isCurrency: boolean = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (isCurrency) {
            setter(formatCurrencyInput(val));
        } else {
            setter(val);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const principalVal = parseCurrency(principal);
            const interestVal = parseCurrency(interest);
            
            // Total Payment is explicitly the sum of Principal + Interest
            const updatedItem: PaymentSchedule = {
                ...item,
                paymentDate: Timestamp.fromDate(new Date(date)),
                principal: principalVal,
                interest: interestVal,
                totalPayment: principalVal + interestVal,
                interestRateSnapshot: interestRate ? parseFloat(interestRate) : undefined
            };

            await onSave(updatedItem, applyToFuture);
            onClose();
        } catch (err: any) {
            console.error(err);
            setError("Failed to update payment item.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate total dynamically for display
    const total = parseCurrency(principal) + parseCurrency(interest);
    const prevDateDisplay = previousDate ? previousDate.toLocaleDateString('en-GB') : 'N/A';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Payment Details">
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">Payment Date</label>
                        <input type="date" value={date} onChange={handleDateChange} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800 mb-2">
                        <p className="text-xs text-blue-600 dark:text-blue-300 font-semibold uppercase">Calculation Basis (Actual/365)</p>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Previous Balance:</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{previousBalance.toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Previous Date:</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">{prevDateDisplay}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300">Applied Interest Rate (%/year)</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={interestRate} 
                            onChange={handleRateChange} 
                            className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" 
                            placeholder="Enter new rate to recalculate interest" 
                        />
                        <p className="text-xs text-gray-500 mt-1">Changing rate or date recalculates Interest based on actual days.</p>
                    </div>
                    
                    <div className="flex items-center mb-2">
                        <input 
                            id="applyToFuture" 
                            type="checkbox" 
                            checked={applyToFuture} 
                            onChange={(e) => setApplyToFuture(e.target.checked)} 
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="applyToFuture" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                            Apply this interest rate to all future payments?
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Principal (Gốc)</label>
                            <input type="text" inputMode="numeric" value={principal} onChange={handleInputChange(setPrincipal, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300">Interest (Lãi)</label>
                            <input type="text" inputMode="numeric" value={interest} onChange={handleInputChange(setInterest, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                        </div>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded flex justify-between items-center">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Total Payment (Est.):</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{total.toLocaleString('vi-VN')}</span>
                    </div>
                </div>

                {error && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}

                <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400">
                        {isSubmitting ? <Spinner /> : 'Update Payment'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EditScheduleItemModal;

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { PaymentSchedule } from '../../types';

interface LoanPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payment: PaymentSchedule;
    onConfirm: () => Promise<void>;
}

const LoanPaymentModal: React.FC<LoanPaymentModalProps> = ({ isOpen, onClose, payment, onConfirm }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm();
            // On success, the parent will close the modal.
        } catch (err) {
            setError("Failed to process payment. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Reset state when modal is closed/opened
    React.useEffect(() => {
        if (isOpen) {
            setError('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Loan Payment">
            <div>
                <p className="mb-2 dark:text-gray-300">Are you sure you want to mark this payment as paid?</p>
                <p className="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 mb-4">
                    {payment.totalPayment.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                </p>
                
                {error && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
                
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-black dark:text-white font-bold py-2 px-4 rounded">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-green-400"
                    >
                        {isSubmitting ? <Spinner /> : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LoanPaymentModal;

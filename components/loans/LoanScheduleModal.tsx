
import React from 'react';
import Modal from '../ui/Modal';
import { PaymentSchedule, LoanWithSchedule } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface LoanScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    loan: LoanWithSchedule;
    onMarkAsPaid: (loan: LoanWithSchedule, payment: PaymentSchedule) => void;
    onEdit: (payment: PaymentSchedule) => void;
}

const LoanScheduleModal: React.FC<LoanScheduleModalProps> = ({ isOpen, onClose, loan, onMarkAsPaid, onEdit }) => {
    const { t } = useLanguage();
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${t('sched_title')}: ${loan.name}`}>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-3">#</th>
                            <th scope="col" className="px-4 py-3">{t('sched_date')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_principal')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_interest')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_total')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_rate')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_remaining')}</th>
                            <th scope="col" className="px-4 py-3">{t('sched_action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loan.schedule.map((payment, index) => (
                            <tr key={payment.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{index + 1}</td>
                                <td className="px-4 py-3">{payment.paymentDate.toDate().toLocaleDateString('en-GB')}</td>
                                <td className="px-4 py-3">{payment.principal.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</td>
                                <td className="px-4 py-3">{payment.interest.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</td>
                                <td className="px-4 py-3 font-bold">{payment.totalPayment.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'})}</td>
                                <td className="px-4 py-3 text-gray-500">{payment.interestRateSnapshot ?? '-'}</td>
                                <td className="px-4 py-3 text-gray-500 italic">
                                    {payment.remainingBalance !== undefined 
                                        ? payment.remainingBalance.toLocaleString('vi-VN', {style: 'currency', currency: 'VND'}) 
                                        : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex space-x-2">
                                        {payment.isPaid ? (
                                            <span className="text-green-500 font-semibold px-2 py-1">{t('sched_paid')}</span>
                                        ) : (
                                            <button 
                                                onClick={() => onMarkAsPaid(loan, payment)}
                                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-2 rounded"
                                            >
                                                {t('sched_pay')}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onEdit(payment)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            title="Edit manual values"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
};

export default LoanScheduleModal;

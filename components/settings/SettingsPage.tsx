
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../services/firebase';
import Card from '../ui/Card';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

interface LogEntry {
  version: string;
  date: string;
  changes_en: string[];
  changes_vi: string[];
  type: 'major' | 'minor' | 'patch';
}

const changelogs: LogEntry[] = [
  {
    version: '1.1.0',
    date: new Date().toLocaleDateString(),
    changes_en: [
        'Added "Fin-Sentinel" AI Advisor powered by Google Gemini for financial auditing and advice.',
        'Redesigned Mobile Navigation with new bottom drawer menu.',
        'Improved Transactions & Accounts UI for mobile devices.',
        'Added Changelog section in Settings.'
    ],
    changes_vi: [
        'Tích hợp Trợ lý tài chính AI "Fin-Sentinel" (sử dụng Google Gemini) để kiểm toán và tư vấn.',
        'Thiết kế lại menu điều hướng trên mobile dạng ngăn kéo (Drawer).',
        'Tối ưu giao diện Giao dịch & Tài khoản cho điện thoại.',
        'Thêm mục Nhật ký phiên bản trong Cài đặt.'
    ],
    type: 'minor'
  },
  {
    version: '1.0.0',
    date: '20/02/2025',
    changes_en: [
      'First Release (v1.0).',
      'Core features: Dashboard, Accounts, Transactions, Categories, Loans, Plans.',
      'Cloud data synchronization with Firebase.',
      'Dark mode support.'
    ],
    changes_vi: [
      'Phát hành bản đầu tiên (v1.0).',
      'Tính năng cốt lõi: Tổng quan, Tài khoản, Giao dịch, Danh mục, Khoản vay, Kế hoạch.',
      'Đồng bộ dữ liệu đám mây với Firebase.',
      'Hỗ trợ chế độ tối (Dark mode).'
    ],
    type: 'major'
  }
];

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (confirmText !== 'DELETE') {
        setError(t('set_type_delete'));
        return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Initialize batch
      const batchSize = 400;
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      const batches: Promise<void>[] = [];

      // Helper to add delete op to batch
      const addToBatch = (docRef: any) => {
          currentBatch.delete(docRef);
          batchCount++;
          if (batchCount >= batchSize) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              batchCount = 0;
          }
      };

      // 1. Transactions
      const transSnapshot = await getDocs(collection(db, `users/${user.uid}/transactions`));
      transSnapshot.docs.forEach(doc => addToBatch(doc.ref));

      // 2. Categories
      const catSnapshot = await getDocs(collection(db, `users/${user.uid}/categories`));
      catSnapshot.docs.forEach(doc => addToBatch(doc.ref));

      // 3. Accounts
      const accSnapshot = await getDocs(collection(db, `users/${user.uid}/accounts`));
      accSnapshot.docs.forEach(doc => addToBatch(doc.ref));

      // 4. Loans & Schedule
      const loansSnapshot = await getDocs(collection(db, `users/${user.uid}/loans`));
      for (const loanDoc of loansSnapshot.docs) {
          const scheduleSnapshot = await getDocs(collection(db, `users/${user.uid}/loans/${loanDoc.id}/paymentSchedule`));
          scheduleSnapshot.docs.forEach(sDoc => addToBatch(sDoc.ref));
          addToBatch(loanDoc.ref);
      }

      // 5. Plans (Monthly Recurring Plans)
      const plansSnapshot = await getDocs(collection(db, `users/${user.uid}/plans`));
      plansSnapshot.docs.forEach(doc => addToBatch(doc.ref));

      // Commit any remaining operations
      if (batchCount > 0) {
          batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      
      // Sign out to reset state. App.tsx will handle routing to AuthPage, then SetupPage after login.
      await signOut(auth);

    } catch (err: any) {
      console.error("Error resetting data:", err);
      setError(`Failed to reset data: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
       <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('set_title')}</h1>
       
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* General Settings */}
           <div className="space-y-6">
               <Card>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">{t('set_general')}</h2>
                  <div className="flex items-center justify-between">
                     <label className="text-gray-700 dark:text-gray-300 font-medium">{t('set_language')}</label>
                     <div className="flex space-x-2">
                        <button 
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            English
                        </button>
                        <button 
                            onClick={() => setLanguage('vi')}
                            className={`px-4 py-2 rounded transition-colors ${language === 'vi' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            Tiếng Việt
                        </button>
                     </div>
                  </div>
               </Card>

               <Card className="border-l-4 border-red-500">
                  <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{t('set_danger')}</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {t('set_delete_desc')}
                    <br/>
                    <strong>This action cannot be undone.</strong>
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {t('set_reset_btn')}
                  </button>
               </Card>
           </div>

           {/* Changelog Section */}
           <Card className="h-fit">
               <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">{t('set_changelog')}</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('set_changelog_desc')}</p>
               
               <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                   {changelogs.map((log, index) => (
                       <div key={index} className="relative pl-6">
                           {/* Dot */}
                           <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${index === 0 ? 'bg-blue-600' : 'bg-gray-400'}`}></span>
                           
                           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                               <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                   v{log.version}
                                   {index === 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">Current</span>}
                               </h3>
                               <span className="text-sm text-gray-500 dark:text-gray-400">{log.date}</span>
                           </div>
                           
                           <ul className="list-disc list-outside ml-4 text-gray-600 dark:text-gray-300 text-sm space-y-1">
                               {(language === 'vi' ? log.changes_vi : log.changes_en).map((change, i) => (
                                   <li key={i}>{change}</li>
                               ))}
                           </ul>
                       </div>
                   ))}
               </div>
           </Card>
       </div>

       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('set_reset_btn')}>
          <form onSubmit={handleResetData}>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4 border border-red-200 dark:border-red-800">
                <p className="text-red-700 dark:text-red-300 font-medium mb-2">
                    {t('set_confirm_title')}
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {t('set_confirm_msg')}
                </p>
              </div>
              
              <label className="block text-sm font-bold mb-2 dark:text-gray-300">{t('set_type_delete')}</label>
              <input 
                  type="text" 
                  value={confirmText} 
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200 mb-4"
                  placeholder="DELETE"
                  autoComplete="off"
              />
              {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
              
              <div className="flex justify-end space-x-3 mt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-800 dark:text-white font-bold py-2 px-4 rounded">{t('set_cancel')}</button>
                  <button type="submit" disabled={loading || confirmText !== 'DELETE'} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                      {loading ? <Spinner className="h-5 w-5 mr-2" /> : null}
                      {t('set_confirm_reset')}
                  </button>
              </div>
          </form>
       </Modal>
    </div>
  );
};

export default SettingsPage;


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Card from '../ui/Card';
import { Account } from '../../types';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

// Re-using form states and helpers from SetupPage
const initialBankFormState = { name: '', balance: '', limit: '' };
const initialWalletFormState = { name: '', balance: '' };
const initialCreditCardFormState = {
    name: '',
    currentDebt: '',
    statementDate: 'EOM',
    paymentDueDateOffset: '15',
    annualFee: '',
    cashbackRate: '',
    maxCashbackPerMonth: '',
    currentPoints: '',
};

const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    return parseInt(rawValue, 10).toLocaleString('vi-VN');
};
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;

const AccountsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form & Modal States
  const [bankFormData, setBankFormData] = useState(initialBankFormState);
  const [walletFormData, setWalletFormData] = useState(initialWalletFormState);
  const [creditCardFormData, setCreditCardFormData] = useState(initialCreditCardFormState);
  const [creditCardModal, setCreditCardModal] = useState<{
    isOpen: boolean;
    parentId: string | null;
    editingId: string | null;
  }>({ isOpen: false, parentId: null, editingId: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
        const accountsQuery = collection(db, `users/${user.uid}/accounts`);
        const accountsSnapshot = await getDocs(accountsQuery);
        const fetchedAccounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(fetchedAccounts);
    } catch (err) {
        console.error(err);
        setError("Failed to load accounts.");
    } finally {
        setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<any>>,
    isCurrency: boolean = false
  ) => {
    const { name, value } = e.target;
    setter(prev => ({ ...prev, [name]: isCurrency ? formatCurrencyInput(value) : value }));
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bankFormData.name || !bankFormData.balance) return;
    setIsSubmitting(true);
    const newAccount: Omit<Account, 'id'> = {
        name: bankFormData.name,
        type: 'bank',
        balance: parseCurrency(bankFormData.balance),
        limit: parseCurrency(bankFormData.limit),
        parentId: null,
    };
    try {
        await addDoc(collection(db, `users/${user.uid}/accounts`), newAccount);
        setBankFormData(initialBankFormState);
        await fetchAccounts();
    } catch (err) {
        setError("Failed to add bank account.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
      e.preventDefault();
      const walletGroup = accounts.find(a => a.type === 'wallet_group');
      if (!user || !walletFormData.name || !walletFormData.balance || !walletGroup) return;
      setIsSubmitting(true);
      const newAccount: Omit<Account, 'id'> = {
          name: walletFormData.name,
          type: 'wallet',
          balance: parseCurrency(walletFormData.balance),
          parentId: walletGroup.id,
      };
      try {
          await addDoc(collection(db, `users/${user.uid}/accounts`), newAccount);
          setWalletFormData(initialWalletFormState);
          await fetchAccounts();
      } catch (err) {
          setError("Failed to add wallet.");
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const cardData = {
        name: creditCardFormData.name,
        currentDebt: parseCurrency(creditCardFormData.currentDebt),
        statementDate: creditCardFormData.statementDate,
        paymentDueDateOffset: parseInt(creditCardFormData.paymentDueDateOffset, 10) || 15,
        annualFee: parseFloat(creditCardFormData.annualFee) || 0,
        cashbackRate: parseFloat(creditCardFormData.cashbackRate) || 0,
        maxCashbackPerMonth: parseCurrency(creditCardFormData.maxCashbackPerMonth),
        currentPoints: parseCurrency(creditCardFormData.currentPoints),
    };

    try {
        if (creditCardModal.editingId) {
            const docRef = doc(db, `users/${user.uid}/accounts`, creditCardModal.editingId);
            await updateDoc(docRef, cardData);
        } else {
            const newCard: Omit<Account, 'id'> = {
                ...cardData,
                parentId: creditCardModal.parentId,
                type: 'credit',
            };
            await addDoc(collection(db, `users/${user.uid}/accounts`), newCard);
        }
        setCreditCardModal({ isOpen: false, parentId: null, editingId: null });
        await fetchAccounts();
    } catch (err) {
        setError("Failed to save credit card.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const openCreditCardModal = (parentId: string) => {
    setCreditCardFormData(initialCreditCardFormState);
    setCreditCardModal({ isOpen: true, parentId, editingId: null });
  };
  
  const openEditCreditCardModal = (account: Account) => {
    setCreditCardFormData({
        name: account.name,
        currentDebt: account.currentDebt?.toLocaleString('vi-VN') || '',
        statementDate: account.statementDate || 'EOM',
        paymentDueDateOffset: String(account.paymentDueDateOffset || 15),
        annualFee: String(account.annualFee || ''),
        cashbackRate: String(account.cashbackRate || ''),
        maxCashbackPerMonth: account.maxCashbackPerMonth?.toLocaleString('vi-VN') || '',
        currentPoints: account.currentPoints?.toLocaleString('vi-VN') || '',
    });
    setCreditCardModal({ isOpen: true, parentId: account.parentId, editingId: account.id });
  };

  const handleDelete = async (accountId: string) => {
      if (!user) return;
      // Simple confirmation
      if (!window.confirm("Are you sure you want to delete this account?")) return;
      
      const accountToDelete = accounts.find(acc => acc.id === accountId);
      if (!accountToDelete || accountToDelete.type === 'wallet_group') return;

      try {
          const batch = writeBatch(db);
          const accountDocRef = doc(db, `users/${user.uid}/accounts`, accountId);
          batch.delete(accountDocRef);

          // If deleting a bank, also delete its child credit cards
          if (accountToDelete.type === 'bank') {
              const childrenQuery = query(collection(db, `users/${user.uid}/accounts`), where("parentId", "==", accountId));
              const childrenSnapshot = await getDocs(childrenQuery);
              childrenSnapshot.forEach(childDoc => {
                  batch.delete(childDoc.ref);
              });
          }
          await batch.commit();
          await fetchAccounts();
      } catch (err) {
          console.error(err);
          setError("Failed to delete account.");
      }
  };

  const { physicalMoneyGroup, childWallets, bankAccounts, creditCardsByParentId, totalWalletBalance } = useMemo(() => {
    const physicalMoneyGroup = accounts.find(a => a.type === 'wallet_group');
    const childWallets = physicalMoneyGroup ? accounts.filter(a => a.parentId === physicalMoneyGroup.id) : [];
    const bankAccounts = accounts.filter(a => a.type === 'bank');
    
    const creditCardsByParentId = accounts.reduce((acc, current) => {
        if (current.type === 'credit' && current.parentId) {
            (acc[current.parentId] = acc[current.parentId] || []).push(current);
        }
        return acc;
    }, {} as Record<string, Account[]>);
    
    const totalWalletBalance = childWallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
    
    return { physicalMoneyGroup, childWallets, bankAccounts, creditCardsByParentId, totalWalletBalance };
  }, [accounts]);
  
  const getAccountTypeName = (type: Account['type']) => {
    switch(type) {
        case 'bank': return t('type_bank');
        case 'wallet': return t('type_wallet');
        case 'wallet_group': return t('type_wallet_group');
        case 'credit': return t('type_credit');
        default: return 'Account';
    }
  }
  
  const tableHeaders = [
    'th_name', 'th_type', 'th_balance', 'th_limit', 'th_debt', 
    'th_statement', 'th_payment', 'th_fee', 'th_cashback', 'th_max_cashback', 
    'th_points', 'th_actions'
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Spinner /></div>;
  }
  
  return (
    <div className="p-4 md:p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('acc_title')}</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <Card>
                <h3 className="font-semibold mb-3 dark:text-white text-lg">{t('acc_add_wallet')}</h3>
                 <form onSubmit={handleAddWallet} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="wallet_name">{t('acc_wallet_name')}</label>
                        <input type="text" name="name" id="wallet_name" value={walletFormData.name} onChange={(e) => handleInputChange(e, setWalletFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="wallet_balance">{t('acc_balance')}</label>
                        <input type="text" inputMode="numeric" name="balance" id="wallet_balance" value={walletFormData.balance} onChange={(e) => handleInputChange(e, setWalletFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div>
                        <button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full disabled:bg-green-400">{t('btn_add_wallet')}</button>
                    </div>
                </form>
            </Card>
            <Card>
                <h3 className="font-semibold mb-3 dark:text-white text-lg">{t('acc_add_bank')}</h3>
                 <form onSubmit={handleAddBankAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="bank_name">{t('acc_bank_name')}</label>
                        <input type="text" name="name" id="bank_name" value={bankFormData.name} onChange={(e) => handleInputChange(e, setBankFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="bank_balance">{t('acc_balance')}</label>
                        <input type="text" inputMode="numeric" name="balance" id="bank_balance" value={bankFormData.balance} onChange={(e) => handleInputChange(e, setBankFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="limit">{t('acc_limit')}</label>
                        <input type="text" inputMode="numeric" name="limit" id="limit" value={bankFormData.limit} onChange={(e) => handleInputChange(e, setBankFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" />
                    </div>
                    <div>
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full disabled:bg-blue-400">{t('btn_add_bank')}</button>
                    </div>
                </form>
            </Card>
        </div>
         {error && <p className="text-red-500 text-center">{error}</p>}

        {/* Mobile Card View */}
        <div className="md:hidden space-y-6">
             {/* Wallet Section */}
             {physicalMoneyGroup && (
                <div className="space-y-3">
                    <h2 className="text-xl font-semibold dark:text-white px-1">
                         {physicalMoneyGroup.name} <span className="text-green-600 text-sm">({totalWalletBalance.toLocaleString('vi-VN')} đ)</span>
                    </h2>
                    {childWallets.map(wallet => (
                        <div key={wallet.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{wallet.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('type_wallet')}</p>
                                <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">{wallet.balance?.toLocaleString('vi-VN')} đ</p>
                            </div>
                             <button onClick={() => handleDelete(wallet.id)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
             )}

             {/* Bank Sections */}
             {bankAccounts.map(bankAcc => {
                 const childCards = creditCardsByParentId[bankAcc.id] || [];
                 return (
                     <div key={bankAcc.id} className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                             <h2 className="text-xl font-semibold dark:text-white">{bankAcc.name}</h2>
                             <button onClick={() => openCreditCardModal(bankAcc.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold">{t('btn_add_card')}</button>
                        </div>
                        
                        {/* Bank Card itself */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-500 dark:border-blue-500 flex justify-between items-center">
                             <div>
                                <p className="font-bold text-gray-900 dark:text-white">{bankAcc.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('type_bank')}</p>
                                <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">{bankAcc.balance?.toLocaleString('vi-VN')} đ</p>
                            </div>
                            <button onClick={() => handleDelete(bankAcc.id)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        </div>

                        {/* Credit Cards */}
                        {childCards.map(card => (
                            <div key={card.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-500 dark:border-red-500 ml-4">
                                <div className="flex justify-between items-start">
                                     <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{card.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('type_credit')}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => openEditCreditCardModal(card)} className="text-blue-600 dark:text-blue-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button onClick={() => handleDelete(card.id)} className="text-red-600 dark:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="block text-gray-500">Debt:</span>
                                        <span className="font-bold text-red-600">{(card.currentDebt || 0).toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div>
                                         <span className="block text-gray-500">Stmt:</span>
                                         <span>{card.statementDate === 'EOM' ? 'EOM' : card.statementDate} (+{card.paymentDueDateOffset}d)</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                 )
             })}
        </div>

        {/* Desktop Table View */}
         <Card className="hidden md:block">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">{t('acc_your_accounts')}</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            {tableHeaders.map(h => 
                                <th scope="col" key={h} className="px-3 py-3 whitespace-nowrap">{t(h)}</th>
                            )}
                        </tr>
                    </thead>
                    {/* Wallet Section */}
                    {physicalMoneyGroup && (
                        <tbody className="border-b-4 border-gray-200 dark:border-gray-700">
                            <tr className="bg-white dark:bg-gray-800 font-semibold text-gray-800 dark:text-gray-200">
                                <td className="px-3 py-4">{physicalMoneyGroup.name}</td>
                                <td className="px-3 py-4">{getAccountTypeName(physicalMoneyGroup.type)}</td>
                                <td className="px-3 py-4 text-green-600 dark:text-green-400">{totalWalletBalance.toLocaleString('vi-VN')}</td>
                                <td colSpan={8} className="px-3 py-4">-</td>
                                <td className="px-3 py-4"></td>
                            </tr>
                                {childWallets.map(wallet => (
                                <tr key={wallet.id} className="bg-gray-50 dark:bg-gray-800/50">
                                    <td className="pl-8 pr-3 py-3 text-gray-900 dark:text-white">{wallet.name}</td>
                                    <td className="px-3 py-3">{getAccountTypeName(wallet.type)}</td>
                                    <td className="px-3 py-3 text-green-600 dark:text-green-400">{wallet.balance?.toLocaleString('vi-VN')}</td>
                                    <td colSpan={8} className="px-3 py-3">-</td>
                                    <td className="px-3 py-3">
                                        <button onClick={() => handleDelete(wallet.id)} className="text-red-600 dark:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                    
                    {/* Bank Sections */}
                    {bankAccounts.map(bankAcc => {
                        const childCards = creditCardsByParentId[bankAcc.id] || [];
                        const totalDebt = childCards.reduce((sum, card) => sum + (card.currentDebt || 0), 0);
                        return (
                            <tbody key={bankAcc.id} className="border-b-4 border-gray-200 dark:border-gray-700">
                                <tr className="bg-white dark:bg-gray-800 font-semibold text-gray-800 dark:text-gray-200">
                                    <td className="px-3 py-4">{bankAcc.name}</td>
                                    <td className="px-3 py-4">{getAccountTypeName(bankAcc.type)}</td>
                                    <td className="px-3 py-4 text-green-600 dark:text-green-400">{bankAcc.balance?.toLocaleString('vi-VN')}</td>
                                    <td className="px-3 py-4">{bankAcc.limit?.toLocaleString('vi-VN') || '-'}</td>
                                    <td className="px-3 py-4 text-red-500 dark:text-red-400">{totalDebt > 0 ? totalDebt.toLocaleString('vi-VN') : '-'}</td>
                                    <td colSpan={6} className="px-3 py-4">-</td>
                                    <td className="px-3 py-4">
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => openCreditCardModal(bankAcc.id)} className="text-blue-600 dark:text-blue-400 text-xs font-bold whitespace-nowrap">{t('btn_add_card')}</button>
                                            <button onClick={() => handleDelete(bankAcc.id)} className="text-red-600 dark:text-red-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {childCards.map(card => (
                                    <tr key={card.id} className="bg-gray-50 dark:bg-gray-800/50">
                                        <td className="pl-8 pr-3 py-3 text-gray-900 dark:text-white">{card.name}</td>
                                        <td className="px-3 py-3">{getAccountTypeName(card.type)}</td>
                                        <td className="px-3 py-3">-</td>
                                        <td className="px-3 py-3">-</td>
                                        <td className="px-3 py-3 text-red-500 dark:text-red-400">{card.currentDebt?.toLocaleString('vi-VN')}</td>
                                        <td className="px-3 py-3">{card.statementDate === 'EOM' ? t('acc_eom') : card.statementDate}</td>
                                        <td className="px-3 py-3">+{card.paymentDueDateOffset} days</td>
                                        <td className="px-3 py-3">{card.annualFee}%</td>
                                        <td className="px-3 py-3">{card.cashbackRate}%</td>
                                        <td className="px-3 py-3">{card.maxCashbackPerMonth?.toLocaleString('vi-VN')}</td>
                                        <td className="px-3 py-3">{card.currentPoints?.toLocaleString('vi-VN')}</td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => openEditCreditCardModal(card)} className="text-blue-600 dark:text-blue-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                </button>
                                                <button onClick={() => handleDelete(card.id)} className="text-red-600 dark:text-red-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        )
                    })}
                </table>
            </div>
        </Card>

        {/* Credit Card Modal */}
        <Modal isOpen={creditCardModal.isOpen} onClose={() => setCreditCardModal({ isOpen: false, parentId: null, editingId: null })} title={creditCardModal.editingId ? t('btn_update_card') : t('btn_save_card')}>
            <form onSubmit={handleCreditCardSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ... (Modal content is largely the same as SetupPage) ... */}
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="cc_name">{t('table_card_name')}</label>
                        <input type="text" name="name" id="cc_name" value={creditCardFormData.name} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="currentDebt">{t('table_curr_debt')}</label>
                        <input type="text" inputMode="numeric" name="currentDebt" id="currentDebt" value={creditCardFormData.currentDebt} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                    </div>
                    <div className="border-t dark:border-gray-600 pt-4 mt-2 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="statementDate">{t('th_statement')}</label>
                            <select name="statementDate" id="statementDate" value={creditCardFormData.statementDate} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200">
                               <option value="EOM">{t('acc_eom')}</option>
                               {Array.from({length: 30}, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="paymentDueDateOffset">Payment Due After (days)</label>
                            <input type="number" name="paymentDueDateOffset" id="paymentDueDateOffset" value={creditCardFormData.paymentDueDateOffset} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" min="1" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="annualFee">{t('th_fee')}</label>
                            <input type="number" step="0.01" name="annualFee" id="annualFee" value={creditCardFormData.annualFee} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="cashbackRate">{t('th_cashback')}</label>
                            <input type="number" step="0.01" name="cashbackRate" id="cashbackRate" value={creditCardFormData.cashbackRate} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="maxCashbackPerMonth">{t('th_max_cashback')}</label>
                            <input type="text" inputMode="numeric" name="maxCashbackPerMonth" id="maxCashbackPerMonth" placeholder="e.g., 500,000" value={creditCardFormData.maxCashbackPerMonth} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="currentPoints">{t('th_points')}</label>
                            <input type="text" inputMode="numeric" name="currentPoints" id="currentPoints" value={creditCardFormData.currentPoints} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                        </div>
                    </div>
                </div>
                {error && creditCardModal.isOpen && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
                <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400">
                        {isSubmitting ? <Spinner/> : (creditCardModal.editingId ? t('btn_update_card') : t('btn_save_card'))}
                    </button>
                </div>
            </form>
        </Modal>
    </div>
  );
};

export default AccountsPage;

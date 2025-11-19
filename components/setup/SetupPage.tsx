import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import Card from '../ui/Card';
import { Account } from '../../types';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';

interface SetupPageProps {
  onSetupComplete: () => void;
}

type TempAccount = Omit<Account, 'id'> & { tempId: string };

const PHYSICAL_MONEY_GROUP_ID = 'physical-money-group';

const initialWalletGroup: TempAccount = {
  tempId: PHYSICAL_MONEY_GROUP_ID,
  name: 'Physical Money',
  type: 'wallet_group',
  parentId: null,
};

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

// Helper to format currency inputs
const formatCurrencyInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    return parseInt(rawValue, 10).toLocaleString('vi-VN');
};

// Helper to parse formatted currency back to a number
const parseCurrency = (value: string) => parseFloat(value.replace(/[^0-9]/g, '')) || 0;


const SetupPage: React.FC<SetupPageProps> = ({ onSetupComplete }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TempAccount[]>([initialWalletGroup]);
  
  // State for forms
  const [bankFormData, setBankFormData] = useState(initialBankFormState);
  const [walletFormData, setWalletFormData] = useState(initialWalletFormState);
  const [creditCardFormData, setCreditCardFormData] = useState(initialCreditCardFormState);
  
  // State for Credit Card Modal
  const [creditCardModal, setCreditCardModal] = useState<{
    isOpen: boolean;
    parentId: string | null;
    editingId: string | null;
  }>({ isOpen: false, parentId: null, editingId: null });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<any>>,
    isCurrency: boolean = false
  ) => {
    const { name, value } = e.target;
    setter(prev => ({ ...prev, [name]: isCurrency ? formatCurrencyInput(value) : value }));
  };

  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankFormData.name || !bankFormData.balance) {
        setError('Please fill in Bank Name and Current Balance.');
        return;
    }
    const newAccount: TempAccount = {
        tempId: Date.now().toString() + Math.random(),
        name: bankFormData.name,
        type: 'bank',
        balance: parseCurrency(bankFormData.balance),
        limit: parseCurrency(bankFormData.limit),
        parentId: null,
    };
    setAccounts(prev => [...prev, newAccount]);
    setBankFormData(initialBankFormState);
    setError('');
  };

   const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletFormData.name || !walletFormData.balance) {
        setError('Please fill in Wallet Name and Current Balance.');
        return;
    }
    const newAccount: TempAccount = {
        tempId: Date.now().toString() + Math.random(),
        name: walletFormData.name,
        type: 'wallet',
        balance: parseCurrency(walletFormData.balance),
        parentId: PHYSICAL_MONEY_GROUP_ID,
    };
    setAccounts(prev => [...prev, newAccount]);
    setWalletFormData(initialWalletFormState);
    setError('');
  };


  const handleCreditCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCardFormData.name || !creditCardFormData.currentDebt) {
        setError('Please fill in Card Name and Current Debt.');
        return;
    }
    
    if (creditCardModal.editingId) { // Editing existing card
        setAccounts(accounts.map(acc => {
            if (acc.tempId === creditCardModal.editingId) {
                return {
                    ...acc,
                    name: creditCardFormData.name,
                    currentDebt: parseCurrency(creditCardFormData.currentDebt),
                    statementDate: creditCardFormData.statementDate,
                    paymentDueDateOffset: parseInt(creditCardFormData.paymentDueDateOffset, 10) || 15,
                    annualFee: parseFloat(creditCardFormData.annualFee) || 0,
                    cashbackRate: parseFloat(creditCardFormData.cashbackRate) || 0,
                    maxCashbackPerMonth: parseCurrency(creditCardFormData.maxCashbackPerMonth),
                    currentPoints: parseCurrency(creditCardFormData.currentPoints),
                };
            }
            return acc;
        }));
    } else { // Adding new card
        const newCard: TempAccount = {
            tempId: Date.now().toString() + Math.random(),
            parentId: creditCardModal.parentId,
            type: 'credit',
            name: creditCardFormData.name,
            currentDebt: parseCurrency(creditCardFormData.currentDebt),
            statementDate: creditCardFormData.statementDate,
            paymentDueDateOffset: parseInt(creditCardFormData.paymentDueDateOffset, 10) || 15,
            annualFee: parseFloat(creditCardFormData.annualFee) || 0,
            cashbackRate: parseFloat(creditCardFormData.cashbackRate) || 0,
            maxCashbackPerMonth: parseCurrency(creditCardFormData.maxCashbackPerMonth),
            currentPoints: parseCurrency(creditCardFormData.currentPoints),
        };
        setAccounts(prev => [...prev, newCard]);
    }
    
    setCreditCardFormData(initialCreditCardFormState);
    setCreditCardModal({ isOpen: false, parentId: null, editingId: null });
    setError('');
  };

  const openCreditCardModal = (parentId: string) => {
    setCreditCardFormData(initialCreditCardFormState);
    setCreditCardModal({ isOpen: true, parentId, editingId: null });
  };
  
  const openEditCreditCardModal = (account: TempAccount) => {
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
    setCreditCardModal({ isOpen: true, parentId: account.parentId, editingId: account.tempId });
  };

  const handleDelete = (tempIdToDelete: string) => {
    if (tempIdToDelete === PHYSICAL_MONEY_GROUP_ID) return; // Cannot delete the main group

    setAccounts(currentAccounts => {
        // Find the account to delete.
        const accountToDelete = currentAccounts.find(acc => acc.tempId === tempIdToDelete);
        if (!accountToDelete) return currentAccounts; // Should not happen

        // Create a set of all IDs that need to be deleted.
        const idsToDelete = new Set([tempIdToDelete]);

        // If deleting a bank, also mark its children for deletion.
        if (accountToDelete.type === 'bank') {
            currentAccounts.forEach(acc => {
                if (acc.parentId === tempIdToDelete) {
                    idsToDelete.add(acc.tempId);
                }
            });
        }

        // Return a new array containing only the accounts whose IDs are not in the deletion set.
        return currentAccounts.filter(acc => !idsToDelete.has(acc.tempId));
    });
  };

  const handleFinishSetup = async () => {
    if (!user) return setError('You must be logged in.');
    // Filter out the initial placeholder if no wallets were added. Or ensure at least one real account exists.
    const realAccounts = accounts.filter(acc => acc.type !== 'wallet_group' || accounts.some(a => a.parentId === acc.tempId));
    if (realAccounts.length <= 1 && accounts.filter(a=>a.type==='bank').length === 0) return setError('Please add at least one account or wallet.');
    
    setLoading(true);
    setError('');
    try {
      const parentIdMap = new Map<string, string>();
      const accountsCollectionRef = collection(db, `users/${user.uid}/accounts`);

      const parentAccountsToSave = accounts.filter(acc => !acc.parentId);
      const childAccountsToSave = accounts.filter(acc => acc.parentId);
      
      await Promise.all(parentAccountsToSave.map(async (account) => {
          const { tempId, ...rest } = account;
          const docRef = await addDoc(accountsCollectionRef, rest);
          parentIdMap.set(tempId, docRef.id);
      }));

      await Promise.all(childAccountsToSave.map(account => {
          const { tempId, parentId, ...rest } = account;
          const newParentId = parentId ? parentIdMap.get(parentId) : null;
          if (parentId && !newParentId) {
            throw new Error(`Could not find saved parent for account ${account.name}`);
          }
          return addDoc(accountsCollectionRef, { ...rest, parentId: newParentId });
      }));

      onSetupComplete();
    } catch (err) {
      console.error(err);
      setError('Failed to save accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const { physicalMoneyGroup, childWallets, bankAccounts, creditCardsByParentId, totalWalletBalance } = useMemo(() => {
    const physicalMoneyGroup = accounts.find(a => a.type === 'wallet_group')!;
    const childWallets = accounts.filter(a => a.parentId === PHYSICAL_MONEY_GROUP_ID);
    const bankAccounts = accounts.filter(a => a.type === 'bank');
    
    const creditCardsByParentId = accounts.reduce((acc, current) => {
        if (current.type === 'credit' && current.parentId) {
            (acc[current.parentId] = acc[current.parentId] || []).push(current);
        }
        return acc;
    }, {} as Record<string, TempAccount[]>);
    
    const totalWalletBalance = childWallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
    
    return { physicalMoneyGroup, childWallets, bankAccounts, creditCardsByParentId, totalWalletBalance };
  }, [accounts]);

  const renderStatementDateOptions = () => {
      const options = [<option key="eom" value="EOM">End of Month</option>];
      for (let i = 1; i <= 30; i++) {
          options.push(<option key={i} value={i}>{i}</option>);
      }
      return options;
  };

  const getAccountTypeName = (type: Account['type']) => {
    switch(type) {
        case 'bank': return 'Bank Acc';
        case 'wallet': return 'Wallet';
        case 'wallet_group': return 'Physical Money';
        case 'credit': return 'Credit Card';
        default: return 'Account';
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl relative">
        <div className="absolute top-4 right-4">
            <button 
                onClick={handleSignOut} 
                className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Logout
            </button>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2 dark:text-white">Welcome to Money Manager!</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">Let's set up your financial accounts to get started.</p>
        
        {/* Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Wallet Form */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <h3 className="font-semibold mb-3 dark:text-white">Add a Wallet</h3>
                 <form onSubmit={handleAddWallet} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="wallet_name">Wallet Name</label>
                        <input type="text" name="name" id="wallet_name" value={walletFormData.name} onChange={(e) => handleInputChange(e, setWalletFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="wallet_balance">Balance</label>
                        <input type="text" inputMode="numeric" name="balance" id="wallet_balance" value={walletFormData.balance} onChange={(e) => handleInputChange(e, setWalletFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div className="md:col-span-1">
                        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full">+ Add Wallet</button>
                    </div>
                </form>
            </div>
            {/* Bank Form */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <h3 className="font-semibold mb-3 dark:text-white">Add a Bank Account</h3>
                 <form onSubmit={handleAddBankAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="bank_name">Bank Name</label>
                        <input type="text" name="name" id="bank_name" value={bankFormData.name} onChange={(e) => handleInputChange(e, setBankFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="bank_balance">Balance</label>
                        <input type="text" inputMode="numeric" name="balance" id="bank_balance" value={bankFormData.balance} onChange={(e) => handleInputChange(e, setBankFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" required />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" htmlFor="limit">Credit Limit</label>
                        <input type="text" inputMode="numeric" name="limit" id="limit" value={bankFormData.limit} onChange={(e) => handleInputChange(e, setBankFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="md:col-span-1">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full">+ Add Bank</button>
                    </div>
                </form>
            </div>
        </div>

        {/* Accounts Table */}
        <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Your Accounts</h2>
            <div className="border dark:border-gray-700 rounded-lg min-h-[200px] overflow-x-auto">
                {accounts.length <= 1 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">Your added accounts will appear here.</p>
                ) : (
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                {['Name', 'Type', 'Balance', 'Credit Limit', 'Current Debt', 'Statement Date', 'Payment Date', 'Fee (%)', 'Cashback (%)', 'Max Cashback', 'Points', 'Actions'].map(h => 
                                    <th scope="col" key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
                                )}
                            </tr>
                        </thead>
                        {/* Wallet Section */}
                        <tbody className="border-b-4 border-gray-200 dark:border-gray-700">
                            <tr className="bg-white dark:bg-gray-800 font-semibold text-gray-800 dark:text-gray-200">
                                <td className="px-3 py-4">{physicalMoneyGroup.name}</td>
                                <td className="px-3 py-4">{getAccountTypeName(physicalMoneyGroup.type)}</td>
                                <td className="px-3 py-4 text-green-600 dark:text-green-400">{totalWalletBalance.toLocaleString('vi-VN')}</td>
                                <td colSpan={8} className="px-3 py-4">-</td>
                                <td className="px-3 py-4"></td>
                            </tr>
                             {childWallets.map(wallet => (
                                <tr key={wallet.tempId} className="bg-gray-50 dark:bg-gray-800/50">
                                    <td className="pl-8 pr-3 py-3 text-gray-900 dark:text-white">{wallet.name}</td>
                                    <td className="px-3 py-3">{getAccountTypeName(wallet.type)}</td>
                                    <td className="px-3 py-3 text-green-600 dark:text-green-400">{wallet.balance?.toLocaleString('vi-VN')}</td>
                                    <td colSpan={8} className="px-3 py-3">-</td>
                                    <td className="px-3 py-3">
                                       <button onClick={() => handleDelete(wallet.tempId)} className="text-red-600 dark:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        
                        {/* Bank Sections */}
                        {bankAccounts.map(bankAcc => {
                            const childCards = creditCardsByParentId[bankAcc.tempId] || [];
                            const totalDebt = childCards.reduce((sum, card) => sum + (card.currentDebt || 0), 0);
                            return (
                                <tbody key={bankAcc.tempId} className="border-b-4 border-gray-200 dark:border-gray-700">
                                    <tr className="bg-white dark:bg-gray-800 font-semibold text-gray-800 dark:text-gray-200">
                                        <td className="px-3 py-4">{bankAcc.name}</td>
                                        <td className="px-3 py-4">{getAccountTypeName(bankAcc.type)}</td>
                                        <td className="px-3 py-4 text-green-600 dark:text-green-400">{bankAcc.balance?.toLocaleString('vi-VN')}</td>
                                        <td className="px-3 py-4">{bankAcc.limit?.toLocaleString('vi-VN') || '-'}</td>
                                        <td className="px-3 py-4 text-red-500 dark:text-red-400">{totalDebt > 0 ? totalDebt.toLocaleString('vi-VN') : '-'}</td>
                                        <td colSpan={6} className="px-3 py-4">-</td>
                                        <td className="px-3 py-4">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => openCreditCardModal(bankAcc.tempId)} className="text-blue-600 dark:text-blue-400 text-xs font-bold whitespace-nowrap">ADD CARD</button>
                                                <button onClick={() => handleDelete(bankAcc.tempId)} className="text-red-600 dark:text-red-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {childCards.map(card => (
                                        <tr key={card.tempId} className="bg-gray-50 dark:bg-gray-800/50">
                                            <td className="pl-8 pr-3 py-3 text-gray-900 dark:text-white">{card.name}</td>
                                            <td className="px-3 py-3">{getAccountTypeName(card.type)}</td>
                                            <td className="px-3 py-3">-</td>
                                            <td className="px-3 py-3">-</td>
                                            <td className="px-3 py-3 text-red-500 dark:text-red-400">{card.currentDebt?.toLocaleString('vi-VN')}</td>
                                            <td className="px-3 py-3">{card.statementDate === 'EOM' ? 'End of Month' : card.statementDate}</td>
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
                                                    <button onClick={() => handleDelete(card.tempId)} className="text-red-600 dark:text-red-500">
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
                )}
            </div>
        </div>
          
        <div className="mt-8">
          <button onClick={handleFinishSetup} disabled={loading || accounts.length <= 1} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg w-full disabled:bg-blue-400 disabled:cursor-not-allowed">
            {loading ? <Spinner /> : 'Finish Setup & Go to Dashboard'}
          </button>
        </div>
      </Card>

      {/* Credit Card Modal */}
      <Modal isOpen={creditCardModal.isOpen} onClose={() => setCreditCardModal({ isOpen: false, parentId: null, editingId: null })} title={creditCardModal.editingId ? 'Edit Credit Card' : 'Add Credit Card'}>
        <form onSubmit={handleCreditCardSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="cc_name">Card Name</label>
                    <input type="text" name="name" id="cc_name" value={creditCardFormData.name} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="currentDebt">Current Debt</label>
                    <input type="text" inputMode="numeric" name="currentDebt" id="currentDebt" value={creditCardFormData.currentDebt} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" required />
                </div>
                
                 <div className="border-t dark:border-gray-600 pt-4 mt-2 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="statementDate">Statement Date</label>
                        <select name="statementDate" id="statementDate" value={creditCardFormData.statementDate} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200">
                           {renderStatementDateOptions()}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="paymentDueDateOffset">Payment Due After (days)</label>
                        <input type="number" name="paymentDueDateOffset" id="paymentDueDateOffset" value={creditCardFormData.paymentDueDateOffset} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" min="1" required />
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="annualFee">Annual Fee (%)</label>
                        <input type="number" step="0.01" name="annualFee" id="annualFee" value={creditCardFormData.annualFee} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="cashbackRate">Cashback Rate (%)</label>
                        <input type="number" step="0.01" name="cashbackRate" id="cashbackRate" value={creditCardFormData.cashbackRate} onChange={e => handleInputChange(e, setCreditCardFormData)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="maxCashbackPerMonth">Max Monthly Cashback</label>
                        <input type="text" inputMode="numeric" name="maxCashbackPerMonth" id="maxCashbackPerMonth" placeholder="e.g., 500,000" value={creditCardFormData.maxCashbackPerMonth} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                     <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="currentPoints">Current Points</label>
                        <input type="text" inputMode="numeric" name="currentPoints" id="currentPoints" value={creditCardFormData.currentPoints} onChange={e => handleInputChange(e, setCreditCardFormData, true)} className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200" />
                    </div>
                 </div>
            </div>
            {error && creditCardModal.isOpen && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
            <div className="mt-6 flex justify-end">
                 <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    {creditCardModal.editingId ? 'Update Card' : 'Save Card'}
                </button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default SetupPage;
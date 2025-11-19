
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Card from '../ui/Card';
import { Category } from '../../types';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';

const CategoriesPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ id: string | null; name: string; type: 'income' | 'expense' }>({
        id: null,
        name: '',
        type: 'expense',
    });

    const fetchCategories = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const categoriesQuery = collection(db, `users/${user.uid}/categories`);
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
            setCategories(fetchedCategories);
        } catch (err) {
            console.error(err);
            setError("Failed to load categories.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const openAddModal = (type: 'income' | 'expense') => {
        setModalData({ id: null, name: '', type });
        setIsModalOpen(true);
        setError('');
    };

    const openEditModal = (category: Category) => {
        setModalData({ id: category.id, name: category.name, type: category.type });
        setIsModalOpen(true);
        setError('');
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !modalData.name) {
            setError("Category name cannot be empty.");
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            if (modalData.id) {
                // Update
                const docRef = doc(db, `users/${user.uid}/categories`, modalData.id);
                await updateDoc(docRef, { name: modalData.name });
            } else {
                // Add
                const newCategory: Omit<Category, 'id'> = {
                    name: modalData.name,
                    type: modalData.type,
                    parentId: null, // Simple categories for now
                };
                await addDoc(collection(db, `users/${user.uid}/categories`), newCategory);
            }
            setIsModalOpen(false);
            await fetchCategories();
        } catch (err) {
            console.error(err);
            setError("Failed to save category.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (categoryId: string) => {
        if(!user || !window.confirm("Are you sure you want to delete this category?")) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/categories`, categoryId));
            await fetchCategories();
        } catch(err) {
            console.error(err);
            setError("Failed to delete category. It might be in use by some transactions.");
        }
    }

    const incomeCategories = categories.filter(c => c.type === 'income');
    const expenseCategories = categories.filter(c => c.type === 'expense');

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('cat_title')}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Expense Categories */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold dark:text-white">{t('cat_expense')}</h2>
                        <button onClick={() => openAddModal('expense')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg text-sm">
                            {t('cat_add_expense')}
                        </button>
                    </div>
                    <ul className="space-y-2">
                        {expenseCategories.length > 0 ? expenseCategories.map(cat => (
                            <li key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <span className="dark:text-gray-200">{cat.name}</span>
                                <div className="space-x-2">
                                    <button onClick={() => openEditModal(cat)} className="text-blue-600 dark:text-blue-400">{t('btn_edit')}</button>
                                    <button onClick={() => handleDelete(cat.id)} className="text-red-600 dark:text-red-500">{t('btn_delete')}</button>
                                </div>
                            </li>
                        )) : <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('cat_no_expense')}</p>}
                    </ul>
                </Card>

                {/* Income Categories */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold dark:text-white">{t('cat_income')}</h2>
                        <button onClick={() => openAddModal('income')} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg text-sm">
                            {t('cat_add_income')}
                        </button>
                    </div>
                     <ul className="space-y-2">
                        {incomeCategories.length > 0 ? incomeCategories.map(cat => (
                            <li key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <span className="dark:text-gray-200">{cat.name}</span>
                                <div className="space-x-2">
                                    <button onClick={() => openEditModal(cat)} className="text-blue-600 dark:text-blue-400">{t('btn_edit')}</button>
                                    <button onClick={() => handleDelete(cat.id)} className="text-red-600 dark:text-red-500">{t('btn_delete')}</button>
                                </div>
                            </li>
                        )) : <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('cat_no_income')}</p>}
                    </ul>
                </Card>
            </div>
             {error && !isModalOpen && <p className="text-red-500 text-center">{error}</p>}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalData.id ? t('cat_edit') : t('cat_add')}>
                <form onSubmit={handleModalSubmit}>
                    <div>
                        <label className="block text-sm font-bold mb-2 dark:text-gray-300" htmlFor="category_name">{t('cat_name')}</label>
                        <input
                            type="text"
                            id="category_name"
                            value={modalData.name}
                            onChange={(e) => setModalData(prev => ({ ...prev, name: e.target.value }))}
                            className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 dark:bg-gray-700 dark:text-gray-200"
                            required
                        />
                    </div>
                     {error && isModalOpen && <p className="text-red-500 text-xs italic my-4 text-center">{error}</p>}
                    <div className="mt-6 flex justify-end">
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-400">
                           {isSubmitting ? <Spinner/> : t('cat_btn_save')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CategoriesPage;

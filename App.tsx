
import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from './services/firebase';
import AuthPage from './components/auth/AuthPage';
import Navbar from './components/layout/Navbar';
import DashboardPage from './components/dashboard/DashboardPage';
import Spinner from './components/ui/Spinner';
import SetupPage from './components/setup/SetupPage';
import AccountsPage from './components/accounts/AccountsPage';
import TransactionsPage from './components/transactions/TransactionsPage';
import CategoriesPage from './components/categories/CategoriesPage';
import LoansPage from './components/loans/LoansPage';
import PlansPage from './components/plans/PlansPage';
import AIPage from './components/ai/AIPage';
import SettingsPage from './components/settings/SettingsPage';
import { DateFilterProvider } from './contexts/DateFilterContext';
import { LanguageProvider } from './contexts/LanguageContext';

type NavItem = 'Dashboard' | 'Transactions' | 'Plans' | 'Loans' | 'Accounts' | 'Categories' | 'Advisor' | 'Settings';

const MainApp: React.FC = () => {
    const [activeItem, setActiveItem] = useState<NavItem>('Dashboard');

    const renderContent = () => {
        switch(activeItem) {
            case 'Dashboard':
                return <DashboardPage />;
            case 'Transactions':
                // Pass setActiveItem to allow jumping to Plans
                return <TransactionsPage onNavigate={(page: string) => setActiveItem(page as NavItem)} />;
            case 'Plans':
                return <PlansPage />;
            case 'Loans':
                return <LoansPage />;
            case 'Accounts':
                return <AccountsPage />;
            case 'Categories':
                return <CategoriesPage />;
            case 'Advisor':
                return <AIPage />;
            case 'Settings':
                return <SettingsPage />;
            default:
                return <DashboardPage />;
        }
    }

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <Navbar activeItem={activeItem} setActiveItem={setActiveItem} />
            <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
                {renderContent()}
            </main>
        </div>
    );
}

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [hasAccounts, setHasAccounts] = useState(false);
  const [checkingAccounts, setCheckingAccounts] = useState(true);

  useEffect(() => {
    const checkUserAccounts = async () => {
      if (user) {
        setCheckingAccounts(true);
        try {
          const accountsQuery = query(collection(db, `users/${user.uid}/accounts`), limit(1));
          const querySnapshot = await getDocs(accountsQuery);
          setHasAccounts(!querySnapshot.empty);
        } catch (error) {
          console.error("Error checking for user accounts:", error);
          setHasAccounts(false); // Assume setup needed on error
        } finally {
          setCheckingAccounts(false);
        }
      } else {
        // Not logged in, no accounts to check
        setCheckingAccounts(false);
        setHasAccounts(false);
      }
    };

    checkUserAccounts();
  }, [user]);

  const handleSetupComplete = () => {
    setHasAccounts(true);
  };

  if (authLoading || (user && checkingAccounts)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }
  
  if (!hasAccounts) {
    return <SetupPage onSetupComplete={handleSetupComplete} />;
  }

  return <MainApp />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <DateFilterProvider>
            <AppContent />
        </DateFilterProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;

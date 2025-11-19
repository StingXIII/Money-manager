
import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

type NavItem = 'Dashboard' | 'Transactions' | 'Plans' | 'Loans' | 'Accounts' | 'Categories' | 'Advisor' | 'Settings';

interface NavbarProps {
  activeItem: NavItem;
  setActiveItem: (item: NavItem) => void;
}

const NavIcon: React.FC<{ item: NavItem; isActive?: boolean }> = ({ item, isActive }) => {
    const activeClass = isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400";
    
    switch(item) {
        case 'Dashboard': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
        case 'Transactions': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
        case 'Plans': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
        case 'Loans': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1m0 1H9m3 0h3m-3 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z" /></svg>;
        case 'Accounts': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
        case 'Categories': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
        case 'Advisor': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
        case 'Settings': return <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${activeClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
        default: return null;
    }
}

const ThemeToggle = ({ compact }: { compact?: boolean }) => {
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();
    return (
        <button onClick={toggleTheme} className={`flex items-center w-full text-left ${compact ? 'p-0' : 'p-4 hover:bg-gray-700'} transition-colors duration-200`}>
            {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )}
            {!compact && <span className="ml-3">{t('nav_toggle_theme')}</span>}
        </button>
    )
}

const Navbar: React.FC<NavbarProps> = ({ activeItem, setActiveItem }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const navItems: NavItem[] = ['Dashboard', 'Transactions', 'Plans', 'Loans', 'Accounts', 'Categories', 'Advisor', 'Settings'];
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleItemClick = (item: NavItem) => {
      setActiveItem(item);
      setIsOpen(false);
  };

  const getLabel = (item: NavItem) => {
      switch(item) {
          case 'Dashboard': return t('nav_dashboard');
          case 'Transactions': return t('nav_transactions');
          case 'Plans': return t('nav_plans');
          case 'Loans': return t('nav_loans');
          case 'Accounts': return t('nav_accounts');
          case 'Categories': return t('nav_categories');
          case 'Advisor': return t('nav_advisor');
          case 'Settings': return t('nav_settings');
          default: return item;
      }
  }

  return (
    <>
        {/* Mobile Top Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gray-800 text-white flex items-center justify-between px-4 z-40 shadow-md">
             <div className="flex items-center">
                <button onClick={() => setIsOpen(!isOpen)} className="mr-3 text-gray-300 hover:text-white focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <span className="font-bold text-lg">Money Mgr</span>
             </div>
             <ThemeToggle compact />
        </div>

        {/* Mobile Overlay */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
                onClick={() => setIsOpen(false)}
            ></div>
        )}

        {/* Sidebar (Drawer on Mobile, Fixed on Desktop) */}
        <div className={`
            fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-800 text-white flex flex-col justify-between shrink-0 h-full overflow-y-auto transform transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
        `}>
          <div>
            <div className="p-6 text-2xl font-bold border-b border-gray-700 flex justify-between items-center">
                <span>Money Mgr</span>
                <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <ul className="mt-6">
              {navItems.map(item => (
                <li key={item}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center w-full text-left p-4 hover:bg-gray-700 transition-colors duration-200 ${activeItem === item ? 'bg-blue-600' : ''}`}
                  >
                    <NavIcon item={item} />
                    <span className="ml-3">{getLabel(item)}</span>
                    {item === 'Advisor' && <span className="ml-auto text-xs bg-red-500 text-white px-1 rounded">New</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
              <div className="border-t border-gray-700 hidden md:block">
                <ThemeToggle />
              </div>
              <div className="border-t border-gray-700">
                <button onClick={handleSignOut} className="flex items-center w-full text-left p-4 hover:bg-gray-700 transition-colors duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="ml-3">{t('nav_logout')}</span>
                </button>
              </div>
          </div>
        </div>
    </>
  );
};

export default Navbar;

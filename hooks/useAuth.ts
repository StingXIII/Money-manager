import React, { useState, useEffect, createContext, useContext, ReactNode, ReactElement } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

// FIX: Changed component signature to use React.PropsWithChildren to fix type error.
export const AuthProvider = ({ children }: React.PropsWithChildren<{}>): ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fix: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
  return React.createElement(AuthContext.Provider, { value: { user, loading } }, children);
};

export const useAuth = () => useContext(AuthContext);

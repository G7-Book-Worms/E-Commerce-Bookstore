'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentSession, logoutUser, UserSession } from '@/lib/api/auth';

export type { UserSession };

export interface AuthContextType {
  user: UserSession | null;
  userSession: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserSession | null) => void;
  setUserSession: (user: UserSession | null) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [user, setUserState] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setUser = useCallback((newUser: UserSession | null) => {
    setUserState(newUser);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchCurrentSession();
      setUserState(session);
    } catch {
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setUserState(null);
      startTransition(() => {
        router.push('/');
        router.refresh();
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [router]);

  const value: AuthContextType = {
    user,
    userSession: user,
    isLoading,
    isAuthenticated: !!user,
    setUser,
    setUserSession: setUser,
    refreshSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
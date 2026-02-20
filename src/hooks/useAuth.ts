/**
 * Custom hook for authentication
 *
 * Provides easy access to auth state and actions
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function useAuth(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  tokenAge: number | null;
  refreshAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
  setError: (error: string | null) => void;
} {
  const {
    isAuthenticated,
    isLoading,
    error,
    token,
    tokenAge,
    checkAuth,
    refreshAuth,
    clearAuth,
    setError,
  } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    error,
    token,
    tokenAge,
    refreshAuth,
    clearAuth,
    setError,
  };
}

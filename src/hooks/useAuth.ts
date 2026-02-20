/**
 * Custom hook for authentication
 *
 * Provides easy access to auth state and actions
 */

import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
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

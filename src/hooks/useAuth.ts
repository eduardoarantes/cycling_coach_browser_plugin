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
    refreshAuth,
    clearAuth,
    setError,
  } = useAuthStore();

  // Validate auth on mount (calls API to verify token is still valid)
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Listen for token storage changes and auto-refresh auth state
  // This handles the race condition where token is intercepted AFTER popup opens
  useEffect(() => {
    console.log('[useAuth] Setting up storage change listener...');

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      console.log('[useAuth] Storage changed:', { areaName, changes });

      // Only listen to local storage changes
      if (areaName !== 'local') return;

      // Check if auth_token was added or changed
      if (changes.auth_token) {
        const newValue = changes.auth_token.newValue;
        const oldValue = changes.auth_token.oldValue;

        console.log('[useAuth] auth_token changed:', {
          hadOldValue: !!oldValue,
          hasNewValue: !!newValue,
          newValueLength: typeof newValue === 'string' ? newValue.length : 0,
        });

        // Token was added or changed (not removed)
        if (newValue && newValue !== oldValue) {
          console.log(
            '[useAuth] ✅ Token detected in storage, refreshing auth state...'
          );
          refreshAuth();
        }
        // Token was removed
        else if (!newValue && oldValue) {
          console.log(
            '[useAuth] ❌ Token removed from storage, clearing auth...'
          );
          clearAuth();
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    console.log('[useAuth] ✅ Storage listener registered');

    return () => {
      console.log('[useAuth] Removing storage listener');
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshAuth, clearAuth]);

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

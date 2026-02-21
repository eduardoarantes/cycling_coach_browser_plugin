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

  // Check auth on mount
  useEffect(() => {
    console.log('[useAuth] Component mounted, checking auth...');
    refreshAuth();
  }, [refreshAuth]);

  // Listen for NEW tokens being added to storage
  // Ignore token removals (they'll be detected on next refresh)
  useEffect(() => {
    console.log('[useAuth] Setting up storage listener for new tokens...');

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      // Only listen to local storage changes
      if (areaName !== 'local') return;

      // Check if auth_token was added or changed
      if (changes.auth_token) {
        const newValue = changes.auth_token.newValue;
        const oldValue = changes.auth_token.oldValue;

        console.log('[useAuth] Storage change detected:', {
          hadOldValue: !!oldValue,
          hasNewValue: !!newValue,
          newValueLength: typeof newValue === 'string' ? newValue.length : 0,
        });

        // ONLY refresh when a NEW token is added (ignore removals)
        if (newValue && typeof newValue === 'string' && newValue.length > 0) {
          // Ignore if this is just the same token being re-stored
          if (newValue === oldValue) {
            console.log('[useAuth] ℹ️ Same token re-stored, ignoring');
            return;
          }

          console.log('[useAuth] ✅ New token detected, refreshing auth...');
          refreshAuth();
        } else {
          // Token was removed - just log it, don't clear auth
          // The next manual refresh will detect the missing token
          console.log(
            '[useAuth] ℹ️ Token removed from storage (will be detected on next refresh, not clearing)'
          );
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    console.log('[useAuth] ✅ Storage listener registered');

    return () => {
      console.log('[useAuth] Removing storage listener');
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshAuth]);

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

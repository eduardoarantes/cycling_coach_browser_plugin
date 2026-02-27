/**
 * Custom hook for MyPeak authentication state
 */

import { useEffect } from 'react';
import { useMyPeakAuthStore } from '@/store/myPeakAuthStore';
import { STORAGE_KEYS } from '@/utils/constants';

export function useMyPeakAuth(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  tokenAge: number | null;
  refreshAuth: () => Promise<void>;
  validateAuth: () => Promise<void>;
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
    validateAuth,
    clearAuth,
    setError,
    setAuthState,
  } = useMyPeakAuthStore();

  useEffect(() => {
    void (async () => {
      await refreshAuth();
      await validateAuth();
    })();
  }, [refreshAuth, validateAuth]);

  useEffect(() => {
    let debounceTimer: number | null = null;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const tokenChange = changes[STORAGE_KEYS.MYPEAK_AUTH_TOKEN];
      const apiKeyChange = changes[STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY];
      if (!tokenChange && !apiKeyChange) return;

      if (apiKeyChange && !tokenChange) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          void (async () => {
            await refreshAuth();
            await validateAuth();
          })();
          debounceTimer = null;
        }, 150);

        return;
      }

      if (!tokenChange) return;

      const newValue = tokenChange.newValue;
      const oldValue = tokenChange.oldValue;

      if (newValue && typeof newValue === 'string' && newValue.length > 0) {
        if (newValue === oldValue) {
          return;
        }

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          void (async () => {
            await refreshAuth();
            await validateAuth();
          })();
          debounceTimer = null;
        }, 150);
      } else if (oldValue && !newValue) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }

        setAuthState(false, null, null);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshAuth, setAuthState, validateAuth]);

  return {
    isAuthenticated,
    isLoading,
    error,
    token,
    tokenAge,
    refreshAuth,
    validateAuth,
    clearAuth,
    setError,
  };
}

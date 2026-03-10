/**
 * Custom hook for authentication
 *
 * Provides easy access to auth state and actions
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

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
    setAuthState,
  } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    logger.debug('Auth hook mounted, refreshing auth state');
    void refreshAuth();
  }, [refreshAuth]);

  // Listen for token changes in storage (additions and removals)
  // This keeps UI state synchronized with background service worker
  // Uses debouncing to prevent rapid-fire refreshAuth calls
  useEffect(() => {
    logger.debug('Registering auth storage listener');

    // Debounce timer for refreshAuth calls (prevents rapid-fire updates)
    let debounceTimer: number | null = null;

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

        logger.debug('Auth storage change detected', {
          hadOldValue: !!oldValue,
          hasNewValue: !!newValue,
          newValueLength: typeof newValue === 'string' ? newValue.length : 0,
        });

        // Handle both token additions AND removals
        if (newValue && typeof newValue === 'string' && newValue.length > 0) {
          // Ignore if this is just the same token being re-stored
          if (newValue === oldValue) {
            logger.debug('Ignoring duplicate auth token storage event');
            return;
          }

          // Clear any pending debounced refresh
          if (debounceTimer) {
            logger.debug('Clearing pending auth refresh timer');
            clearTimeout(debounceTimer);
          }

          // Debounce refreshAuth to prevent rapid-fire calls
          logger.debug('Scheduling debounced auth refresh after token update');
          debounceTimer = setTimeout(() => {
            logger.debug('Running debounced auth refresh');
            void refreshAuth();
            debounceTimer = null;
          }, 150);
        } else if (oldValue && !newValue) {
          // Token was REMOVED (401 response cleared it by background service)
          // Immediately update UI state to reflect removal - don't try to clear storage again!
          logger.debug('Auth token removed from storage, updating UI state');

          // Cancel any pending refresh since token is gone
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }

          setAuthState(false, null, null);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    logger.debug('Auth storage listener registered');

    return () => {
      logger.debug('Removing auth storage listener');

      // Clean up debounce timer on unmount
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshAuth, setAuthState]);

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

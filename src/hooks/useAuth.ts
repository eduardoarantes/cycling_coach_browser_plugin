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
    setAuthState,
  } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    console.log('[useAuth] Component mounted, checking auth...');
    refreshAuth();
  }, [refreshAuth]);

  // Listen for token changes in storage (additions and removals)
  // This keeps UI state synchronized with background service worker
  // Uses debouncing to prevent rapid-fire refreshAuth calls
  useEffect(() => {
    console.log('[useAuth] Setting up storage listener for token changes...');

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

        console.log('[useAuth] Storage change detected:', {
          hadOldValue: !!oldValue,
          hasNewValue: !!newValue,
          newValueLength: typeof newValue === 'string' ? newValue.length : 0,
        });

        // Handle both token additions AND removals
        if (newValue && typeof newValue === 'string' && newValue.length > 0) {
          // Ignore if this is just the same token being re-stored
          if (newValue === oldValue) {
            console.log('[useAuth] ℹ️ Same token re-stored, ignoring');
            return;
          }

          // Clear any pending debounced refresh
          if (debounceTimer) {
            console.log('[useAuth] ⏱️ Clearing previous debounce timer...');
            clearTimeout(debounceTimer);
          }

          // Debounce refreshAuth to prevent rapid-fire calls
          console.log(
            '[useAuth] ✅ New token detected, scheduling debounced refresh (150ms)...'
          );
          debounceTimer = setTimeout(() => {
            console.log('[useAuth] 🔄 Executing debounced refreshAuth...');
            refreshAuth();
            debounceTimer = null;
          }, 150);
        } else if (oldValue && !newValue) {
          // Token was REMOVED (401 response cleared it by background service)
          // Immediately update UI state to reflect removal - don't try to clear storage again!
          console.log(
            '[useAuth] 🚨 Token removed from storage (by background), updating UI state...'
          );

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
    console.log('[useAuth] ✅ Storage listener registered');

    return () => {
      console.log('[useAuth] Removing storage listener and clearing timers');

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

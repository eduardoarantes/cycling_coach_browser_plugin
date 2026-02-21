/**
 * Zustand store for authentication state
 *
 * Manages client-side authentication state
 */

import { create } from 'zustand';
import * as authService from '@/services/authService';

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  tokenAge: number | null;

  // Actions
  checkAuth: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: false,
  error: null,
  token: null,
  tokenAge: null,

  // Check authentication status
  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const [isAuth, token, tokenAge] = await Promise.all([
        authService.isAuthenticated(),
        authService.getAuthToken(),
        authService.getTokenAge(),
      ]);

      set({
        isAuthenticated: isAuth,
        token: token,
        tokenAge: tokenAge,
        isLoading: false,
      });
    } catch (error) {
      set({
        isAuthenticated: false,
        token: null,
        tokenAge: null,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check authentication',
      });
    }
  },

  // Refresh authentication (re-check and validate with API)
  refreshAuth: async () => {
    console.log('[authStore] refreshAuth() called');
    set({ isLoading: true, error: null });

    try {
      // First check if token exists
      const token = await authService.getAuthToken();
      console.log(
        '[authStore] Token from storage:',
        token
          ? `${token.substring(0, 20)}... (length: ${token.length})`
          : 'NULL'
      );

      if (!token) {
        // No token, just update state
        console.log(
          '[authStore] No token found, setting isAuthenticated=false'
        );
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
        });
        return;
      }

      // Validate token with TrainingPeaks API
      console.log('[authStore] Validating token with API...');
      const isValid = await authService.validateToken();
      console.log('[authStore] Validation result:', isValid);

      if (isValid) {
        // Token is valid, update state with fresh data
        const [tokenAge] = await Promise.all([authService.getTokenAge()]);

        console.log('[authStore] ✅ Setting isAuthenticated=true');
        set({
          isAuthenticated: true,
          token: token,
          tokenAge: tokenAge,
          isLoading: false,
          error: null,
        });
      } else {
        // Token was invalid and has been cleared
        console.log(
          '[authStore] ❌ Token invalid, setting isAuthenticated=false'
        );
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
          error: null, // Don't show error, just update state
        });
      }
    } catch (error) {
      console.error('[authStore] Error in refreshAuth:', error);
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to validate authentication',
      });
    }
  },

  // Clear authentication
  clearAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.clearAuth();
      set({
        isAuthenticated: false,
        token: null,
        tokenAge: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clear authentication',
      });
    }
  },

  // Set error
  setError: (error: string | null) => {
    set({ error });
  },
}));

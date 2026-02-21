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
    set({ isLoading: true, error: null });

    try {
      // First check if token exists
      const token = await authService.getAuthToken();

      if (!token) {
        // No token, just update state
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
        });
        return;
      }

      // Validate token with TrainingPeaks API
      const isValid = await authService.validateToken();

      if (isValid) {
        // Token is valid, update state with fresh data
        const [tokenAge] = await Promise.all([authService.getTokenAge()]);

        set({
          isAuthenticated: true,
          token: token,
          tokenAge: tokenAge,
          isLoading: false,
          error: null,
        });
      } else {
        // Token was invalid and has been cleared
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
          error: null, // Don't show error, just update state
        });
      }
    } catch (error) {
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

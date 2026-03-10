/**
 * Zustand store for authentication state
 *
 * Manages client-side authentication state
 */

import { create } from 'zustand';
import * as authService from '@/services/authService';
import { logger } from '@/utils/logger';

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  tokenAge: number | null;
  isRefreshing: boolean; // Internal flag to prevent concurrent refreshAuth calls

  // Actions
  checkAuth: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
  setError: (error: string | null) => void;
  setAuthState: (
    isAuthenticated: boolean,
    token: string | null,
    tokenAge: number | null
  ) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: false,
  error: null,
  token: null,
  tokenAge: null,
  isRefreshing: false,

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

  // Refresh authentication (optimistic check - no API validation)
  // API validation happens lazily when user actually fetches data
  refreshAuth: async () => {
    // Prevent concurrent calls - if already refreshing, skip
    if (get().isRefreshing) {
      logger.debug('refreshAuth already in progress, skipping duplicate call');
      return;
    }

    logger.debug('Refreshing authentication state from storage');
    set({ isLoading: true, error: null, isRefreshing: true });

    try {
      // Check if token exists and get its age
      const token = await authService.getAuthToken();

      if (!token) {
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      // Token exists, check if expired by age
      const tokenAge = await authService.getTokenAge();
      const isExpired = await authService.isTokenExpired();
      logger.debug('Auth token age check complete', { tokenAge, isExpired });

      if (isExpired) {
        logger.warn('Stored TrainingPeaks token expired by age, clearing');
        await authService.clearAuth();
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
          isRefreshing: false,
        });
      } else {
        set({
          isAuthenticated: true,
          token: token,
          tokenAge: tokenAge,
          isLoading: false,
          isRefreshing: false,
          error: null,
        });
      }
    } catch (error) {
      logger.error('Error refreshing auth state:', error);
      set({
        isLoading: false,
        isRefreshing: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check authentication',
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

  // Update auth state without modifying storage
  // Used by storage listener to sync UI with storage changes made by background
  setAuthState: (
    isAuthenticated: boolean,
    token: string | null,
    tokenAge: number | null
  ) => {
    logger.debug('Syncing auth state from storage listener');
    set({ isAuthenticated, token, tokenAge, error: null });
  },
}));

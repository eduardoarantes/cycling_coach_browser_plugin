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

  // Refresh authentication (optimistic check - no API validation)
  // API validation happens lazily when user actually fetches data
  refreshAuth: async () => {
    console.log('[authStore] refreshAuth() called');
    set({ isLoading: true, error: null });

    try {
      // Check if token exists and get its age
      const token = await authService.getAuthToken();
      console.log(
        '[authStore] Token from storage:',
        token
          ? `${token.substring(0, 20)}... (length: ${token.length})`
          : 'NULL'
      );

      if (!token) {
        // No token, set as not authenticated
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

      // Token exists, check if expired by age
      const tokenAge = await authService.getTokenAge();
      const isExpired = await authService.isTokenExpired();
      console.log('[authStore] Token age:', tokenAge, 'ms');
      console.log('[authStore] Token expired:', isExpired);

      if (isExpired) {
        // Token is too old, clear it
        console.log('[authStore] ⏰ Token expired by age, clearing...');
        await authService.clearAuth();
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
        });
      } else {
        // Token exists and is not expired - optimistically trust it
        // API validation will happen when user actually tries to fetch data
        console.log(
          '[authStore] ✅ Token exists and not expired, setting isAuthenticated=true (optimistic)'
        );
        set({
          isAuthenticated: true,
          token: token,
          tokenAge: tokenAge,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('[authStore] Error in refreshAuth:', error);
      set({
        isLoading: false,
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
}));

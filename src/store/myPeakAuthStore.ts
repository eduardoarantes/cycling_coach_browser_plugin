/**
 * Zustand store for MyPeak authentication state
 */

import { create } from 'zustand';
import * as myPeakAuthService from '@/services/myPeakAuthService';

interface MyPeakAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  tokenAge: number | null;
  isRefreshing: boolean;

  refreshAuth: () => Promise<void>;
  validateAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
  setError: (error: string | null) => void;
  setAuthState: (
    isAuthenticated: boolean,
    token: string | null,
    tokenAge: number | null
  ) => void;
}

export const useMyPeakAuthStore = create<MyPeakAuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  error: null,
  token: null,
  tokenAge: null,
  isRefreshing: false,

  refreshAuth: async () => {
    if (get().isRefreshing) {
      return;
    }

    set({ isLoading: true, isRefreshing: true, error: null });

    try {
      const token = await myPeakAuthService.getAuthToken();

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

      const tokenAge = await myPeakAuthService.getTokenAge();
      const isExpired = await myPeakAuthService.isTokenExpired();

      if (isExpired) {
        await myPeakAuthService.clearAuth();
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
          isRefreshing: false,
        });
        return;
      }

      set({
        isAuthenticated: true,
        token,
        tokenAge,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        isRefreshing: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check PlanMyPeak authentication',
      });
    }
  },

  validateAuth: async () => {
    set({ isLoading: true, error: null });

    try {
      const hasToken = await myPeakAuthService.isAuthenticated();
      if (!hasToken) {
        set({
          isAuthenticated: false,
          token: null,
          tokenAge: null,
          isLoading: false,
        });
        return;
      }

      const isValid = await myPeakAuthService.validateToken();

      if (!isValid) {
        const token = await myPeakAuthService.getAuthToken();
        const tokenAge = await myPeakAuthService.getTokenAge();
        set({
          isAuthenticated: false,
          token,
          tokenAge,
          isLoading: false,
          error: token
            ? 'PlanMyPeak token present but validation failed'
            : 'PlanMyPeak authentication token missing',
        });
        return;
      }

      const token = await myPeakAuthService.getAuthToken();
      const tokenAge = await myPeakAuthService.getTokenAge();
      set({
        isAuthenticated: !!token,
        token,
        tokenAge,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to validate PlanMyPeak authentication',
      });
    }
  },

  clearAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      await myPeakAuthService.clearAuth();
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
            : 'Failed to clear PlanMyPeak authentication',
      });
    }
  },

  setError: (error: string | null) => set({ error }),

  setAuthState: (
    isAuthenticated: boolean,
    token: string | null,
    tokenAge: number | null
  ) => {
    set({ isAuthenticated, token, tokenAge, error: null });
  },
}));

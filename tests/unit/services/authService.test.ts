/**
 * Authentication service tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as authService from '@/services/authService';
import * as storageService from '@/services/storageService';

describe('authService', () => {
  beforeEach(async () => {
    await storageService.clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', async () => {
      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it('should return true when valid token exists', async () => {
      await authService.setAuthToken('valid-token');

      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(true);
    });
  });

  describe('setAuthToken', () => {
    it('should store token successfully', async () => {
      const testToken = 'test-bearer-token';

      await authService.setAuthToken(testToken);

      const token = await authService.getAuthToken();
      expect(token).toBe(testToken);
    });

    it('should reject empty token', async () => {
      await expect(authService.setAuthToken('')).rejects.toThrow(
        'Token cannot be empty'
      );
    });

    it('should reject whitespace-only token', async () => {
      await expect(authService.setAuthToken('   ')).rejects.toThrow(
        'Token cannot be empty'
      );
    });
  });

  describe('getAuthToken', () => {
    it('should return null when not authenticated', async () => {
      const token = await authService.getAuthToken();
      expect(token).toBeNull();
    });

    it('should return stored token', async () => {
      const testToken = 'my-auth-token';
      await authService.setAuthToken(testToken);

      const token = await authService.getAuthToken();
      expect(token).toBe(testToken);
    });
  });

  describe('getTokenAge', () => {
    it('should return null when no token exists', async () => {
      const age = await authService.getTokenAge();
      expect(age).toBeNull();
    });

    it('should return age in milliseconds', async () => {
      // The clock is controlled rather than slept through: a real `setTimeout`
      // is free to fire a fraction early, and `Date.now()` has millisecond
      // granularity, so sleeping 10ms and asserting an age of at least 10
      // fails intermittently for reasons that say nothing about this code.
      const storedAt = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(storedAt);
      await authService.setAuthToken('token-with-age');

      vi.spyOn(Date, 'now').mockReturnValue(storedAt + 250);

      expect(await authService.getTokenAge()).toBe(250);
    });

    it('should report an age of zero for a token stored this instant', async () => {
      const storedAt = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(storedAt);
      await authService.setAuthToken('token-with-age');

      // Zero is a real answer, distinct from the null that means "no token".
      expect(await authService.getTokenAge()).toBe(0);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no token exists', async () => {
      const expired = await authService.isTokenExpired();
      expect(expired).toBe(true);
    });

    it('should return false for fresh token', async () => {
      await authService.setAuthToken('fresh-token');

      const expired = await authService.isTokenExpired();
      expect(expired).toBe(false);
    });

    it('should return true for expired token', async () => {
      // Set token with old timestamp (25 hours ago)
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      await chrome.storage.local.set({
        auth_token: 'old-token',
        token_timestamp: oldTimestamp,
      });

      const expired = await authService.isTokenExpired();
      expect(expired).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should remove authentication', async () => {
      await authService.setAuthToken('token-to-clear');
      expect(await authService.isAuthenticated()).toBe(true);

      await authService.clearAuth();

      expect(await authService.isAuthenticated()).toBe(false);
      expect(await authService.getAuthToken()).toBeNull();
    });
  });
});

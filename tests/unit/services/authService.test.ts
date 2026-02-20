/**
 * Authentication service tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from '@/services/authService';
import * as storageService from '@/services/storageService';

describe('authService', () => {
  beforeEach(async () => {
    await storageService.clearToken();
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
      await authService.setAuthToken('token-with-age');

      // Small delay to ensure some time has passed
      await new Promise((resolve) => setTimeout(resolve, 10));

      const age = await authService.getTokenAge();
      expect(age).toBeGreaterThanOrEqual(10);
      expect(age).toBeLessThan(1000); // Should be very recent
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

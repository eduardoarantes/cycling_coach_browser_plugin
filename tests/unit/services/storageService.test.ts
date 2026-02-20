/**
 * Storage service tests
 */

import { describe, it, expect } from 'vitest';
import * as storageService from '@/services/storageService';

describe('storageService', () => {
  describe('setToken', () => {
    it('should store token with timestamp', async () => {
      const testToken = 'test-bearer-token-123';

      await storageService.setToken(testToken);

      const retrieved = await storageService.getToken();
      expect(retrieved).toBe(testToken);
    });
  });

  describe('getToken', () => {
    it('should return null when no token stored', async () => {
      const token = await storageService.getToken();
      expect(token).toBeNull();
    });

    it('should return stored token', async () => {
      const testToken = 'my-test-token';
      await storageService.setToken(testToken);

      const token = await storageService.getToken();
      expect(token).toBe(testToken);
    });
  });

  describe('getTokenWithTimestamp', () => {
    it('should return token and timestamp', async () => {
      const testToken = 'token-with-timestamp';
      const beforeTime = Date.now();

      await storageService.setToken(testToken);
      const result = await storageService.getTokenWithTimestamp();

      const afterTime = Date.now();

      expect(result.auth_token).toBe(testToken);
      expect(result.token_timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.token_timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should return nulls when no data stored', async () => {
      const result = await storageService.getTokenWithTimestamp();

      expect(result.auth_token).toBeNull();
      expect(result.token_timestamp).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('should remove stored token', async () => {
      await storageService.setToken('token-to-clear');

      await storageService.clearToken();

      const token = await storageService.getToken();
      expect(token).toBeNull();
    });
  });

  describe('hasToken', () => {
    it('should return false when no token', async () => {
      const has = await storageService.hasToken();
      expect(has).toBe(false);
    });

    it('should return true when token exists', async () => {
      await storageService.setToken('exists');

      const has = await storageService.hasToken();
      expect(has).toBe(true);
    });

    it('should return false for empty string token', async () => {
      await chrome.storage.local.set({ auth_token: '' });

      const has = await storageService.hasToken();
      expect(has).toBe(false);
    });
  });
});

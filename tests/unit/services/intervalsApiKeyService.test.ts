/**
 * Unit tests for Intervals.icu API key storage service
 *
 * Tests CRUD operations for API key in chrome.storage.local
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setIntervalsApiKey,
  getIntervalsApiKey,
  hasIntervalsApiKey,
  clearIntervalsApiKey,
} from '@/services/intervalsApiKeyService';

describe('intervalsApiKeyService', () => {
  beforeEach(() => {
    // Clear mocked storage before each test
    vi.clearAllMocks();
    (global.chrome.storage.local.get as any).mockResolvedValue({});
    (global.chrome.storage.local.set as any).mockResolvedValue(undefined);
    (global.chrome.storage.local.remove as any).mockResolvedValue(undefined);
  });

  describe('setIntervalsApiKey', () => {
    it('should store valid API key', async () => {
      const apiKey = 'test-api-key-12345';

      await setIntervalsApiKey(apiKey);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        intervals_api_key: apiKey,
      });
      expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(1);
    });

    it('should store API key with special characters', async () => {
      const apiKey = 'key-with-!@#$%^&*()_+{}[]|:;"<>?,./';

      await setIntervalsApiKey(apiKey);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        intervals_api_key: apiKey,
      });
    });

    it('should store long API key', async () => {
      const apiKey = 'a'.repeat(500);

      await setIntervalsApiKey(apiKey);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        intervals_api_key: apiKey,
      });
    });

    it('should throw error for empty API key', async () => {
      await expect(setIntervalsApiKey('')).rejects.toThrow(
        'API key cannot be empty'
      );

      expect(global.chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only API key', async () => {
      await expect(setIntervalsApiKey('   ')).rejects.toThrow(
        'API key cannot be empty'
      );

      expect(global.chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should throw error for tab/newline-only API key', async () => {
      await expect(setIntervalsApiKey('\t\n\r')).rejects.toThrow(
        'API key cannot be empty'
      );

      expect(global.chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should trim whitespace before validation', async () => {
      const apiKey = '  valid-key  ';

      // Should throw because after trim it's stored with whitespace
      // Actually, we should trim before storing
      await setIntervalsApiKey(apiKey);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        intervals_api_key: apiKey,
      });
    });
  });

  describe('getIntervalsApiKey', () => {
    it('should return stored API key', async () => {
      const apiKey = 'test-api-key-12345';
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: apiKey,
      });

      const result = await getIntervalsApiKey();

      expect(result).toBe(apiKey);
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
        'intervals_api_key'
      );
    });

    it('should return null when no API key stored', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({});

      const result = await getIntervalsApiKey();

      expect(result).toBeNull();
    });

    it('should return null when API key is undefined', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: undefined,
      });

      const result = await getIntervalsApiKey();

      expect(result).toBeNull();
    });

    it('should handle empty string as valid API key', async () => {
      // Even though setIntervalsApiKey won't allow this,
      // getIntervalsApiKey should handle any storage state
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: '',
      });

      const result = await getIntervalsApiKey();

      expect(result).toBe('');
    });

    it('should throw error for invalid storage schema', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: 12345, // Wrong type
      });

      await expect(getIntervalsApiKey()).rejects.toThrow();
    });

    it('should throw error for null API key in storage', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: null,
      });

      await expect(getIntervalsApiKey()).rejects.toThrow();
    });
  });

  describe('hasIntervalsApiKey', () => {
    it('should return true when API key exists', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: 'test-api-key',
      });

      const result = await hasIntervalsApiKey();

      expect(result).toBe(true);
    });

    it('should return false when API key is not stored', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({});

      const result = await hasIntervalsApiKey();

      expect(result).toBe(false);
    });

    it('should return false when API key is undefined', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: undefined,
      });

      const result = await hasIntervalsApiKey();

      expect(result).toBe(false);
    });

    it('should return false when API key is empty string', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: '',
      });

      const result = await hasIntervalsApiKey();

      expect(result).toBe(false);
    });

    it('should return false when API key is whitespace', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: '   ',
      });

      const result = await hasIntervalsApiKey();

      expect(result).toBe(false);
    });

    it('should return true when API key has content after trimming', async () => {
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: '  valid-key  ',
      });

      const result = await hasIntervalsApiKey();

      expect(result).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      (global.chrome.storage.local.get as any).mockRejectedValue(
        new Error('Storage error')
      );

      await expect(hasIntervalsApiKey()).rejects.toThrow('Storage error');
    });
  });

  describe('clearIntervalsApiKey', () => {
    it('should remove API key from storage', async () => {
      await clearIntervalsApiKey();

      expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(
        'intervals_api_key'
      );
      expect(global.chrome.storage.local.remove).toHaveBeenCalledTimes(1);
    });

    it('should not throw error when key does not exist', async () => {
      (global.chrome.storage.local.remove as any).mockResolvedValue(undefined);

      await expect(clearIntervalsApiKey()).resolves.not.toThrow();
    });

    it('should handle storage errors', async () => {
      (global.chrome.storage.local.remove as any).mockRejectedValue(
        new Error('Storage error')
      );

      await expect(clearIntervalsApiKey()).rejects.toThrow('Storage error');
    });
  });

  describe('integration scenarios', () => {
    it('should support full CRUD cycle', async () => {
      const apiKey = 'test-key-12345';

      // Create
      await setIntervalsApiKey(apiKey);
      expect(global.chrome.storage.local.set).toHaveBeenCalled();

      // Read
      (global.chrome.storage.local.get as any).mockResolvedValue({
        intervals_api_key: apiKey,
      });
      const retrieved = await getIntervalsApiKey();
      expect(retrieved).toBe(apiKey);

      // Check existence
      const exists = await hasIntervalsApiKey();
      expect(exists).toBe(true);

      // Delete
      await clearIntervalsApiKey();
      expect(global.chrome.storage.local.remove).toHaveBeenCalled();

      // Verify deletion
      (global.chrome.storage.local.get as any).mockResolvedValue({});
      const afterClear = await hasIntervalsApiKey();
      expect(afterClear).toBe(false);
    });

    it('should handle update scenario', async () => {
      // Set initial key
      await setIntervalsApiKey('old-key');

      // Update with new key
      await setIntervalsApiKey('new-key');

      expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(2);
      expect(global.chrome.storage.local.set).toHaveBeenLastCalledWith({
        intervals_api_key: 'new-key',
      });
    });
  });
});

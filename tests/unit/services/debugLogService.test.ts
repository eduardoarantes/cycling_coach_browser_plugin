/**
 * Debug log service tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as debugLogService from '@/services/debugLogService';
import { STORAGE_KEYS } from '@/utils/constants';
import type { ApiLogEntry } from '@/types/debugLog.types';

// Mock chrome.runtime.getManifest
beforeEach(() => {
  vi.spyOn(chrome.runtime, 'getManifest').mockReturnValue({
    version: '1.11.71',
    manifest_version: 3,
    name: 'Test Extension',
  });
});

describe('debugLogService', () => {
  const createValidEntry = (
    overrides?: Partial<Omit<ApiLogEntry, 'id'>>
  ): Omit<ApiLogEntry, 'id'> => ({
    timestamp: Date.now(),
    endpoint: '/users/v3/user',
    method: 'GET',
    baseUrl: 'https://tpapi.trainingpeaks.com',
    status: 200,
    success: true,
    durationMs: 150,
    operationName: 'user profile',
    ...overrides,
  });

  describe('addLog', () => {
    it('should add a log entry and return it with generated id', async () => {
      const entry = createValidEntry();

      const result = await debugLogService.addLog(entry);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^\d+-[a-z0-9]+$/);
      expect(result.endpoint).toBe(entry.endpoint);
      expect(result.success).toBe(true);
    });

    it('should store log entry in chrome storage', async () => {
      const entry = createValidEntry();

      await debugLogService.addLog(entry);

      const logs = await debugLogService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].endpoint).toBe(entry.endpoint);
    });

    it('should prepend new entries (newest first)', async () => {
      const entry1 = createValidEntry({ operationName: 'first' });
      const entry2 = createValidEntry({ operationName: 'second' });

      await debugLogService.addLog(entry1);
      await debugLogService.addLog(entry2);

      const logs = await debugLogService.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].operationName).toBe('second');
      expect(logs[1].operationName).toBe('first');
    });

    it('should prune logs to max 100 entries', async () => {
      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        await debugLogService.addLog(
          createValidEntry({ operationName: `entry-${i}` })
        );
      }

      const logs = await debugLogService.getLogs();
      expect(logs).toHaveLength(100);
      // Newest entry should be at index 0
      expect(logs[0].operationName).toBe('entry-104');
    });

    it('should handle failed log entry', async () => {
      const entry = createValidEntry({
        success: false,
        status: 401,
        errorMessage: 'Unauthorized',
        errorCode: 'NO_TOKEN',
      });

      const result = await debugLogService.addLog(entry);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Unauthorized');
      expect(result.errorCode).toBe('NO_TOKEN');
    });

    it('should handle network error entry with null status', async () => {
      const entry = createValidEntry({
        success: false,
        status: null,
        errorMessage: 'Network error',
      });

      const result = await debugLogService.addLog(entry);

      expect(result.status).toBeNull();
      expect(result.success).toBe(false);
    });
  });

  describe('getLogs', () => {
    it('should return empty array when no logs exist', async () => {
      const logs = await debugLogService.getLogs();
      expect(logs).toEqual([]);
    });

    it('should return stored logs', async () => {
      await debugLogService.addLog(createValidEntry());
      await debugLogService.addLog(createValidEntry());

      const logs = await debugLogService.getLogs();
      expect(logs).toHaveLength(2);
    });

    it('should return empty array for invalid data in storage', async () => {
      // Directly set invalid data in storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.TRAININGPEAKS_API_LOGS]: 'not an array',
      });

      const logs = await debugLogService.getLogs();
      expect(logs).toEqual([]);
    });

    it('should return empty array when logs fail validation', async () => {
      // Directly set invalid log entry in storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.TRAININGPEAKS_API_LOGS]: [{ invalid: true }],
      });

      const logs = await debugLogService.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('clearLogs', () => {
    it('should remove all logs from storage', async () => {
      await debugLogService.addLog(createValidEntry());
      await debugLogService.addLog(createValidEntry());

      await debugLogService.clearLogs();

      const logs = await debugLogService.getLogs();
      expect(logs).toEqual([]);
    });

    it('should not throw when no logs exist', async () => {
      await expect(debugLogService.clearLogs()).resolves.not.toThrow();
    });
  });

  describe('exportLogsAsJson', () => {
    it('should return export object with metadata', async () => {
      await debugLogService.addLog(createValidEntry());

      const exportData = await debugLogService.exportLogsAsJson();

      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.extensionVersion).toBe('1.11.71');
      expect(exportData.logCount).toBe(1);
      expect(exportData.logs).toHaveLength(1);
    });

    it('should return valid ISO datetime for exportedAt', async () => {
      const exportData = await debugLogService.exportLogsAsJson();

      // Validate ISO datetime format
      expect(new Date(exportData.exportedAt).toISOString()).toBe(
        exportData.exportedAt
      );
    });

    it('should return empty logs array when no logs exist', async () => {
      const exportData = await debugLogService.exportLogsAsJson();

      expect(exportData.logCount).toBe(0);
      expect(exportData.logs).toEqual([]);
    });

    it('should include all log entries in export', async () => {
      await debugLogService.addLog(createValidEntry({ operationName: 'op1' }));
      await debugLogService.addLog(createValidEntry({ operationName: 'op2' }));
      await debugLogService.addLog(createValidEntry({ operationName: 'op3' }));

      const exportData = await debugLogService.exportLogsAsJson();

      expect(exportData.logCount).toBe(3);
      expect(exportData.logs).toHaveLength(3);
    });

    it('should handle missing manifest gracefully', async () => {
      vi.spyOn(chrome.runtime, 'getManifest').mockImplementation(() => {
        throw new Error('No manifest');
      });

      const exportData = await debugLogService.exportLogsAsJson();

      expect(exportData.extensionVersion).toBe('unknown');
    });
  });
});

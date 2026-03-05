/**
 * Debug log schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  ApiLogEntrySchema,
  ApiLogEntriesSchema,
  ApiLogsExportSchema,
} from '@/schemas/debugLog.schema';

describe('ApiLogEntrySchema', () => {
  const validEntry = {
    id: '1709654321000-abc123',
    timestamp: 1709654321000,
    endpoint: '/users/v3/user',
    method: 'GET' as const,
    baseUrl: 'https://tpapi.trainingpeaks.com',
    status: 200,
    success: true,
    durationMs: 150,
    operationName: 'user profile',
  };

  it('should validate a successful API log entry', () => {
    const result = ApiLogEntrySchema.parse(validEntry);
    expect(result).toEqual(validEntry);
  });

  it('should validate an entry with null status (network error)', () => {
    const networkErrorEntry = {
      ...validEntry,
      status: null,
      success: false,
      errorMessage: 'Network error',
    };

    const result = ApiLogEntrySchema.parse(networkErrorEntry);
    expect(result.status).toBeNull();
    expect(result.success).toBe(false);
  });

  it('should validate an entry with error code', () => {
    const errorEntry = {
      ...validEntry,
      success: false,
      errorMessage: 'Not authenticated',
      errorCode: 'NO_TOKEN',
    };

    const result = ApiLogEntrySchema.parse(errorEntry);
    expect(result.errorCode).toBe('NO_TOKEN');
    expect(result.errorMessage).toBe('Not authenticated');
  });

  it('should reject entry missing required id', () => {
    const invalidEntry = { ...validEntry };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (invalidEntry as any).id;

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with empty id', () => {
    const invalidEntry = { ...validEntry, id: '' };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with invalid timestamp', () => {
    const invalidEntry = { ...validEntry, timestamp: -1 };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with invalid method', () => {
    const invalidEntry = { ...validEntry, method: 'POST' };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with invalid baseUrl', () => {
    const invalidEntry = { ...validEntry, baseUrl: 'not-a-url' };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with negative duration', () => {
    const invalidEntry = { ...validEntry, durationMs: -100 };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with empty endpoint', () => {
    const invalidEntry = { ...validEntry, endpoint: '' };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });

  it('should reject entry with empty operationName', () => {
    const invalidEntry = { ...validEntry, operationName: '' };

    expect(() => ApiLogEntrySchema.parse(invalidEntry)).toThrow();
  });
});

describe('ApiLogEntriesSchema', () => {
  const validEntry = {
    id: '1709654321000-abc123',
    timestamp: 1709654321000,
    endpoint: '/users/v3/user',
    method: 'GET' as const,
    baseUrl: 'https://tpapi.trainingpeaks.com',
    status: 200,
    success: true,
    durationMs: 150,
    operationName: 'user profile',
  };

  it('should validate empty array', () => {
    const result = ApiLogEntriesSchema.parse([]);
    expect(result).toEqual([]);
  });

  it('should validate array with single entry', () => {
    const result = ApiLogEntriesSchema.parse([validEntry]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validEntry);
  });

  it('should validate array with multiple entries', () => {
    const entries = [
      validEntry,
      { ...validEntry, id: '1709654322000-def456', timestamp: 1709654322000 },
    ];

    const result = ApiLogEntriesSchema.parse(entries);
    expect(result).toHaveLength(2);
  });

  it('should reject non-array', () => {
    expect(() => ApiLogEntriesSchema.parse(validEntry)).toThrow();
  });

  it('should reject array with invalid entry', () => {
    const entries = [validEntry, { invalidField: true }];

    expect(() => ApiLogEntriesSchema.parse(entries)).toThrow();
  });
});

describe('ApiLogsExportSchema', () => {
  const validEntry = {
    id: '1709654321000-abc123',
    timestamp: 1709654321000,
    endpoint: '/users/v3/user',
    method: 'GET' as const,
    baseUrl: 'https://tpapi.trainingpeaks.com',
    status: 200,
    success: true,
    durationMs: 150,
    operationName: 'user profile',
  };

  const validExport = {
    exportedAt: '2024-03-05T12:00:00.000Z',
    extensionVersion: '1.11.71',
    logCount: 1,
    logs: [validEntry],
  };

  it('should validate a complete export object', () => {
    const result = ApiLogsExportSchema.parse(validExport);
    expect(result).toEqual(validExport);
  });

  it('should validate export with empty logs', () => {
    const emptyExport = {
      ...validExport,
      logCount: 0,
      logs: [],
    };

    const result = ApiLogsExportSchema.parse(emptyExport);
    expect(result.logs).toHaveLength(0);
    expect(result.logCount).toBe(0);
  });

  it('should reject export with invalid datetime', () => {
    const invalidExport = {
      ...validExport,
      exportedAt: 'not-a-datetime',
    };

    expect(() => ApiLogsExportSchema.parse(invalidExport)).toThrow();
  });

  it('should reject export with negative logCount', () => {
    const invalidExport = {
      ...validExport,
      logCount: -1,
    };

    expect(() => ApiLogsExportSchema.parse(invalidExport)).toThrow();
  });

  it('should reject export missing required fields', () => {
    const invalidExport = {
      logs: [validEntry],
    };

    expect(() => ApiLogsExportSchema.parse(invalidExport)).toThrow();
  });
});

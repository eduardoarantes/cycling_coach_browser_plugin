import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: loggerMocks.error,
    warn: loggerMocks.warn,
  },
}));

import {
  isExpectedAuthError,
  logApiResponseError,
  logErrorWithAuthDowngrade,
} from '@/utils/apiErrorLogging';

describe('apiErrorLogging', () => {
  beforeEach(() => {
    loggerMocks.error.mockReset();
    loggerMocks.warn.mockReset();
  });

  describe('isExpectedAuthError', () => {
    it('returns true for 401 status', () => {
      expect(
        isExpectedAuthError({ message: 'Unauthorized', status: 401 })
      ).toBe(true);
    });

    it('returns true for not authenticated message', () => {
      expect(isExpectedAuthError({ message: 'Not authenticated' })).toBe(true);
      expect(isExpectedAuthError(new Error('HTTP 401'))).toBe(true);
    });

    it('returns false for non-auth errors', () => {
      expect(
        isExpectedAuthError({ message: 'Internal Server Error', status: 500 })
      ).toBe(false);
    });
  });

  describe('logApiResponseError', () => {
    it('uses warn for expected auth errors', () => {
      logApiResponseError('Failed to fetch libraries:', {
        message: 'Not authenticated',
        code: 'NO_TOKEN',
      });

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        'Failed to fetch libraries:',
        'Not authenticated'
      );
      expect(loggerMocks.error).not.toHaveBeenCalled();
    });

    it('uses error for non-auth errors', () => {
      logApiResponseError('Failed to fetch libraries:', {
        message: 'HTTP 500',
        status: 500,
      });

      expect(loggerMocks.error).toHaveBeenCalledWith(
        'Failed to fetch libraries:',
        'HTTP 500'
      );
      expect(loggerMocks.warn).not.toHaveBeenCalled();
    });
  });

  describe('logErrorWithAuthDowngrade', () => {
    it('uses warn for auth-like thrown errors', () => {
      logErrorWithAuthDowngrade('Export failed:', new Error('HTTP 401'));

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        'Export failed:',
        expect.any(Error)
      );
      expect(loggerMocks.error).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';

describe('queryClient', () => {
  it('should be an instance of QueryClient', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  describe('default query options', () => {
    const defaultOptions = queryClient.getDefaultOptions();

    it('should have staleTime set to 5 minutes', () => {
      expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000);
    });

    it('should have gcTime set to 10 minutes', () => {
      expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000);
    });

    it('should have retry set to 2', () => {
      expect(defaultOptions.queries?.retry).toBe(2);
    });

    it('should have refetchOnWindowFocus enabled', () => {
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
    });

    it('should have refetchOnReconnect enabled', () => {
      expect(defaultOptions.queries?.refetchOnReconnect).toBe(true);
    });

    it('should have refetchOnMount disabled', () => {
      expect(defaultOptions.queries?.refetchOnMount).toBe(false);
    });

    it('should have throwOnError disabled', () => {
      expect(defaultOptions.queries?.throwOnError).toBe(false);
    });

    it('should have retryDelay function', () => {
      expect(defaultOptions.queries?.retryDelay).toBeTypeOf('function');
    });

    it('should implement exponential backoff for retryDelay', () => {
      const retryDelay = defaultOptions.queries?.retryDelay as (
        attemptIndex: number
      ) => number;

      // First retry: 2^0 * 1000 = 1000ms
      expect(retryDelay(0)).toBe(1000);

      // Second retry: 2^1 * 1000 = 2000ms
      expect(retryDelay(1)).toBe(2000);

      // Third retry: 2^2 * 1000 = 4000ms
      expect(retryDelay(2)).toBe(4000);

      // Large attempt should cap at 30000ms
      expect(retryDelay(10)).toBe(30000);
    });
  });
});

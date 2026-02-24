import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import type { ApiResponse } from '@/types/api.types';
import type { TrainingPlan } from '@/types/api.types';
import type { ReactNode, ReactElement } from 'react';

// Test wrapper provider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTrainingPlans', () => {
  beforeEach(() => {
    // Mock chrome.runtime.sendMessage
    global.chrome = {
      runtime: {
        sendMessage: vi.fn(),
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetching', () => {
    it('should fetch and return training plans data', async () => {
      const mockPlans: TrainingPlan[] = [
        {
          id: 624432,
          name: 'Full Distance Triathlon',
          athleteFirstName: 'John',
          athleteLastName: 'Doe',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
        {
          id: 624433,
          name: 'Marathon Training',
          athleteFirstName: 'Jane',
          athleteLastName: 'Smith',
          startDate: '2024-02-01',
          endDate: '2024-08-31',
        },
      ];

      const mockResponse: ApiResponse<TrainingPlan[]> = {
        success: true,
        data: mockPlans,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();

      // Wait for success
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockPlans);
      expect(result.current.error).toBeNull();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_TRAINING_PLANS',
      });
    });

    it('should return empty array when no plans exist', async () => {
      const mockResponse: ApiResponse<TrainingPlan[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it('should use cached data on subsequent renders', async () => {
      const mockPlans: TrainingPlan[] = [
        {
          id: 111,
          name: 'Cached Plan',
          athleteFirstName: 'Cache',
          athleteLastName: 'Test',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      // Create a single wrapper to share the same QueryClient
      // Set staleTime so data stays fresh
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 10 * 60 * 1000, // 10 minutes
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      // First render
      const { result: result1 } = renderHook(() => useTrainingPlans(), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      // Clear mock to check cache behavior (ignore initial calls from strict mode)
      const messageHandler = chrome.runtime.sendMessage as ReturnType<
        typeof vi.fn
      >;
      messageHandler.mockClear();

      // Second render with same wrapper (should use cache)
      const { result: result2, unmount } = renderHook(
        () => useTrainingPlans(),
        { wrapper }
      );

      // Should immediately have data from cache
      await waitFor(() => {
        expect(result2.current.data).toEqual(mockPlans);
      });

      expect(result2.current.isLoading).toBe(false);

      // Should NOT have made any new API calls (using cache)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(0);

      unmount();
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const mockErrorResponse: ApiResponse<TrainingPlan[]> = {
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'AUTH_ERROR',
          statusCode: 401,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
        mockErrorResponse
      );

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Unauthorized');
    });

    it('should handle network errors', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Network failure')
      );

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Network failure');
    });

    it('should support manual refetch after error', async () => {
      // First call fails
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      // Second call succeeds
      const mockPlans: TrainingPlan[] = [
        {
          id: 999,
          name: 'Recovered Plan',
          athleteFirstName: 'Retry',
          athleteLastName: 'Success',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      // Manually refetch
      result.current.refetch();

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toEqual(mockPlans);
    });
  });

  describe('conditional fetching', () => {
    it('should not fetch when enabled is false', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(
        () => useTrainingPlans({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not be loading since query is disabled
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();

      // Wait to confirm no API call was made
      await waitFor(() => {
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });
    });

    it('should fetch when enabled changes to true', async () => {
      const mockPlans: TrainingPlan[] = [
        {
          id: 555,
          name: 'Conditional Plan',
          athleteFirstName: 'Enable',
          athleteLastName: 'Test',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useTrainingPlans({ enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: false },
        }
      );

      // Initially disabled - no fetch
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

      // Enable the query
      rerender({ enabled: true });

      // Should now fetch
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPlans);
      // Should have been called (may be called more than once in strict mode)
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('query configuration', () => {
    it('should use correct query key', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useTrainingPlans(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the hook was called correctly
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_TRAINING_PLANS',
      });
    });

    it('should have retry set to 1', async () => {
      // Mock API to fail once then succeed
      vi.mocked(chrome.runtime.sendMessage)
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({
          success: true,
          data: [
            {
              id: 1,
              name: 'Test Plan',
              athleteFirstName: 'Test',
              athleteLastName: 'User',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
          ],
        });

      const { result } = renderHook(() => useTrainingPlans(), {
        wrapper: createWrapper(),
      });

      // Wait for final state (should succeed after 1 retry)
      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 5000 }
      );

      // Should have been called twice (initial + 1 retry)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });
  });
});

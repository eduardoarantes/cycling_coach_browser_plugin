import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useRxBuilderWorkouts } from '@/hooks/useRxBuilderWorkouts';
import type { ApiResponse } from '@/types/api.types';
import type { RxBuilderWorkout } from '@/types/api.types';
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

describe('useRxBuilderWorkouts', () => {
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
    it('should fetch and return RxBuilder workouts data', async () => {
      const planId = 624432;
      const mockWorkouts: RxBuilderWorkout[] = [
        {
          id: '16628629',
          calendarId: 6240625,
          title: 'Strength Workout #1',
          instructions: null,
          prescribedDate: '2026-03-04',
          prescribedStartTime: null,
          startDateTime: null,
          completedDateTime: null,
          orderOnDay: 1,
          workoutType: 'StructuredStrength',
          workoutSubTypeId: null,
          isLocked: false,
          isHidden: false,
          totalBlocks: 3,
          completedBlocks: 0,
          totalPrescriptions: 4,
          completedPrescriptions: 0,
          totalSets: 10,
          completedSets: 0,
          compliancePercent: 0.0,
          sequenceSummary: [
            {
              sequenceOrder: 'A',
              title: 'Warm Up',
              compliancePercent: 0.0,
            },
            {
              sequenceOrder: 'B',
              title: '90-90 to Lunge',
              compliancePercent: 0.0,
            },
          ],
          rpe: null,
          feel: null,
          prescribedDurationInSeconds: null,
          executedDurationInSeconds: null,
          lastUpdatedAt: '2026-02-22T01:49:34',
        },
        {
          id: '16630274',
          calendarId: 6240625,
          title: 'Strength Workout #2',
          instructions: 'This is the instructions',
          prescribedDate: '2026-02-25',
          prescribedStartTime: null,
          startDateTime: null,
          completedDateTime: null,
          orderOnDay: null,
          workoutType: 'StructuredStrength',
          workoutSubTypeId: null,
          isLocked: false,
          isHidden: false,
          totalBlocks: 3,
          completedBlocks: 0,
          totalPrescriptions: 4,
          completedPrescriptions: 0,
          totalSets: 10,
          completedSets: 0,
          compliancePercent: 0.0,
          sequenceSummary: [
            {
              sequenceOrder: 'A',
              title: '90-90 to Lunge',
              compliancePercent: 0.0,
            },
            {
              sequenceOrder: 'B1',
              title: 'Ab Wheel',
              compliancePercent: 0.0,
            },
          ],
          rpe: null,
          feel: null,
          prescribedDurationInSeconds: null,
          executedDurationInSeconds: null,
          lastUpdatedAt: '2026-02-22T02:45:31',
        },
      ];

      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: mockWorkouts,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
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
      expect(result.current.data).toEqual(mockWorkouts);
      expect(result.current.error).toBeNull();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_RX_BUILDER_WORKOUTS',
        planId: planId,
      });
    });

    it('should return empty array when plan has no RxBuilder workouts', async () => {
      const planId = 999;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it('should use cached data for same planId', async () => {
      const planId = 624432;
      const mockWorkouts: RxBuilderWorkout[] = [
        {
          id: '12345',
          calendarId: 6240625,
          title: 'Cached Strength Workout',
          instructions: 'Test cache',
          prescribedDate: '2026-03-10',
          prescribedStartTime: null,
          startDateTime: null,
          completedDateTime: null,
          orderOnDay: 1,
          workoutType: 'StructuredStrength',
          workoutSubTypeId: null,
          isLocked: false,
          isHidden: false,
          totalBlocks: 2,
          completedBlocks: 0,
          totalPrescriptions: 3,
          completedPrescriptions: 0,
          totalSets: 8,
          completedSets: 0,
          compliancePercent: 0.0,
          sequenceSummary: [
            {
              sequenceOrder: 'A',
              title: 'Test Exercise',
              compliancePercent: 0.0,
            },
          ],
          rpe: null,
          feel: null,
          prescribedDurationInSeconds: null,
          executedDurationInSeconds: null,
          lastUpdatedAt: '2026-02-22T10:00:00',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockWorkouts,
      });

      // Create a single wrapper with staleTime to enable caching
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5000, // 5 seconds
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      // First render
      const { result: result1 } = renderHook(
        () => useRxBuilderWorkouts(planId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second render with same planId - should use cache
      const { result: result2 } = renderHook(
        () => useRxBuilderWorkouts(planId),
        { wrapper }
      );

      // Should be immediately available from cache
      expect(result2.current.data).toEqual(mockWorkouts);
      expect(result2.current.isLoading).toBe(false);

      // Should have only called sendMessage once (first render)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle API error response', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: false,
        error: {
          message: 'Failed to fetch RxBuilder workouts',
          code: 'API_ERROR',
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(
        'Failed to fetch RxBuilder workouts'
      );
    });

    it('should handle authentication error', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: false,
        error: {
          message: 'Not authenticated',
          code: 'NO_TOKEN',
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Not authenticated');
    });

    it('should handle network failure', async () => {
      const planId = 624432;

      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Network error');
    });

    it('should handle HTTP 401 error', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: false,
        error: {
          message: 'HTTP 401',
          status: 401,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('401');
    });
  });

  describe('conditional fetching', () => {
    it('should not fetch when enabled is false', async () => {
      const planId = 624432;

      const { result } = renderHook(
        () => useRxBuilderWorkouts(planId, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();

      // Should not have called API
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should fetch when enabled is explicitly true', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useRxBuilderWorkouts(planId, { enabled: true }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should fetch by default when enabled option is not provided', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('query key structure', () => {
    it('should use correct query key format', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useRxBuilderWorkouts(planId), { wrapper });

      await waitFor(() => {
        const queryData = queryClient.getQueryData([
          'plans',
          planId,
          'rxWorkouts',
        ]);
        expect(queryData).toBeDefined();
      });
    });
  });

  describe('refetch functionality', () => {
    it('should refetch data when refetch is called', async () => {
      const planId = 624432;
      const mockResponse: ApiResponse<RxBuilderWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRxBuilderWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Clear mock to track new calls
      vi.clearAllMocks();

      // Trigger refetch
      await result.current.refetch();

      // Should have called API again
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_RX_BUILDER_WORKOUTS',
        planId: planId,
      });
    });
  });
});

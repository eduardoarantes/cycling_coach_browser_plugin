import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import type { ApiResponse } from '@/types/api.types';
import type { PlanWorkout } from '@/types/api.types';
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

describe('usePlanWorkouts', () => {
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
    it('should fetch and return plan workouts data', async () => {
      const planId = 624432;
      const mockWorkouts: PlanWorkout[] = [
        {
          workoutId: 1001,
          workoutDay: '2024-06-03',
          workoutTypeValueId: 2,
          workoutType: 'Bike',
          title: 'Recovery Ride',
          description: 'Easy 60 minutes',
          coachComments: 'Keep it easy',
          totalTime: 3600,
          distance: null,
          tss: 45.5,
          totalTimePlanned: 3600,
          distancePlanned: null,
          tssPlanned: 45.5,
        },
        {
          workoutId: 1002,
          workoutDay: '2024-06-04',
          workoutTypeValueId: 2,
          workoutType: 'Bike',
          title: 'Threshold Intervals',
          description: '5x8 min @ FTP',
          coachComments: null,
          totalTime: 5400,
          distance: null,
          tss: 95.0,
          totalTimePlanned: 5400,
          distancePlanned: null,
          tssPlanned: 95.0,
        },
      ];

      const mockResponse: ApiResponse<PlanWorkout[]> = {
        success: true,
        data: mockWorkouts,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanWorkouts(planId), {
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
        type: 'GET_PLAN_WORKOUTS',
        planId: planId,
      });
    });

    it('should return empty array when plan has no workouts', async () => {
      const planId = 999;
      const mockResponse: ApiResponse<PlanWorkout[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanWorkouts(planId), {
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
      const mockWorkouts: PlanWorkout[] = [
        {
          workoutId: 777,
          workoutDay: '2024-06-05',
          workoutTypeValueId: 1,
          workoutType: 'Run',
          title: 'Cached Workout',
          description: 'Test cache',
          coachComments: null,
          totalTime: 1800,
          distance: null,
          tss: 30.0,
          totalTimePlanned: 1800,
          distancePlanned: null,
          tssPlanned: 30.0,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockWorkouts,
      });

      // Create a single wrapper with staleTime
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      // First render
      const { result: result1 } = renderHook(() => usePlanWorkouts(planId), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second render with same planId
      const { result: result2, unmount } = renderHook(
        () => usePlanWorkouts(planId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.data).toEqual(mockWorkouts);
      });

      // Should still only have called API once
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('should fetch different data for different planIds', async () => {
      const planId1 = 111;
      const planId2 = 222;

      const mockWorkouts1: PlanWorkout[] = [
        {
          workoutId: 1,
          workoutDay: '2024-06-01',
          workoutTypeValueId: 2,
          workoutType: 'Bike',
          title: 'Plan 1 Workout',
          description: 'First plan',
          coachComments: null,
          totalTime: 3600,
          distance: null,
          tss: 50.0,
          totalTimePlanned: 3600,
          distancePlanned: null,
          tssPlanned: 50.0,
        },
      ];

      const mockWorkouts2: PlanWorkout[] = [
        {
          workoutId: 2,
          workoutDay: '2024-06-01',
          workoutTypeValueId: 1,
          workoutType: 'Run',
          title: 'Plan 2 Workout',
          description: 'Second plan',
          coachComments: null,
          totalTime: 1800,
          distance: null,
          tss: 25.0,
          totalTimePlanned: 1800,
          distancePlanned: null,
          tssPlanned: 25.0,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage)
        .mockResolvedValueOnce({ success: true, data: mockWorkouts1 })
        .mockResolvedValueOnce({ success: true, data: mockWorkouts2 });

      const wrapper = createWrapper();

      // Fetch first plan
      const { result: result1 } = renderHook(() => usePlanWorkouts(planId1), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      expect(result1.current.data).toEqual(mockWorkouts1);

      // Fetch second plan
      const { result: result2 } = renderHook(() => usePlanWorkouts(planId2), {
        wrapper,
      });
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));
      expect(result2.current.data).toEqual(mockWorkouts2);

      // Should have made two separate API calls
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
        type: 'GET_PLAN_WORKOUTS',
        planId: planId1,
      });
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
        type: 'GET_PLAN_WORKOUTS',
        planId: planId2,
      });
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const planId = 624432;
      const mockErrorResponse: ApiResponse<PlanWorkout[]> = {
        success: false,
        error: {
          message: 'Plan not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
        mockErrorResponse
      );

      const { result } = renderHook(() => usePlanWorkouts(planId), {
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
      expect(result.current.error?.message).toBe('Plan not found');
    });

    it('should handle network errors', async () => {
      const planId = 624432;
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Connection timeout')
      );

      const { result } = renderHook(() => usePlanWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Connection timeout');
    });

    it('should support manual refetch after error', async () => {
      const planId = 624432;

      // First call fails
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
        new Error('Temporary error')
      );

      const { result } = renderHook(() => usePlanWorkouts(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      // Second call succeeds
      const mockWorkouts: PlanWorkout[] = [
        {
          workoutId: 888,
          workoutDay: '2024-06-10',
          workoutTypeValueId: 2,
          workoutType: 'Bike',
          title: 'Recovered Workout',
          description: 'After retry',
          coachComments: null,
          totalTime: 2700,
          distance: null,
          tss: 40.0,
          totalTimePlanned: 2700,
          distancePlanned: null,
          tssPlanned: 40.0,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockWorkouts,
      });

      // Manually refetch
      result.current.refetch();

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toEqual(mockWorkouts);
    });
  });

  describe('conditional fetching', () => {
    it('should not fetch when enabled is false', async () => {
      const planId = 624432;
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(
        () => usePlanWorkouts(planId, { enabled: false }),
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
      const planId = 624432;
      const mockWorkouts: PlanWorkout[] = [
        {
          workoutId: 333,
          workoutDay: '2024-06-15',
          workoutTypeValueId: 3,
          workoutType: 'Swim',
          title: 'Conditional Workout',
          description: 'Enabled test',
          coachComments: null,
          totalTime: 2400,
          distance: null,
          tss: 35.0,
          totalTimePlanned: 2400,
          distancePlanned: null,
          tssPlanned: 35.0,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockWorkouts,
      });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          usePlanWorkouts(planId, { enabled }),
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

      expect(result.current.data).toEqual(mockWorkouts);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('query configuration', () => {
    it('should use correct query key with planId', async () => {
      const planId = 624432;
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => usePlanWorkouts(planId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the hook was called correctly with planId
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PLAN_WORKOUTS',
        planId: planId,
      });
    });

    it('should have default retry behavior', async () => {
      const planId = 624432;

      // Mock API to fail once then succeed
      vi.mocked(chrome.runtime.sendMessage)
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({
          success: true,
          data: [
            {
              workoutId: 1,
              workoutDay: '2024-06-01',
              workoutTypeValueId: 2,
              workoutType: 'Bike',
              title: 'Retry Test',
              description: 'Test retry',
              coachComments: null,
              totalTime: 1800,
              distance: null,
              tss: 25.0,
              totalTimePlanned: 1800,
              distancePlanned: null,
              tssPlanned: 25.0,
            },
          ],
        });

      // Create wrapper with retries enabled for this specific test
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1, // Enable retry for this test
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => usePlanWorkouts(planId), {
        wrapper,
      });

      // Wait for final state (should succeed after retry)
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

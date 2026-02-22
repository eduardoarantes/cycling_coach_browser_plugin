import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePlanEvents } from '@/hooks/usePlanEvents';
import type { ApiResponse } from '@/types/api.types';
import type { CalendarEvent } from '@/types/api.types';
import type { ReactNode, ReactElement } from 'react';

// Test wrapper provider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePlanEvents', () => {
  beforeEach(() => {
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
    it('should fetch and return plan events data', async () => {
      const planId = 624432;
      const mockEvents: CalendarEvent[] = [
        {
          id: 3001,
          date: '2024-07-15',
          title: 'Race Day - Ironman 70.3',
          eventType: 'A',
          description: 'Primary race event',
        },
        {
          id: 3002,
          date: '2024-08-20',
          title: 'Training Camp',
          eventType: 'B',
          description: 'High altitude camp',
        },
      ];

      const mockResponse: ApiResponse<CalendarEvent[]> = {
        success: true,
        data: mockEvents,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanEvents(planId), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvents);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PLAN_EVENTS',
        planId: planId,
      });
    });

    it('should return empty array when plan has no events', async () => {
      const planId = 999;
      const mockResponse: ApiResponse<CalendarEvent[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanEvents(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should use cached data for same planId', async () => {
      const planId = 624432;
      const mockEvents: CalendarEvent[] = [
        {
          id: 4001,
          date: '2024-09-01',
          title: 'Cached Event',
          eventType: 'C',
          description: 'Test cache',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockEvents,
      });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000,
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result: result1 } = renderHook(() => usePlanEvents(planId), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      const { result: result2, unmount } = renderHook(
        () => usePlanEvents(planId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.data).toEqual(mockEvents);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('should fetch different data for different planIds', async () => {
      const planId1 = 111;
      const planId2 = 222;

      const mockEvents1: CalendarEvent[] = [
        {
          id: 1,
          date: '2024-06-01',
          title: 'Plan 1 Event',
          eventType: 'A',
          description: 'First plan event',
        },
      ];

      const mockEvents2: CalendarEvent[] = [
        {
          id: 2,
          date: '2024-07-01',
          title: 'Plan 2 Event',
          eventType: 'B',
          description: 'Second plan event',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage)
        .mockResolvedValueOnce({ success: true, data: mockEvents1 })
        .mockResolvedValueOnce({ success: true, data: mockEvents2 });

      const wrapper = createWrapper();

      const { result: result1 } = renderHook(() => usePlanEvents(planId1), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      expect(result1.current.data).toEqual(mockEvents1);

      const { result: result2 } = renderHook(() => usePlanEvents(planId2), {
        wrapper,
      });
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));
      expect(result2.current.data).toEqual(mockEvents2);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
        type: 'GET_PLAN_EVENTS',
        planId: planId1,
      });
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
        type: 'GET_PLAN_EVENTS',
        planId: planId2,
      });
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const planId = 624432;
      const mockErrorResponse: ApiResponse<CalendarEvent[]> = {
        success: false,
        error: {
          message: 'Events not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
        mockErrorResponse
      );

      const { result } = renderHook(() => usePlanEvents(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Events not found');
    });

    it('should handle network errors', async () => {
      const planId = 624432;
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Connection failed')
      );

      const { result } = renderHook(() => usePlanEvents(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Connection failed');
    });

    it('should support manual refetch after error', async () => {
      const planId = 624432;

      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
        new Error('Temporary error')
      );

      const { result } = renderHook(() => usePlanEvents(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      const mockEvents: CalendarEvent[] = [
        {
          id: 5001,
          date: '2024-10-01',
          title: 'Recovered Event',
          eventType: 'A',
          description: 'After retry',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockEvents,
      });

      result.current.refetch();

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toEqual(mockEvents);
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
        () => usePlanEvents(planId, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current.isLoading).toBe(false);

      await waitFor(() => {
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });
    });

    it('should fetch when enabled changes to true', async () => {
      const planId = 624432;
      const mockEvents: CalendarEvent[] = [
        {
          id: 6001,
          date: '2024-11-01',
          title: 'Conditional Event',
          eventType: 'B',
          description: 'Enabled test',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockEvents,
      });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          usePlanEvents(planId, { enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: false },
        }
      );

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEvents);
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
      const { result } = renderHook(() => usePlanEvents(planId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PLAN_EVENTS',
        planId: planId,
      });
    });
  });
});

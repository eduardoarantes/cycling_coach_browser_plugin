import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePlanNotes } from '@/hooks/usePlanNotes';
import type { ApiResponse } from '@/types/api.types';
import type { CalendarNote } from '@/types/api.types';
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

describe('usePlanNotes', () => {
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
    it('should fetch and return plan notes data', async () => {
      const planId = 624432;
      const mockNotes: CalendarNote[] = [
        {
          id: 2001,
          date: '2024-06-03',
          note: 'Focus week - high intensity',
          createdBy: 'Coach Smith',
        },
        {
          id: 2002,
          date: '2024-06-10',
          note: 'Recovery week',
          createdBy: 'Coach Smith',
        },
      ];

      const mockResponse: ApiResponse<CalendarNote[]> = {
        success: true,
        data: mockNotes,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanNotes(planId), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockNotes);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PLAN_NOTES',
        planId: planId,
      });
    });

    it('should return empty array when plan has no notes', async () => {
      const planId = 999;
      const mockResponse: ApiResponse<CalendarNote[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usePlanNotes(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it('should use cached data for same planId', async () => {
      const planId = 624432;
      const mockNotes: CalendarNote[] = [
        {
          id: 3001,
          date: '2024-06-05',
          note: 'Cached note',
          createdBy: 'Test Coach',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockNotes,
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

      const { result: result1 } = renderHook(() => usePlanNotes(planId), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      const { result: result2, unmount } = renderHook(
        () => usePlanNotes(planId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.data).toEqual(mockNotes);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const planId = 624432;
      const mockErrorResponse: ApiResponse<CalendarNote[]> = {
        success: false,
        error: {
          message: 'Notes not accessible',
          code: 'FORBIDDEN',
          statusCode: 403,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
        mockErrorResponse
      );

      const { result } = renderHook(() => usePlanNotes(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Notes not accessible');
    });

    it('should handle network errors', async () => {
      const planId = 624432;
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => usePlanNotes(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('Network error');
    });

    it('should support manual refetch after error', async () => {
      const planId = 624432;

      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
        new Error('Temporary error')
      );

      const { result } = renderHook(() => usePlanNotes(planId), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      const mockNotes: CalendarNote[] = [
        {
          id: 4001,
          date: '2024-06-20',
          note: 'Recovered note',
          createdBy: 'Coach',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockNotes,
      });

      result.current.refetch();

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toEqual(mockNotes);
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
        () => usePlanNotes(planId, { enabled: false }),
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
      const mockNotes: CalendarNote[] = [
        {
          id: 5001,
          date: '2024-06-25',
          note: 'Conditional note',
          createdBy: 'Coach',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockNotes,
      });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          usePlanNotes(planId, { enabled }),
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

      expect(result.current.data).toEqual(mockNotes);
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
      const { result } = renderHook(() => usePlanNotes(planId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PLAN_NOTES',
        planId: planId,
      });
    });
  });
});

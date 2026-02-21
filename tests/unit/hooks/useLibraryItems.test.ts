import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import type { ApiResponse } from '@/types/api.types';
import type { LibraryItem } from '@/types/api.types';
import type { ReactNode } from 'react';

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

describe('useLibraryItems', () => {
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
    it('should fetch and return library items for specific library', async () => {
      const libraryId = 123;
      const mockItems: LibraryItem[] = [
        {
          exerciseLibraryId: 123,
          exerciseLibraryItemId: 1,
          exerciseLibraryItemType: 'workout',
          itemName: 'Morning Ride',
          workoutTypeId: 1,
          distancePlanned: 50,
          totalTimePlanned: 3600,
          caloriesPlanned: 500,
          tssPlanned: 75,
          ifPlanned: 0.85,
          velocityPlanned: 25,
          energyPlanned: 500,
          elevationGainPlanned: 100,
          description: 'Easy morning ride',
          coachComments: 'Focus on cadence',
        },
        {
          exerciseLibraryId: 123,
          exerciseLibraryItemId: 2,
          exerciseLibraryItemType: 'workout',
          itemName: 'Interval Training',
          workoutTypeId: 2,
          distancePlanned: 40,
          totalTimePlanned: 2700,
          caloriesPlanned: 600,
          tssPlanned: 95,
          ifPlanned: 0.95,
          velocityPlanned: 28,
          energyPlanned: 600,
          elevationGainPlanned: 50,
          description: 'High intensity intervals',
          coachComments: 'Push hard',
        },
      ];

      const mockResponse: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockItems,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLibraryItems(libraryId), {
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
      expect(result.current.data).toEqual(mockItems);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.error).toBeNull();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_LIBRARY_ITEMS',
        libraryId: 123,
      });
    });

    it('should handle empty items array', async () => {
      const mockResponse: ApiResponse<LibraryItem[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLibraryItems(456), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it('should cache items for different libraries separately', async () => {
      const library1Items: LibraryItem[] = [
        {
          exerciseLibraryId: 1,
          exerciseLibraryItemId: 100,
          exerciseLibraryItemType: 'workout',
          itemName: 'Library 1 Workout',
          workoutTypeId: 1,
          distancePlanned: 10,
          totalTimePlanned: 1000,
          caloriesPlanned: 100,
          tssPlanned: 50,
          ifPlanned: 0.8,
          velocityPlanned: 20,
          energyPlanned: 100,
          elevationGainPlanned: 10,
          description: 'Test',
          coachComments: 'Test',
        },
      ];

      const library2Items: LibraryItem[] = [
        {
          exerciseLibraryId: 2,
          exerciseLibraryItemId: 200,
          exerciseLibraryItemType: 'workout',
          itemName: 'Library 2 Workout',
          workoutTypeId: 2,
          distancePlanned: 20,
          totalTimePlanned: 2000,
          caloriesPlanned: 200,
          tssPlanned: 60,
          ifPlanned: 0.9,
          velocityPlanned: 25,
          energyPlanned: 200,
          elevationGainPlanned: 20,
          description: 'Test 2',
          coachComments: 'Test 2',
        },
      ];

      // Mock different responses for different library IDs
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: any) => {
          if (message.libraryId === 1) {
            return { success: true, data: library1Items };
          } else {
            return { success: true, data: library2Items };
          }
        }
      );

      const wrapper = createWrapper();

      // Fetch library 1 items
      const { result: result1 } = renderHook(() => useLibraryItems(1), {
        wrapper,
      });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(result1.current.data).toEqual(library1Items);

      // Fetch library 2 items
      const { result: result2 } = renderHook(() => useLibraryItems(2), {
        wrapper,
      });
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      expect(result2.current.data).toEqual(library2Items);

      // Both should have been called
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('conditional fetching', () => {
    it('should not fetch when enabled is false', async () => {
      const mockItems: LibraryItem[] = [];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockItems,
      });

      const { result } = renderHook(
        () => useLibraryItems(123, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Wait a bit to ensure no fetch happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not have fetched
      expect(result.current.isPending).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should fetch when manually triggered via refetch', async () => {
      const mockItems: LibraryItem[] = [
        {
          exerciseLibraryId: 123,
          exerciseLibraryItemId: 1,
          exerciseLibraryItemType: 'workout',
          itemName: 'Lazy Load Workout',
          workoutTypeId: 1,
          distancePlanned: 10,
          totalTimePlanned: 1000,
          caloriesPlanned: 100,
          tssPlanned: 50,
          ifPlanned: 0.8,
          velocityPlanned: 20,
          energyPlanned: 100,
          elevationGainPlanned: 10,
          description: 'Test',
          coachComments: 'Test',
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockItems,
      });

      const { result } = renderHook(
        () => useLibraryItems(123, { enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Initially should not fetch
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

      // Manually trigger fetch
      result.current.refetch();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockItems);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const mockErrorResponse: ApiResponse<LibraryItem[]> = {
        success: false,
        error: {
          message: 'Library not found',
          code: 'NOT_FOUND',
          statusCode: 404,
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(
        mockErrorResponse
      );

      const { result } = renderHook(() => useLibraryItems(999), {
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
      expect(result.current.error?.message).toBe('Library not found');
    });

    it('should handle network errors', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('Network failure')
      );

      const { result } = renderHook(() => useLibraryItems(123), {
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
  });

  describe('query configuration', () => {
    it('should use hierarchical query key with libraryId', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const libraryId = 789;
      const { result } = renderHook(() => useLibraryItems(libraryId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the message includes the libraryId
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_LIBRARY_ITEMS',
        libraryId: 789,
      });
    });

    it('should support custom staleTime option', async () => {
      const mockItems: LibraryItem[] = [];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockItems,
      });

      const { result } = renderHook(
        () => useLibraryItems(123, { staleTime: 60000 }), // 1 minute
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockItems);
    });
  });
});

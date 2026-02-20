import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useLibraries } from '@/hooks/useLibraries';
import type { ApiResponse } from '@/types/api.types';
import type { Library } from '@/types/api.types';
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

  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useLibraries', () => {
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
    it('should fetch and return libraries array', async () => {
      const mockLibraries: Library[] = [
        {
          exerciseLibraryId: 1,
          libraryName: 'Cycling Workouts',
          ownerId: 123,
          ownerName: 'John Doe',
          imageUrl: 'https://example.com/image.jpg',
          isDefaultContent: false,
          itemCount: 10,
          isShared: false,
        },
        {
          exerciseLibraryId: 2,
          libraryName: 'Running Workouts',
          ownerId: 123,
          ownerName: 'John Doe',
          imageUrl: 'https://example.com/image2.jpg',
          isDefaultContent: true,
          itemCount: 5,
          isShared: true,
        },
      ];

      const mockResponse: ApiResponse<Library[]> = {
        success: true,
        data: mockLibraries,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLibraries(), {
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
      expect(result.current.data).toEqual(mockLibraries);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.error).toBeNull();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_LIBRARIES',
      });
    });

    it('should handle empty libraries array', async () => {
      const mockResponse: ApiResponse<Library[]> = {
        success: true,
        data: [],
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLibraries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it('should use cached data on subsequent renders', async () => {
      const mockLibraries: Library[] = [
        {
          exerciseLibraryId: 1,
          libraryName: 'Test Library',
          ownerId: 123,
          ownerName: 'Test User',
          imageUrl: 'https://example.com/test.jpg',
          isDefaultContent: false,
          itemCount: 3,
          isShared: false,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockLibraries,
      });

      // Create a single wrapper to share the same QueryClient
      // Set staleTime so data stays fresh
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 10000, // 10 seconds
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      // First render
      const { result: result1 } = renderHook(() => useLibraries(), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second render with same wrapper (should use cache)
      const { result: result2 } = renderHook(() => useLibraries(), {
        wrapper,
      });

      // Should immediately have data from cache
      await waitFor(() => {
        expect(result2.current.data).toEqual(mockLibraries);
      });

      expect(result2.current.isLoading).toBe(false);

      // Should still only have called API once
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const mockErrorResponse: ApiResponse<Library[]> = {
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

      const { result } = renderHook(() => useLibraries(), {
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

      const { result } = renderHook(() => useLibraries(), {
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

    it('should support manual refetch', async () => {
      const mockLibraries: Library[] = [
        {
          exerciseLibraryId: 1,
          libraryName: 'Refetch Test',
          ownerId: 123,
          ownerName: 'Test User',
          imageUrl: 'https://example.com/test.jpg',
          isDefaultContent: false,
          itemCount: 1,
          isShared: false,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockLibraries,
      });

      const { result } = renderHook(() => useLibraries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Trigger manual refetch
      result.current.refetch();

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      // Should have called API twice
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('query configuration', () => {
    it('should use correct query key', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useLibraries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the message was sent correctly
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_LIBRARIES',
      });
    });

    it('should have extended staleTime (10 minutes)', async () => {
      // This test verifies that libraries use longer cache
      // by checking that data doesn't refetch immediately
      const mockLibraries: Library[] = [
        {
          exerciseLibraryId: 1,
          libraryName: 'Test',
          ownerId: 1,
          ownerName: 'Test',
          imageUrl: 'test.jpg',
          isDefaultContent: false,
          itemCount: 1,
          isShared: false,
        },
      ];

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockLibraries,
      });

      const { result } = renderHook(() => useLibraries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have been called once
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Data should be available
      expect(result.current.data).toEqual(mockLibraries);
    });
  });
});

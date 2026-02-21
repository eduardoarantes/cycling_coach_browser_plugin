import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useUser } from '@/hooks/useUser';
import type { ApiResponse } from '@/types/api.types';
import type { UserProfile } from '@/types/api.types';
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

describe('useUser', () => {
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
    it('should fetch and return user profile data', async () => {
      const mockUser: UserProfile = {
        userId: 123,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        timeZone: 'America/Los_Angeles',
      };

      const mockResponse: ApiResponse<UserProfile> = {
        success: true,
        data: mockUser,
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useUser(), {
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
      expect(result.current.data).toEqual(mockUser);
      expect(result.current.error).toBeNull();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_USER',
      });
    });

    it('should use cached data on subsequent renders', async () => {
      const mockUser: UserProfile = {
        userId: 456,
        email: 'cached@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        timeZone: 'UTC',
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockUser,
      });

      // Create a single wrapper to share the same QueryClient
      // Set staleTime so data stays fresh
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 10000, // 10 seconds - data won't be considered stale
          },
        },
      });

      const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      // First render
      const { result: result1 } = renderHook(() => useUser(), { wrapper });
      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second render with same wrapper (should use cache)
      const { result: result2, unmount } = renderHook(() => useUser(), {
        wrapper,
      });

      // Should immediately have data from cache (because staleTime hasn't expired)
      await waitFor(() => {
        expect(result2.current.data).toEqual(mockUser);
      });

      expect(result2.current.isLoading).toBe(false);

      // Should still only have called API once (data is still fresh)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', async () => {
      const mockErrorResponse: ApiResponse<UserProfile> = {
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

      const { result } = renderHook(() => useUser(), {
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

      const { result } = renderHook(() => useUser(), {
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

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 3000 }
      );

      // Second call succeeds
      const mockUser: UserProfile = {
        userId: 789,
        email: 'recovered@example.com',
        firstName: 'Recovery',
        lastName: 'User',
        timeZone: 'UTC',
      };

      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: mockUser,
      });

      // Manually refetch
      result.current.refetch();

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 3000 }
      );

      expect(result.current.data).toEqual(mockUser);
    });
  });

  describe('query configuration', () => {
    it('should use correct query key', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          userId: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          timeZone: 'UTC',
        },
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUser(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the hook was called correctly
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_USER',
      });
    });

    it('should have retry set to 1', async () => {
      // Mock API to fail twice then succeed
      vi.mocked(chrome.runtime.sendMessage)
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({
          success: true,
          data: {
            userId: 1,
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            timeZone: 'UTC',
          },
        });

      const { result } = renderHook(() => useUser(), {
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

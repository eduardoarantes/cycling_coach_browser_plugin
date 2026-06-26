import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAthleteGroups } from '@/hooks/useAthleteGroups';
import type { ApiResponse } from '@/types/api.types';
import type { AthleteGroup, UserProfile } from '@/types/api.types';
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

const mockUser: UserProfile = {
  userId: 6469888,
  email: 'coach@example.com',
  firstName: 'Coach',
  lastName: 'Example',
  timeZone: 'America/New_York',
};

const mockGroups: AthleteGroup[] = [
  {
    id: 340276,
    coachId: 6469888,
    name: 'My Athletes',
    athleteIds: [],
    isDefault: true,
  },
  {
    id: 340617,
    coachId: 6469888,
    name: 'Group1',
    athleteIds: [6469889],
    isDefault: false,
  },
];

/**
 * Routes mocked sendMessage calls to the appropriate response based on the
 * message type. useAthleteGroups first fetches the user (for the coach id),
 * then fetches the groups.
 */
function mockSendMessage(
  options: {
    user?: ApiResponse<UserProfile>;
    groups?: ApiResponse<AthleteGroup[]>;
  } = {}
): void {
  const userResponse: ApiResponse<UserProfile> = options.user ?? {
    success: true,
    data: mockUser,
  };
  const groupsResponse: ApiResponse<AthleteGroup[]> = options.groups ?? {
    success: true,
    data: mockGroups,
  };

  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    (message: unknown) => {
      const type = (message as { type?: string }).type;
      if (type === 'GET_USER') {
        return Promise.resolve(userResponse);
      }
      if (type === 'GET_ATHLETE_GROUPS') {
        return Promise.resolve(groupsResponse);
      }
      return Promise.resolve({ success: false, error: { message: 'unknown' } });
    }
  );
}

describe('useAthleteGroups', () => {
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

  it('should fetch the coach id then return athlete groups', async () => {
    mockSendMessage();

    const { result } = renderHook(() => useAthleteGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockGroups);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'GET_ATHLETE_GROUPS',
      coachId: 6469888,
    });
  });

  it('should handle an empty groups array', async () => {
    mockSendMessage({ groups: { success: true, data: [] } });

    const { result } = renderHook(() => useAthleteGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should not fetch groups when disabled', async () => {
    mockSendMessage();

    renderHook(() => useAthleteGroups({ enabled: false }), {
      wrapper: createWrapper(),
    });

    // Give react-query a tick; nothing should be requested while disabled
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({
      type: 'GET_ATHLETE_GROUPS',
      coachId: 6469888,
    });
  });

  it('should surface API errors from the groups request', async () => {
    mockSendMessage({
      groups: {
        success: false,
        error: { message: 'Unauthorized', code: 'AUTH_ERROR', status: 401 },
      },
    });

    const { result } = renderHook(() => useAthleteGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 3000 }
    );

    expect(result.current.error?.message).toBe('Unauthorized');
  });
});

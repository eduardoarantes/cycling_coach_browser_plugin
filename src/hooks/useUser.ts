import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { UserProfile } from '@/types/api.types';
import type { GetUserMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';

/**
 * Query function for fetching user profile
 * Sends message to background worker and unwraps ApiResponse
 */
async function fetchUserProfile(): Promise<UserProfile> {
  logger.debug('Fetching user profile via background worker');

  const response = await chrome.runtime.sendMessage<
    GetUserMessage,
    ApiResponse<UserProfile>
  >({
    type: 'GET_USER',
  });

  if (response.success) {
    logger.debug('User profile fetched successfully:', response.data.userId);
    return response.data;
  } else {
    logApiResponseError('Failed to fetch user profile:', response.error);
    throw new Error(response.error.message || 'Failed to fetch user profile');
  }
}

/**
 * Custom hook for user profile data
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with user profile data
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { isAuthenticated } = useAuth();
 *   const { data: user, isLoading, error } = useUser({ enabled: isAuthenticated });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!user) return null;
 *
 *   return <div>Hello, {user.firstName}!</div>;
 * }
 * ```
 */
export function useUser(options?: {
  enabled?: boolean;
}): UseQueryResult<UserProfile, Error> {
  return useQuery<UserProfile, Error>({
    queryKey: ['user'],
    queryFn: fetchUserProfile,
    // User profile rarely changes
    staleTime: CACHE_DURATIONS.USER,
    // User data is critical, don't retry too aggressively
    retry: 1,
    // Only fetch when enabled (typically when authenticated)
    enabled: options?.enabled ?? true,
  });
}

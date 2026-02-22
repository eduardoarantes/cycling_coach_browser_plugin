import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Library } from '@/types/api.types';
import type { GetLibrariesMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { CACHE_DURATIONS } from '@/utils/constants';
import { useUser } from './useUser';

/**
 * Query function for fetching libraries list
 */
async function fetchLibrariesList(): Promise<Library[]> {
  logger.debug('Fetching libraries list via background worker');

  const response = await chrome.runtime.sendMessage<
    GetLibrariesMessage,
    ApiResponse<Library[]>
  >({
    type: 'GET_LIBRARIES',
  });

  if (response.success) {
    logger.debug(
      'Libraries fetched successfully:',
      response.data.length,
      'libraries'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch libraries:',
      response.error.message || 'Unknown error'
    );
    throw new Error(response.error.message || 'Failed to fetch libraries');
  }
}

/**
 * Filter libraries to only show those owned by the logged-in user
 */
function filterUserLibraries(
  libraries: Library[],
  userId: number | undefined
): Library[] {
  if (!userId) {
    logger.debug('No user ID available, returning all libraries');
    return libraries;
  }

  const filtered = libraries.filter((lib) => lib.ownerId === userId);
  logger.debug(
    `Filtered libraries: ${filtered.length} of ${libraries.length} belong to user ${userId}`
  );

  return filtered;
}

/**
 * Custom hook for libraries list
 *
 * **Note**: Automatically filters to show only libraries owned by the logged-in user
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @param options.showAll - If true, show all libraries regardless of owner (default: false)
 * @returns React Query result with libraries array (filtered to user's libraries)
 *
 * @example
 * ```tsx
 * function LibraryList() {
 *   const { isAuthenticated } = useAuth();
 *   const { data: libraries, isLoading, error, refetch } = useLibraries({ enabled: isAuthenticated });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 *   if (!libraries?.length) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {libraries.map(lib => (
 *         <LibraryCard key={lib.exerciseLibraryId} library={lib} />
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useLibraries(options?: {
  enabled?: boolean;
  showAll?: boolean;
}): UseQueryResult<Library[], Error> {
  // Fetch user profile to get userId for filtering
  const { data: user } = useUser({ enabled: options?.enabled ?? true });

  const librariesQuery = useQuery<Library[], Error>({
    queryKey: ['libraries'],
    queryFn: fetchLibrariesList,
    // Libraries change infrequently, cache aggressively
    staleTime: CACHE_DURATIONS.LIBRARIES,
    // Only fetch when enabled (typically when authenticated)
    enabled: options?.enabled ?? true,
  });

  // Filter libraries to only show user's own libraries (unless showAll is true)
  const filteredData =
    librariesQuery.data && !options?.showAll
      ? filterUserLibraries(librariesQuery.data, user?.userId)
      : librariesQuery.data;

  return {
    ...librariesQuery,
    data: filteredData,
  } as UseQueryResult<Library[], Error>;
}

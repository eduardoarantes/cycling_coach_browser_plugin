import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Library } from '@/types/api.types';
import type { GetLibrariesMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';

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
 * Custom hook for libraries list
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with libraries array
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
}): UseQueryResult<Library[], Error> {
  return useQuery<Library[], Error>({
    queryKey: ['libraries'],
    queryFn: fetchLibrariesList,
    // Libraries change infrequently, cache aggressively
    staleTime: 10 * 60 * 1000, // 10 minutes
    // Only fetch when enabled (typically when authenticated)
    enabled: options?.enabled ?? true,
  });
}

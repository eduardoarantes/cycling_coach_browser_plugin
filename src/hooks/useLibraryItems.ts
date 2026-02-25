import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { LibraryItem } from '@/types/api.types';
import type { GetLibraryItemsMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';

/**
 * Query function for fetching library items
 * @param libraryId - The library ID to fetch items for
 */
async function fetchLibraryItemsList(
  libraryId: number
): Promise<LibraryItem[]> {
  logger.debug('Fetching items for library:', libraryId);

  const response = await chrome.runtime.sendMessage<
    GetLibraryItemsMessage,
    ApiResponse<LibraryItem[]>
  >({
    type: 'GET_LIBRARY_ITEMS',
    libraryId,
  });

  if (response.success) {
    logger.debug(
      'Library items fetched successfully:',
      response.data.length,
      'items for library',
      libraryId
    );
    return response.data;
  } else {
    logApiResponseError('Failed to fetch library items:', response.error);
    throw new Error(response.error.message || 'Failed to fetch library items');
  }
}

/**
 * Custom hook for library items (workouts)
 *
 * @param libraryId - The library ID to fetch items for
 * @param options - Optional React Query configuration overrides
 * @returns React Query result with library items array
 *
 * @example
 * ```tsx
 * function LibraryDetails({ libraryId }: { libraryId: number }) {
 *   const { data: items, isLoading, error } = useLibraryItems(libraryId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!items?.length) return <EmptyLibrary />;
 *
 *   return (
 *     <div>
 *       <h2>{items.length} Workouts</h2>
 *       <WorkoutGrid items={items} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Disable automatic fetching (fetch on demand)
 * function LibraryPreview({ libraryId }: { libraryId: number }) {
 *   const { data, refetch } = useLibraryItems(libraryId, { enabled: false });
 *
 *   return (
 *     <div>
 *       <button onClick={() => refetch()}>Load Workouts</button>
 *       {data && <WorkoutList items={data} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLibraryItems(
  libraryId: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
): UseQueryResult<LibraryItem[], Error> {
  return useQuery<LibraryItem[], Error>({
    queryKey: ['libraries', libraryId, 'items'],
    queryFn: () => fetchLibraryItemsList(libraryId),
    // Allow disabling auto-fetch (useful for on-demand loading)
    enabled: options?.enabled ?? true,
    // Library items can change, use shorter stale time
    staleTime: options?.staleTime ?? CACHE_DURATIONS.LIBRARY_ITEMS,
  });
}

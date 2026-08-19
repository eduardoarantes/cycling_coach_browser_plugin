import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { AthleteGroup } from '@/types/api.types';
import type { GetAthleteGroupsMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';
import { useUser } from './useUser';

/**
 * Result of the athlete-groups query: the validated groups plus the raw
 * TrainingPeaks response that generated them (used by the source-JSON viewer).
 */
interface AthleteGroupsQueryResult {
  groups: AthleteGroup[];
  raw: unknown;
}

/**
 * Query function for fetching athlete groups (coach tags)
 * Sends message to background worker and unwraps ApiResponse
 */
async function fetchAthleteGroupsList(
  coachId: number
): Promise<AthleteGroupsQueryResult> {
  logger.debug('Fetching athlete groups via background worker', coachId);

  const response = await chrome.runtime.sendMessage<
    GetAthleteGroupsMessage,
    ApiResponse<AthleteGroup[]>
  >({
    type: 'GET_ATHLETE_GROUPS',
    coachId,
  });

  if (response.success) {
    logger.debug(
      'Athlete groups fetched successfully:',
      response.data.length,
      'groups'
    );
    return { groups: response.data, raw: response.raw };
  } else {
    logApiResponseError('Failed to fetch athlete groups:', response.error);
    throw new Error(response.error.message || 'Failed to fetch athlete groups');
  }
}

/**
 * Custom hook for athlete groups (coach tags)
 *
 * Resolves the authenticated coach ID from the user profile (`userId`), then
 * fetches the coach's athlete groups. The query is only enabled once the coach
 * ID is available.
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with athlete groups array
 *
 * @example
 * ```tsx
 * function AthleteGroups() {
 *   const { data: groups, isLoading, error } = useAthleteGroups();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!groups?.length) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {groups.map(group => (
 *         <li key={group.id}>
 *           {group.name} ({group.athleteIds.length})
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAthleteGroups(options?: {
  enabled?: boolean;
}): UseQueryResult<AthleteGroup[], Error> & { rawResponse: unknown } {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();

  // Fetch user profile to resolve the coach ID (userId)
  const { data: user } = useUser({ enabled });
  const coachId = user?.userId;

  // Keep the public `data` shape as `AthleteGroup[]` for existing call sites by
  // narrowing through `select`, rather than spreading the query result. React
  // Query tracks which result properties a component reads to decide whether to
  // re-render; spreading would touch every property and defeat that.
  const query = useQuery<AthleteGroupsQueryResult, Error, AthleteGroup[]>({
    queryKey: ['athleteGroups', coachId],
    queryFn: () => fetchAthleteGroupsList(coachId as number),
    select: (result) => result.groups,
    // Groups change infrequently
    staleTime: CACHE_DURATIONS.ATHLETE_GROUPS,
    // Only fetch when enabled and the coach ID is known
    enabled: enabled && coachId !== undefined,
  });

  // Read the raw TrainingPeaks response straight from the cache so the JSON
  // viewer can show it without widening the query's public `data` shape.
  const cached = queryClient.getQueryData<AthleteGroupsQueryResult>([
    'athleteGroups',
    coachId,
  ]);

  return Object.assign(query, { rawResponse: cached?.raw });
}

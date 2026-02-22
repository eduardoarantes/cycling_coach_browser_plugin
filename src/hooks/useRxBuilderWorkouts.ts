import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { RxBuilderWorkout } from '@/types/api.types';
import type { GetRxBuilderWorkoutsMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { CACHE_DURATIONS } from '@/utils/constants';

/**
 * Query function for fetching RxBuilder (structured strength) workouts
 */
async function fetchRxBuilderWorkoutsList(
  planId: number
): Promise<RxBuilderWorkout[]> {
  logger.debug(
    'Fetching RxBuilder workouts via background worker for plan:',
    planId
  );

  const response = await chrome.runtime.sendMessage<
    GetRxBuilderWorkoutsMessage,
    ApiResponse<RxBuilderWorkout[]>
  >({
    type: 'GET_RX_BUILDER_WORKOUTS',
    planId,
  });

  if (response.success) {
    logger.debug(
      'RxBuilder workouts fetched successfully:',
      response.data.length,
      'workouts'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch RxBuilder workouts:',
      response.error.message || 'Unknown error'
    );
    throw new Error(
      response.error.message || 'Failed to fetch RxBuilder workouts'
    );
  }
}

/**
 * Custom hook for RxBuilder (structured strength) workouts
 *
 * RxBuilder is TrainingPeaks' new structured strength workout builder that uses
 * exercise sequences instead of traditional interval structures.
 *
 * @param planId - ID of the training plan to fetch RxBuilder workouts for
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with RxBuilder workouts array
 *
 * @example
 * ```tsx
 * function RxBuilderWorkoutsList({ planId }: { planId: number }) {
 *   const { data: rxWorkouts, isLoading, error } = useRxBuilderWorkouts(planId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!rxWorkouts?.length) return <EmptyState />;
 *
 *   return (
 *     <div>
 *       <h2>{rxWorkouts.length} Strength Workouts</h2>
 *       <WorkoutGrid items={rxWorkouts} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useRxBuilderWorkouts(
  planId: number,
  options?: { enabled?: boolean }
): UseQueryResult<RxBuilderWorkout[], Error> {
  return useQuery<RxBuilderWorkout[], Error>({
    queryKey: ['plans', planId, 'rxWorkouts'],
    queryFn: () => fetchRxBuilderWorkoutsList(planId),
    // RxBuilder workouts may be edited, cache moderately
    staleTime: CACHE_DURATIONS.RX_BUILDER_WORKOUTS,
    // Only fetch when enabled
    enabled: options?.enabled ?? true,
  });
}

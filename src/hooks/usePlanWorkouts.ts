import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PlanWorkout } from '@/types/api.types';
import type { GetPlanWorkoutsMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { CACHE_DURATIONS } from '@/utils/constants';

/**
 * Query function for fetching plan workouts
 */
async function fetchPlanWorkoutsList(planId: number): Promise<PlanWorkout[]> {
  logger.debug(
    'Fetching plan workouts via background worker for plan:',
    planId
  );

  const response = await chrome.runtime.sendMessage<
    GetPlanWorkoutsMessage,
    ApiResponse<PlanWorkout[]>
  >({
    type: 'GET_PLAN_WORKOUTS',
    planId,
  });

  if (response.success) {
    logger.debug(
      'Plan workouts fetched successfully:',
      response.data.length,
      'workouts'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch plan workouts:',
      response.error.message || 'Unknown error'
    );
    throw new Error(response.error.message || 'Failed to fetch plan workouts');
  }
}

/**
 * Custom hook for plan workouts
 *
 * @param planId - ID of the training plan to fetch workouts for
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with plan workouts array
 *
 * @example
 * ```tsx
 * function PlanWorkoutsList({ planId }: { planId: number }) {
 *   const { data: workouts, isLoading, error } = usePlanWorkouts(planId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!workouts?.length) return <EmptyState />;
 *
 *   return (
 *     <div>
 *       <h2>{workouts.length} Workouts</h2>
 *       <WorkoutGrid items={workouts} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional fetching
 * function PlanPreview({ planId, showWorkouts }: Props) {
 *   const { data, refetch } = usePlanWorkouts(planId, { enabled: showWorkouts });
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
export function usePlanWorkouts(
  planId: number,
  options?: { enabled?: boolean }
): UseQueryResult<PlanWorkout[], Error> {
  return useQuery<PlanWorkout[], Error>({
    queryKey: ['plans', planId, 'workouts'],
    queryFn: () => fetchPlanWorkoutsList(planId),
    // Workouts may be edited, cache moderately
    staleTime: CACHE_DURATIONS.PLAN_WORKOUTS,
    // Only fetch when enabled
    enabled: options?.enabled ?? true,
  });
}

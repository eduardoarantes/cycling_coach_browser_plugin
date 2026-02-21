import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TrainingPlan } from '@/types/api.types';
import type { GetTrainingPlansMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';

/**
 * Query function for fetching training plans list
 */
async function fetchTrainingPlansList(): Promise<TrainingPlan[]> {
  logger.debug('Fetching training plans list via background worker');

  const response = await chrome.runtime.sendMessage<
    GetTrainingPlansMessage,
    ApiResponse<TrainingPlan[]>
  >({
    type: 'GET_TRAINING_PLANS',
  });

  if (response.success) {
    logger.debug(
      'Training plans fetched successfully:',
      response.data.length,
      'plans'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch training plans:',
      response.error.message || 'Unknown error'
    );
    throw new Error(response.error.message || 'Failed to fetch training plans');
  }
}

/**
 * Custom hook for training plans list
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with training plans array
 *
 * @example
 * ```tsx
 * function PlansList() {
 *   const { isAuthenticated } = useAuth();
 *   const { data: plans, isLoading, error, refetch } = useTrainingPlans({ enabled: isAuthenticated });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 *   if (!plans?.length) return <EmptyState />;
 *
 *   return (
 *     <ul>
 *       {plans.map(plan => (
 *         <PlanCard key={plan.id} plan={plan} />
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useTrainingPlans(options?: {
  enabled?: boolean;
}): UseQueryResult<TrainingPlan[], Error> {
  return useQuery<TrainingPlan[], Error>({
    queryKey: ['trainingPlans'],
    queryFn: fetchTrainingPlansList,
    // Training plans change infrequently, cache aggressively
    staleTime: 10 * 60 * 1000, // 10 minutes
    // Retry once on failure
    retry: 1,
    // Only fetch when enabled (typically when authenticated)
    enabled: options?.enabled ?? true,
  });
}

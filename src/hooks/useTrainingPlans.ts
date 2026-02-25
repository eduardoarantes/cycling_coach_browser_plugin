import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TrainingPlan } from '@/types/api.types';
import type { GetTrainingPlansMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';
import { useUser } from './useUser';

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
    logApiResponseError('Failed to fetch training plans:', response.error);
    throw new Error(response.error.message || 'Failed to fetch training plans');
  }
}

/**
 * Filter training plans to only show those accessible to the logged-in user
 * Includes plans where the user is either:
 * - The owner (ownerPersonId)
 * - The person the plan is assigned to (planPersonId)
 * - Has explicit access (planAccess.personId)
 */
function filterUserPlans(
  plans: TrainingPlan[],
  userId: number | undefined
): TrainingPlan[] {
  if (!userId) {
    logger.debug('No user ID available, returning all training plans');
    return plans;
  }

  const filtered = plans.filter(
    (plan) =>
      plan.ownerPersonId === userId ||
      plan.planPersonId === userId ||
      plan.planAccess.personId === userId
  );
  logger.debug(
    `Filtered training plans: ${filtered.length} of ${plans.length} accessible to user ${userId}`
  );

  return filtered;
}

/**
 * Custom hook for training plans list
 *
 * **Note**: Automatically filters to show only plans assigned to the logged-in user
 *
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @param options.showAll - If true, show all plans regardless of assignment (default: false)
 * @returns React Query result with training plans array (filtered to user's plans)
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
  showAll?: boolean;
}): UseQueryResult<TrainingPlan[], Error> {
  // Fetch user profile to get userId for filtering
  const { data: user } = useUser({ enabled: options?.enabled ?? true });

  const plansQuery = useQuery<TrainingPlan[], Error>({
    queryKey: ['trainingPlans'],
    queryFn: fetchTrainingPlansList,
    // Training plans change infrequently, cache aggressively
    staleTime: CACHE_DURATIONS.TRAINING_PLANS,
    // Retry once on failure
    retry: 1,
    // Only fetch when enabled (typically when authenticated)
    enabled: options?.enabled ?? true,
  });

  // Filter plans to only show user's own plans (unless showAll is true)
  const filteredData =
    plansQuery.data && !options?.showAll
      ? filterUserPlans(plansQuery.data, user?.userId)
      : plansQuery.data;

  return {
    ...plansQuery,
    data: filteredData,
  } as UseQueryResult<TrainingPlan[], Error>;
}

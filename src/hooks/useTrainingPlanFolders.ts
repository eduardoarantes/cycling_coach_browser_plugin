import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PlanFolder } from '@/schemas/trainingPlan.schema';
import type { GetTrainingPlanFoldersMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';

async function fetchTrainingPlanFoldersList(): Promise<PlanFolder[]> {
  logger.debug('Fetching training plan folders via background worker');

  const response = await chrome.runtime.sendMessage<
    GetTrainingPlanFoldersMessage,
    ApiResponse<PlanFolder[]>
  >({
    type: 'GET_TRAINING_PLAN_FOLDERS',
  });

  if (response.success) {
    logger.debug('Plan folders fetched:', response.data.length, 'folders');
    return response.data;
  }

  logApiResponseError('Failed to fetch plan folders:', response.error);
  throw new Error(response.error.message || 'Failed to fetch plan folders');
}

/**
 * Custom hook for the coach's TrainingPeaks plan folders.
 *
 * Membership lives on the folder rather than the plan: each folder carries the
 * ids of the plans inside it, so grouping plans means looking a plan's id up
 * across folders rather than reading a field off the plan.
 */
export function useTrainingPlanFolders(options?: {
  enabled?: boolean;
}): UseQueryResult<PlanFolder[], Error> {
  return useQuery<PlanFolder[], Error>({
    queryKey: ['trainingPlanFolders'],
    queryFn: fetchTrainingPlanFoldersList,
    staleTime: CACHE_DURATIONS.TRAINING_PLANS,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

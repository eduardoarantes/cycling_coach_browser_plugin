import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { GetPlanMyPeakCoachMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakCoach } from '@/schemas/planMyPeakApi.schema';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';

const PLANMYPEAK_COACH_QUERY_KEY = ['planMyPeakCoach'] as const;

async function fetchPlanMyPeakCoachProfile(): Promise<PlanMyPeakCoach> {
  logger.debug('Fetching PlanMyPeak coach profile via background worker');

  const response = await chrome.runtime.sendMessage<
    GetPlanMyPeakCoachMessage,
    ApiResponse<PlanMyPeakCoach>
  >({
    type: 'GET_PLANMYPEAK_COACH',
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    'Failed to fetch PlanMyPeak coach profile:',
    response.error
  );
  throw new Error(
    response.error.message || 'Failed to fetch PlanMyPeak coach profile'
  );
}

/**
 * Fetch the authenticated PlanMyPeak coach profile (including the linked
 * TrainingPeaks account). Used to detect TP/PlanMyPeak account mismatches.
 */
export function usePlanMyPeakCoach(options?: {
  enabled?: boolean;
}): UseQueryResult<PlanMyPeakCoach, Error> {
  return useQuery<PlanMyPeakCoach, Error>({
    queryKey: PLANMYPEAK_COACH_QUERY_KEY,
    queryFn: fetchPlanMyPeakCoachProfile,
    staleTime: CACHE_DURATIONS.USER,
    enabled: options?.enabled ?? true,
  });
}

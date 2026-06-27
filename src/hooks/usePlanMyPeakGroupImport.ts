import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ImportAthleteGroupsToPlanMyPeakMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';
import type { PlanMyPeakIngestAthleteGroupsResponse } from '@/schemas/planMyPeakApi.schema';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';

async function importAthleteGroupsRequest(
  groups: AthleteGroup[]
): Promise<PlanMyPeakIngestAthleteGroupsResponse> {
  logger.debug(
    'Importing TrainingPeaks athlete groups into PlanMyPeak:',
    groups.length
  );

  const response = await chrome.runtime.sendMessage<
    ImportAthleteGroupsToPlanMyPeakMessage,
    ApiResponse<PlanMyPeakIngestAthleteGroupsResponse>
  >({
    type: 'IMPORT_ATHLETE_GROUPS_TO_PLANMYPEAK',
    groups,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    'Failed to import athlete groups into PlanMyPeak:',
    response.error
  );
  throw new Error(
    response.error.message || 'Failed to import athlete groups into PlanMyPeak'
  );
}

/**
 * Mutation hook to import (ingest) TrainingPeaks athlete groups into PlanMyPeak.
 * The raw TrainingPeaks groups payload is forwarded verbatim to the background
 * worker, which POSTs it to the coach-authenticated ingest endpoint.
 */
export function usePlanMyPeakGroupImport(): UseMutationResult<
  PlanMyPeakIngestAthleteGroupsResponse,
  Error,
  AthleteGroup[]
> {
  return useMutation<
    PlanMyPeakIngestAthleteGroupsResponse,
    Error,
    AthleteGroup[]
  >({
    mutationFn: importAthleteGroupsRequest,
  });
}

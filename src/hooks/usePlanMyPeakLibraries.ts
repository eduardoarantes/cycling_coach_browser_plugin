import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  GetPlanMyPeakLibrariesMessage,
  CreatePlanMyPeakLibraryMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakLibrary } from '@/schemas/planMyPeakApi.schema';
import { logger } from '@/utils/logger';
import { logApiResponseError } from '@/utils/apiErrorLogging';
import { CACHE_DURATIONS } from '@/utils/constants';

const PLANMYPEAK_LIBRARIES_QUERY_KEY = ['planMyPeakLibraries'] as const;

async function fetchPlanMyPeakLibrariesList(): Promise<PlanMyPeakLibrary[]> {
  logger.debug('Fetching PlanMyPeak libraries via background worker');

  const response = await chrome.runtime.sendMessage<
    GetPlanMyPeakLibrariesMessage,
    ApiResponse<PlanMyPeakLibrary[]>
  >({
    type: 'GET_PLANMYPEAK_LIBRARIES',
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError('Failed to fetch PlanMyPeak libraries:', response.error);
  throw new Error(
    response.error.message || 'Failed to fetch PlanMyPeak libraries'
  );
}

async function createPlanMyPeakLibraryRequest(
  name: string
): Promise<PlanMyPeakLibrary> {
  logger.debug('Creating PlanMyPeak library via background worker:', name);

  const response = await chrome.runtime.sendMessage<
    CreatePlanMyPeakLibraryMessage,
    ApiResponse<PlanMyPeakLibrary>
  >({
    type: 'CREATE_PLANMYPEAK_LIBRARY',
    name,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError('Failed to create PlanMyPeak library:', response.error);
  throw new Error(
    response.error.message || 'Failed to create PlanMyPeak library'
  );
}

export function usePlanMyPeakLibraries(options?: {
  enabled?: boolean;
}): UseQueryResult<PlanMyPeakLibrary[], Error> {
  return useQuery<PlanMyPeakLibrary[], Error>({
    queryKey: PLANMYPEAK_LIBRARIES_QUERY_KEY,
    queryFn: fetchPlanMyPeakLibrariesList,
    staleTime: CACHE_DURATIONS.LIBRARIES,
    enabled: options?.enabled ?? true,
  });
}

export function useCreatePlanMyPeakLibrary(): UseMutationResult<
  PlanMyPeakLibrary,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation<PlanMyPeakLibrary, Error, string>({
    mutationFn: createPlanMyPeakLibraryRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: PLANMYPEAK_LIBRARIES_QUERY_KEY,
      });
    },
  });
}

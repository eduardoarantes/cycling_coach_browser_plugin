import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CalendarNote } from '@/types/api.types';
import type { GetPlanNotesMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';

/**
 * Query function for fetching plan notes
 */
async function fetchPlanNotesList(planId: number): Promise<CalendarNote[]> {
  logger.debug('Fetching plan notes via background worker for plan:', planId);

  const response = await chrome.runtime.sendMessage<
    GetPlanNotesMessage,
    ApiResponse<CalendarNote[]>
  >({
    type: 'GET_PLAN_NOTES',
    planId,
  });

  if (response.success) {
    logger.debug(
      'Plan notes fetched successfully:',
      response.data.length,
      'notes'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch plan notes:',
      response.error.message || 'Unknown error'
    );
    throw new Error(response.error.message || 'Failed to fetch plan notes');
  }
}

/**
 * Custom hook for plan calendar notes
 *
 * @param planId - ID of the training plan to fetch notes for
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with calendar notes array
 *
 * @example
 * ```tsx
 * function PlanNotes({ planId }: { planId: number }) {
 *   const { data: notes, isLoading, error } = usePlanNotes(planId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!notes?.length) return <p>No notes</p>;
 *
 *   return (
 *     <div>
 *       {notes.map(note => (
 *         <NoteCard key={note.id} note={note} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlanNotes(
  planId: number,
  options?: { enabled?: boolean }
): UseQueryResult<CalendarNote[], Error> {
  return useQuery<CalendarNote[], Error>({
    queryKey: ['plans', planId, 'notes'],
    queryFn: () => fetchPlanNotesList(planId),
    // Notes may change, cache moderately
    staleTime: 3 * 60 * 1000, // 3 minutes
    // Only fetch when enabled
    enabled: options?.enabled ?? true,
  });
}

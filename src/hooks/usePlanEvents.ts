import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CalendarEvent } from '@/types/api.types';
import type { GetPlanEventsMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';

/**
 * Query function for fetching plan events
 */
async function fetchPlanEventsList(planId: number): Promise<CalendarEvent[]> {
  logger.debug('Fetching plan events via background worker for plan:', planId);

  const response = await chrome.runtime.sendMessage<
    GetPlanEventsMessage,
    ApiResponse<CalendarEvent[]>
  >({
    type: 'GET_PLAN_EVENTS',
    planId,
  });

  if (response.success) {
    logger.debug(
      'Plan events fetched successfully:',
      response.data.length,
      'events'
    );
    return response.data;
  } else {
    logger.error(
      'Failed to fetch plan events:',
      response.error.message || 'Unknown error'
    );
    throw new Error(response.error.message || 'Failed to fetch plan events');
  }
}

/**
 * Custom hook for plan calendar events
 *
 * @param planId - ID of the training plan to fetch events for
 * @param options - Optional configuration
 * @param options.enabled - Whether to auto-fetch (default: true)
 * @returns React Query result with calendar events array
 *
 * @example
 * ```tsx
 * function PlanEvents({ planId }: { planId: number }) {
 *   const { data: events, isLoading, error } = usePlanEvents(planId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!events?.length) return <p>No events</p>;
 *
 *   return (
 *     <div>
 *       {events.map(event => (
 *         <EventCard key={event.id} event={event} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlanEvents(
  planId: number,
  options?: { enabled?: boolean }
): UseQueryResult<CalendarEvent[], Error> {
  return useQuery<CalendarEvent[], Error>({
    queryKey: ['plans', planId, 'events'],
    queryFn: () => fetchPlanEventsList(planId),
    // Events may change, cache moderately
    staleTime: 3 * 60 * 1000, // 3 minutes
    // Only fetch when enabled
    enabled: options?.enabled ?? true,
  });
}

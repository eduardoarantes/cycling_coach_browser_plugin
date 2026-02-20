import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client configured for Chrome extension context
 *
 * Configuration rationale:
 * - staleTime: 5 minutes - TrainingPeaks data changes infrequently
 * - gcTime: 10 minutes - Keep data in memory for popup re-opens
 * - retry: 2 with exponential backoff - Handle transient network errors
 * - refetchOnWindowFocus: true - Validate data when popup reopens
 * - refetchOnReconnect: true - Refetch when network reconnects
 * - refetchOnMount: false - Trust cache on popup re-open (staleTime handles freshness)
 * - throwOnError: false - Let hooks handle errors gracefully
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caching Strategy
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Retry Strategy
      retry: 2,
      retryDelay: (attemptIndex: number): number =>
        Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch Behavior
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: false,

      // Error Handling
      throwOnError: false,
    },
  },
});

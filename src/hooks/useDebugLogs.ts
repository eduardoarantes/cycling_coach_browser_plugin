/**
 * Hook for managing TrainingPeaks API debug logs
 *
 * Provides access to API call history for troubleshooting
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { ApiLogEntry } from '@/types/debugLog.types';
import type { GetDebugLogsMessage, ClearDebugLogsMessage } from '@/types';
import { logger } from '@/utils/logger';

/** Response type from GET_DEBUG_LOGS message */
interface DebugLogsResponse {
  logs: ApiLogEntry[];
}

/** Response type from CLEAR_DEBUG_LOGS message */
interface ClearLogsResponse {
  success: boolean;
}

/**
 * Fetch debug logs from background worker
 */
async function fetchDebugLogs(): Promise<ApiLogEntry[]> {
  logger.debug('Fetching debug logs via background worker');

  const response = await chrome.runtime.sendMessage<
    GetDebugLogsMessage,
    DebugLogsResponse
  >({
    type: 'GET_DEBUG_LOGS',
  });

  logger.debug(`Retrieved ${response.logs.length} debug log entries`);
  return response.logs;
}

/**
 * Clear all debug logs via background worker
 */
async function clearAllDebugLogs(): Promise<void> {
  logger.debug('Clearing debug logs via background worker');

  const response = await chrome.runtime.sendMessage<
    ClearDebugLogsMessage,
    ClearLogsResponse
  >({
    type: 'CLEAR_DEBUG_LOGS',
  });

  if (!response.success) {
    throw new Error('Failed to clear debug logs');
  }

  logger.debug('Debug logs cleared successfully');
}

/**
 * Return type for useDebugLogs hook
 */
interface UseDebugLogsResult {
  /** Array of log entries (newest first) */
  logs: ApiLogEntry[];
  /** Whether logs are currently being fetched */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Manually refetch logs */
  refetch: UseQueryResult<ApiLogEntry[], Error>['refetch'];
  /** Clear all logs */
  clearLogs: () => void;
  /** Whether logs are being cleared */
  isClearingLogs: boolean;
}

/**
 * Custom hook for TrainingPeaks API debug logs
 *
 * @returns Debug logs data and control functions
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { logs, isLoading, refetch, clearLogs, isClearingLogs } = useDebugLogs();
 *
 *   if (isLoading) return <div>Loading logs...</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={() => refetch()}>Refresh</button>
 *       <button onClick={clearLogs} disabled={isClearingLogs}>Clear</button>
 *       {logs.map(log => <LogEntry key={log.id} log={log} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDebugLogs(): UseDebugLogsResult {
  const queryClient = useQueryClient();

  const query = useQuery<ApiLogEntry[], Error>({
    queryKey: ['debugLogs'],
    queryFn: fetchDebugLogs,
    // Logs should refresh frequently to show latest API calls
    staleTime: 5000, // 5 seconds
    // Keep logs available when navigating away
    gcTime: 60000, // 1 minute
  });

  const clearMutation = useMutation<void, Error>({
    mutationFn: clearAllDebugLogs,
    onSuccess: () => {
      // Invalidate and refetch logs after clearing
      void queryClient.invalidateQueries({ queryKey: ['debugLogs'] });
    },
  });

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    clearLogs: () => clearMutation.mutate(),
    isClearingLogs: clearMutation.isPending,
  };
}

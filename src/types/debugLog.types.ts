/**
 * Type definitions for debug API logging
 *
 * Used to track and display TrainingPeaks API call history
 * for troubleshooting when data doesn't load correctly.
 */

/**
 * Single API log entry representing one API request/response cycle
 */
export interface ApiLogEntry {
  /** Unique identifier (timestamp-random format) */
  id: string;
  /** Unix timestamp in milliseconds when request was made */
  timestamp: number;
  /** API endpoint path (e.g., '/users/v3/user') */
  endpoint: string;
  /** HTTP method (currently all TrainingPeaks API calls are GET) */
  method: 'GET';
  /** Base URL used for the request (TP API or RxBuilder) */
  baseUrl: string;
  /** HTTP status code (null if network error occurred) */
  status: number | null;
  /** Whether the API call succeeded */
  success: boolean;
  /** Duration of the request in milliseconds */
  durationMs: number;
  /** Error message if the request failed */
  errorMessage?: string;
  /** Error code if applicable (NO_TOKEN, VALIDATION_ERROR, etc.) */
  errorCode?: string;
  /** Human-readable operation name (e.g., "user profile", "libraries") */
  operationName: string;
}

/**
 * Export format for JSON download
 */
export interface ApiLogsExport {
  /** ISO timestamp when the export was created */
  exportedAt: string;
  /** Extension version at time of export */
  extensionVersion: string;
  /** Total number of logs in the export */
  logCount: number;
  /** Array of log entries (newest first) */
  logs: ApiLogEntry[];
}

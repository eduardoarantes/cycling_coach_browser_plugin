/**
 * Debug log service for managing TrainingPeaks API call logs
 *
 * Provides storage and retrieval of API request/response logs
 * to help users troubleshoot data loading issues.
 */

import { STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';
import { ApiLogEntriesSchema } from '@/schemas/debugLog.schema';
import type { ApiLogEntry, ApiLogsExport } from '@/types/debugLog.types';

/** Maximum number of log entries to keep in storage */
const MAX_LOG_ENTRIES = 100;
const REDACTED_VALUE = '[REDACTED]';

const AUTH_SCHEME_PATTERN =
  /((?:"|')?(?:authorization|proxy-authorization)(?:"|')?\s*[:=]\s*)(?:"|')?(Bearer|Basic)\s+[^"'\s,}\]]+(?:"|')?/gi;

const KEY_VALUE_SECRET_PATTERN =
  /((?:"|')?(?:apikey|apiKey|api_key|x-api-key|access_token|refresh_token|id_token|auth_token|intervals_api_key|mypeak_auth_token|mypeak_supabase_api_key|client_secret|password|secret|token)(?:"|')?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s}\]]+)/gi;

const COOKIE_PATTERN =
  /((?:"|')?(?:cookie|set-cookie)(?:"|')?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n]+)/gi;

const QUERY_PARAM_SECRET_PATTERN =
  /([?&](?:access_token|refresh_token|id_token|token|apikey|api_key|x-api-key|client_secret|password)=)([^&#]+)/gi;

const TRAININGPEAKS_TOKEN_PATTERN = /\bgAAAA[0-9A-Za-z._=-]{20,}\b/g;
const JWT_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/g;

function sanitizeText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value
    .replace(
      AUTH_SCHEME_PATTERN,
      (_match, prefix: string, scheme: string) =>
        `${prefix}${scheme} ${REDACTED_VALUE}`
    )
    .replace(
      KEY_VALUE_SECRET_PATTERN,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`
    )
    .replace(
      COOKIE_PATTERN,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`
    )
    .replace(
      QUERY_PARAM_SECRET_PATTERN,
      (_match, prefix: string) => `${prefix}${REDACTED_VALUE}`
    )
    .replace(TRAININGPEAKS_TOKEN_PATTERN, REDACTED_VALUE)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(/\[REDACTED\]\]+/g, REDACTED_VALUE);
}

function sanitizeLogEntry(entry: ApiLogEntry): ApiLogEntry {
  return {
    ...entry,
    endpoint: sanitizeText(entry.endpoint) ?? entry.endpoint,
    baseUrl: sanitizeText(entry.baseUrl) ?? entry.baseUrl,
    errorMessage: sanitizeText(entry.errorMessage),
    validationIssue: sanitizeText(entry.validationIssue),
    validationInput: sanitizeText(entry.validationInput),
  };
}

function sanitizeLogEntries(entries: ApiLogEntry[]): {
  logs: ApiLogEntry[];
  changed: boolean;
} {
  let changed = false;

  const logs = entries.map((entry) => {
    const sanitized = sanitizeLogEntry(entry);
    if (JSON.stringify(sanitized) !== JSON.stringify(entry)) {
      changed = true;
    }
    return sanitized;
  });

  return { logs, changed };
}

/**
 * Generate a unique ID for a log entry
 *
 * Format: timestamp-random (e.g., "1709654321000-abc123")
 */
function generateLogId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Add a new API log entry to storage
 *
 * Automatically prunes old entries to keep storage under MAX_LOG_ENTRIES.
 * Newest entries are added at the beginning of the array.
 *
 * @param entry - Partial log entry (id will be auto-generated)
 */
export async function addLog(
  entry: Omit<ApiLogEntry, 'id'>
): Promise<ApiLogEntry> {
  const newEntry = sanitizeLogEntry({
    ...entry,
    id: generateLogId(),
  });

  try {
    const existingLogs = await getLogs();

    // Add new entry at the beginning and prune to max size
    const updatedLogs = [newEntry, ...existingLogs].slice(0, MAX_LOG_ENTRIES);

    await chrome.storage.local.set({
      [STORAGE_KEYS.TRAININGPEAKS_API_LOGS]: updatedLogs,
    });

    logger.debug('Added API log entry:', newEntry.operationName);
    return newEntry;
  } catch (error) {
    logger.error('Failed to add API log entry:', error);
    // Return the entry even if storage failed - don't block API calls
    return newEntry;
  }
}

/**
 * Retrieve all API log entries from storage
 *
 * Returns entries sorted by timestamp (newest first).
 *
 * @returns Array of log entries
 */
export async function getLogs(): Promise<ApiLogEntry[]> {
  try {
    const data = await chrome.storage.local.get(
      STORAGE_KEYS.TRAININGPEAKS_API_LOGS
    );
    const rawLogs = data[STORAGE_KEYS.TRAININGPEAKS_API_LOGS];

    // Return empty array if no logs exist
    if (!rawLogs || !Array.isArray(rawLogs)) {
      return [];
    }

    // Validate with Zod schema
    const validated = ApiLogEntriesSchema.safeParse(rawLogs);

    if (!validated.success) {
      logger.warn('API logs validation failed, returning empty array:', {
        issues: validated.error.issues,
      });
      return [];
    }

    const sanitized = sanitizeLogEntries(validated.data);

    if (sanitized.changed) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TRAININGPEAKS_API_LOGS]: sanitized.logs,
      });
    }

    return sanitized.logs;
  } catch (error) {
    logger.error('Failed to retrieve API logs:', error);
    return [];
  }
}

/**
 * Clear all API log entries from storage
 */
export async function clearLogs(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.TRAININGPEAKS_API_LOGS);
    logger.info('Cleared all API logs');
  } catch (error) {
    logger.error('Failed to clear API logs:', error);
    throw error;
  }
}

/**
 * Export logs as a JSON-formatted object
 *
 * Includes metadata like export timestamp and extension version.
 *
 * @returns Export object with logs and metadata
 */
export async function exportLogsAsJson(): Promise<ApiLogsExport> {
  const logs = await getLogs();

  // Get extension version from manifest
  let extensionVersion = 'unknown';
  try {
    const manifest = chrome.runtime.getManifest();
    extensionVersion = manifest.version;
  } catch {
    // Fallback if manifest unavailable
    extensionVersion = 'unknown';
  }

  return {
    exportedAt: new Date().toISOString(),
    extensionVersion,
    logCount: logs.length,
    logs,
  };
}

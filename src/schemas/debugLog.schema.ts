/**
 * Zod validation schemas for debug API logging
 *
 * Validates API log entries stored in chrome.storage
 */

import { z } from 'zod';

/**
 * Schema for a single API log entry
 */
export const ApiLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().positive(),
  endpoint: z.string().min(1),
  method: z.literal('GET'),
  baseUrl: z.string().url(),
  status: z.number().int().nullable(),
  success: z.boolean(),
  durationMs: z.number().nonnegative(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  operationName: z.string().min(1),
});

/**
 * Schema for array of log entries
 */
export const ApiLogEntriesSchema = z.array(ApiLogEntrySchema);

/**
 * Schema for export format
 */
export const ApiLogsExportSchema = z.object({
  exportedAt: z.string().datetime(),
  extensionVersion: z.string(),
  logCount: z.number().int().nonnegative(),
  logs: ApiLogEntriesSchema,
});

/**
 * Inferred types from schemas
 */
export type ApiLogEntry = z.infer<typeof ApiLogEntrySchema>;
export type ApiLogEntries = z.infer<typeof ApiLogEntriesSchema>;
export type ApiLogsExport = z.infer<typeof ApiLogsExportSchema>;

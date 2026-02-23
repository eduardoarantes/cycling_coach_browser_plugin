/**
 * Zod validation schemas for Intervals.icu API types
 *
 * Provides runtime validation for API responses and storage data
 */

import { z } from 'zod';

/**
 * Schema for Intervals.icu event response
 * Validates data returned from bulk upload endpoint
 */
export const IntervalsEventResponseSchema = z.object({
  id: z.number().positive(),
  start_date_local: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  name: z.string().optional(),
  icu_training_load: z.number().optional(),
});

/**
 * Schema for bulk response (array of events)
 */
export const IntervalsBulkResponseSchema = z.array(
  IntervalsEventResponseSchema
);

/**
 * Schema for API key storage in chrome.storage.local
 */
export const IntervalsApiKeyStorageSchema = z.object({
  intervals_api_key: z.string().optional(),
});

/**
 * Inferred TypeScript types from schemas
 */
export type IntervalsEventResponse = z.infer<
  typeof IntervalsEventResponseSchema
>;
export type IntervalsBulkResponse = z.infer<typeof IntervalsBulkResponseSchema>;
export type IntervalsApiKeyStorage = z.infer<
  typeof IntervalsApiKeyStorageSchema
>;

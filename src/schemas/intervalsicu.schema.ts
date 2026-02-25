/**
 * Zod validation schemas for Intervals.icu API types
 *
 * Provides runtime validation for API responses and storage data
 * Based on library/folder-based export (not calendar events)
 */

import { z } from 'zod';

const IntervalsAthleteIdSchema = z.union([
  z.number().positive(),
  z.string().min(1),
]);
const IntervalsFolderVisibilitySchema = z.enum(['PRIVATE', 'PUBLIC']);
const IntervalsWorkoutTargetSchema = z.enum(['AUTO', 'POWER', 'HR', 'PACE']);

/**
 * Schema for folder creation payload
 * POST /api/v1/athlete/{id}/folders
 */
export const IntervalsFolderPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/**
 * Schema for PLAN folder creation payload
 * POST /api/v1/athlete/{id}/folders
 */
export const IntervalsPlanFolderPayloadSchema = z.object({
  type: z.literal('PLAN'),
  name: z.string().min(1),
  start_date_local: z.string().min(1),
  description: z.string().optional(),
  visibility: IntervalsFolderVisibilitySchema.optional(),
  duration_weeks: z.number().int().positive().optional(),
  num_workouts: z.number().int().nonnegative().optional(),
  activity_types: z.array(z.string().min(1)).optional(),
  workout_targets: z.array(IntervalsWorkoutTargetSchema).optional(),
});

/**
 * Schema for folder response
 * Validates data returned from folder creation endpoint
 */
export const IntervalsFolderResponseSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1),
  athlete_id: IntervalsAthleteIdSchema,
  type: z.string().nullable().optional(),
  start_date_local: z.string().nullable().optional(),
  created: z.string().optional(),
});

/**
 * Schema for folder list responses
 * GET /api/v1/athlete/{id}/folders
 */
export const IntervalsFolderListResponseSchema = z.array(
  IntervalsFolderResponseSchema.passthrough()
);

/**
 * Schema for workout template payload (library-based, no dates)
 * POST /api/v1/athlete/{id}/workouts
 */
export const IntervalsWorkoutPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  type: z.string().min(1),
  category: z.literal('WORKOUT'),
  folder_id: z.number().optional(),
  workout_doc: z.string().optional(),
  moving_time: z.number().optional(),
  icu_training_load: z.number().optional(),
});

/**
 * Schema for workout payloads stored inside a PLAN folder
 * POST /api/v1/athlete/{id}/workouts
 */
export const IntervalsPlanWorkoutPayloadSchema =
  IntervalsWorkoutPayloadSchema.extend({
    folder_id: z.number().int().positive(),
    day: z.number().int().nonnegative(),
    for_week: z.boolean(),
    days: z.number().int().nullable().optional(),
  }).strict();

/**
 * Schema for NOTE payloads stored inside folders/plan folders via /workouts
 * Observed payload shape from Intervals UI:
 * { name, description, type: "NOTE", color, day, folder_id }
 */
export const IntervalsPlanNotePayloadSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    type: z.literal('NOTE'),
    color: z.string().min(1),
    day: z.number().int().nonnegative(),
    folder_id: z.number().int().positive(),
  })
  .strict();

/**
 * Schema for event marker payloads stored inside PLAN folders via /workouts
 * (race annotation type)
 */
export const IntervalsPlanEventPayloadSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    type: z.string().min(1),
    category: z.literal('RACE_A'),
    day: z.number().int().nonnegative(),
    folder_id: z.number().int().positive(),
  })
  .strict();

/**
 * Schema for workout template response
 * Validates data returned from workout creation endpoint
 */
export const IntervalsWorkoutResponseSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1),
  type: z.string().min(1),
  category: z.string().optional(),
  folder_id: z.number().nullable().optional(),
  athlete_id: IntervalsAthleteIdSchema,
});

/**
 * Schema for bulk workout response (array of workouts)
 */
export const IntervalsWorkoutBulkResponseSchema = z.array(
  IntervalsWorkoutResponseSchema
);

/**
 * Schema for export configuration
 */
export const IntervalsIcuExportConfigSchema = z.object({
  apiKey: z.string().min(1),
  libraryName: z.string().min(1),
  createFolder: z.boolean().optional(),
});

/**
 * Schema for athlete info response
 * GET /api/v1/athlete/{id}
 */
export const IntervalsAthleteResponseSchema = z.object({
  id: IntervalsAthleteIdSchema,
  name: z.string().optional(),
  email: z.string().optional(),
});

/**
 * Schema for API key storage in chrome.storage.local
 */
export const IntervalsApiKeyStorageSchema = z.object({
  intervals_api_key: z.string().optional(),
});

/**
 * Inferred TypeScript types from schemas
 */
export type IntervalsFolderPayload = z.infer<
  typeof IntervalsFolderPayloadSchema
>;
export type IntervalsPlanFolderPayload = z.infer<
  typeof IntervalsPlanFolderPayloadSchema
>;
export type IntervalsFolderResponse = z.infer<
  typeof IntervalsFolderResponseSchema
>;
export type IntervalsWorkoutPayload = z.infer<
  typeof IntervalsWorkoutPayloadSchema
>;
export type IntervalsPlanWorkoutPayload = z.infer<
  typeof IntervalsPlanWorkoutPayloadSchema
>;
export type IntervalsPlanNotePayload = z.infer<
  typeof IntervalsPlanNotePayloadSchema
>;
export type IntervalsPlanEventPayload = z.infer<
  typeof IntervalsPlanEventPayloadSchema
>;
export type IntervalsWorkoutResponse = z.infer<
  typeof IntervalsWorkoutResponseSchema
>;
export type IntervalsWorkoutBulkResponse = z.infer<
  typeof IntervalsWorkoutBulkResponseSchema
>;
export type IntervalsFolderListResponse = z.infer<
  typeof IntervalsFolderListResponseSchema
>;
export type IntervalsAthleteResponse = z.infer<
  typeof IntervalsAthleteResponseSchema
>;
export type IntervalsIcuExportConfig = z.infer<
  typeof IntervalsIcuExportConfigSchema
>;
export type IntervalsApiKeyStorage = z.infer<
  typeof IntervalsApiKeyStorageSchema
>;

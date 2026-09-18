/**
 * Result schemas for the captured-workout import requests on the site-control
 * channel.
 *
 * The request side is parsed in `siteControl.schema.ts` with every other
 * request. These describe what the extension *sends back* for the three
 * captured-workout requests, and exist so the wire shape is pinned by tests on
 * both sides of the channel: the extension checks its handlers emit exactly
 * this, and the PlanMyPeak app checks its readers accept exactly this, both
 * against the same fixture file (`tests/fixtures/siteControl/captured-imports.json`).
 *
 * Nothing here is used to *build* a response — the handlers construct typed
 * objects — so a schema drifting from the type is caught by the type checker,
 * and a handler drifting from the fixture is caught by the test.
 */

import { z } from 'zod';
import {
  CAPTURED_IMPORT_BLOCKED_REASONS,
  CAPTURED_IMPORT_STATES,
} from '@/types/siteControl.types';

const NonNegativeInt = z.number().int().min(0);

export const CapturedImportBlockedReasonSchema = z.enum(
  CAPTURED_IMPORT_BLOCKED_REASONS
);

export const CapturedImportStateSchema = z.enum(CAPTURED_IMPORT_STATES);

export const CapturedImportRefSchema = z
  .object({
    operationId: z.string().min(1),
    state: CapturedImportStateSchema,
  })
  .strict();

/**
 * `GET_CAPTURED_WORKOUT_SUMMARY`.
 *
 * The refinement is the contract's one cross-field rule: a count is a claim of
 * knowledge, so it may only be present when the scan is complete. `checking`
 * and `blocked` carry `null` — a page reading `0` from either would hide
 * workouts that are really missing.
 */
export const CapturedWorkoutSummaryResultSchema = z
  .object({
    contextId: z.string().min(1).nullable(),
    coachId: z.string().min(1).nullable(),
    revision: NonNegativeInt,
    state: z.enum(['checking', 'ready', 'blocked']),
    missingCount: NonNegativeInt.nullable(),
    unlinkedCount: NonNegativeInt,
    blockedReason: CapturedImportBlockedReasonSchema.optional(),
    activeOperation: CapturedImportRefSchema.nullable(),
    latestOperation: CapturedImportRefSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.state === 'ready'
        ? value.missingCount !== null && value.contextId !== null
        : value.missingCount === null,
    {
      message:
        'missingCount and contextId are present exactly when the summary is ready',
    }
  )
  .refine(
    (value) => value.state !== 'blocked' || value.blockedReason !== undefined,
    { message: 'a blocked summary names its reason' }
  );

export const ImportMissingWorkoutsResultSchema = z
  .object({
    operationId: z.string().min(1),
    state: z.enum(['running', 'completed', 'blocked']),
    blockedReason: CapturedImportBlockedReasonSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.state !== 'blocked' || value.blockedReason !== undefined,
    { message: 'a blocked start names its reason' }
  );

export const CapturedImportErrorSchema = z
  .object({
    title: z.string(),
    message: z.string().min(1),
  })
  .strict();

/**
 * `GET_CAPTURED_WORKOUT_IMPORT_STATUS`.
 *
 * All counts are workouts. The refinement pins the arithmetic the page relies
 * on to render progress honestly: processed is the sum of the three outcomes
 * and never runs past the total.
 */
export const CapturedWorkoutImportStatusResultSchema = z
  .object({
    operationId: z.string().min(1),
    contextId: z.string().min(1),
    state: CapturedImportStateSchema,
    totalCount: NonNegativeInt,
    processedCount: NonNegativeInt,
    importedCount: NonNegativeInt,
    alreadyPresentCount: NonNegativeInt,
    failedCount: NonNegativeInt,
    blockedReason: CapturedImportBlockedReasonSchema.optional(),
    errors: z.array(CapturedImportErrorSchema),
    startedAt: NonNegativeInt,
    updatedAt: NonNegativeInt,
  })
  .strict()
  .refine(
    (value) =>
      value.processedCount ===
        value.importedCount + value.alreadyPresentCount + value.failedCount &&
      value.processedCount <= value.totalCount,
    { message: 'processedCount must equal the outcome sum and fit the total' }
  )
  .refine(
    (value) => value.state !== 'blocked' || value.blockedReason !== undefined,
    { message: 'a blocked operation names its reason' }
  );

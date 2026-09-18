/**
 * Zod schemas for workouts captured from TrainingPeaks calendar writes.
 *
 * Two shapes live here:
 *
 * - `CapturedWorkoutPayloadSchema` is the tolerant subset of the TrainingPeaks
 *   create/update request+response body we keep. Everything the PlanMyPeak
 *   transformer and the popup need, nothing else: the raw body is 3–5× larger
 *   and most of it is a `polyline` visualization array nothing reads.
 * - `CapturedWorkoutRecordSchema` is what is stored in `chrome.storage.local`
 *   under `captured_workouts`, keyed by `environment:athleteId:workoutId`.
 *
 * Reads are tolerant per entry: a malformed record is dropped, never the whole
 * map, so one bad row cannot hide a coach's list.
 */

import { z } from 'zod';
import { WorkoutStructureSchema } from './trainingPlan.schema';
import type { TrainingPeaksEnvironment } from '@/utils/constants';

export const CapturedWorkoutEnvironmentSchema = z.enum([
  'production',
  'sandbox',
]);

export const CapturedWorkoutStatusSchema = z.enum([
  'pending',
  'sent',
  'dismissed',
]);

export type CapturedWorkoutStatus = z.infer<typeof CapturedWorkoutStatusSchema>;

const NullableNumber = z.number().nullable().optional();
const NullableString = z.string().nullable().optional();

/**
 * Tolerant subset of the TrainingPeaks workout body.
 *
 * `structure` arrives as a JSON string on the create/update request and may be
 * a string, an object or null on the response; all three are accepted here and
 * normalized later. Parsing an object through `WorkoutStructureSchema` drops
 * unknown keys, which is what removes `polyline`.
 */
export const CapturedWorkoutPayloadSchema = z.object({
  athleteId: z.number(),
  workoutId: z.number(),
  title: z.string(),
  workoutDay: z.string(),
  workoutTypeValueId: z.number(),
  structure: z.union([z.string(), WorkoutStructureSchema, z.null()]).optional(),
  totalTimePlanned: NullableNumber,
  tssPlanned: NullableNumber,
  ifPlanned: NullableNumber,
  distancePlanned: NullableNumber,
  caloriesPlanned: NullableNumber,
  velocityPlanned: NullableNumber,
  energyPlanned: NullableNumber,
  elevationGainPlanned: NullableNumber,
  description: NullableString,
  coachComments: NullableString,
  userTags: NullableString,
  lastModifiedDate: NullableString,
});

export type CapturedWorkoutPayload = z.infer<
  typeof CapturedWorkoutPayloadSchema
>;

/**
 * The compact, PlanWorkout-compatible workout stored on a record.
 */
export const CapturedWorkoutDataSchema = z.object({
  title: z.string(),
  workoutDay: z.string(),
  workoutTypeValueId: z.number(),
  structure: WorkoutStructureSchema.nullable(),
  totalTimePlanned: z.number().nullable(),
  tssPlanned: z.number().nullable(),
  ifPlanned: z.number().nullable(),
  distancePlanned: z.number().nullable(),
  caloriesPlanned: z.number().nullable(),
  velocityPlanned: z.number().nullable(),
  energyPlanned: z.number().nullable(),
  elevationGainPlanned: z.number().nullable(),
  description: z.string().nullable(),
  coachComments: z.string().nullable(),
  userTags: z.string().nullable(),
  lastModifiedDate: z.string().nullable(),
});

export type CapturedWorkoutData = z.infer<typeof CapturedWorkoutDataSchema>;

/** Optional historical coach annotation. Never a visibility or import gate. */
export const CapturedWorkoutOwnerSchema = z.object({
  coachId: z.string().min(1),
  destination: z.string().min(1),
});

export type CapturedWorkoutOwner = z.infer<typeof CapturedWorkoutOwnerSchema>;

/**
 * What became of a capture in one PlanMyPeak destination for one coach.
 *
 * `imported` means an upload landed; `already_present` means reconciliation
 * found the exact provider identity there without uploading. Either one
 * removes the capture from that destination's missing count, and neither says
 * anything about any other destination — which is why these are keyed per
 * destination rather than folded into the global `status`.
 */
export const CapturedWorkoutAcknowledgementSchema = z.object({
  coachId: z.string().min(1),
  destination: z.string().min(1),
  reason: z.enum(['imported', 'already_present']),
  at: z.number(),
  planMyPeakWorkoutId: z.string().optional(),
  libraryName: z.string().optional(),
});

export type CapturedWorkoutAcknowledgement = z.infer<
  typeof CapturedWorkoutAcknowledgementSchema
>;

/** Map key for an acknowledgement: one per (destination, coach). */
export function acknowledgementKey(owner: CapturedWorkoutOwner): string {
  return `${owner.destination}::${owner.coachId}`;
}

export const CapturedWorkoutRecordSchema = z.object({
  /** `environment:athleteId:workoutId` */
  key: z.string(),
  athleteId: z.number(),
  workoutId: z.number(),
  environment: CapturedWorkoutEnvironmentSchema,
  /** First seen */
  capturedAt: z.number(),
  /** Last refreshed from a create/update capture */
  updatedAt: z.number(),
  status: CapturedWorkoutStatusSchema,
  sentAt: z.number().optional(),
  planMyPeakWorkoutId: z.string().optional(),
  planMyPeakLibraryName: z.string().optional(),
  lastSendError: z.string().optional(),
  workout: CapturedWorkoutDataSchema,
  /** Absent on records stored before ownership existed, or without a session. */
  owner: CapturedWorkoutOwnerSchema.optional(),
  /** Keyed by {@link acknowledgementKey}. Absent until a destination has one. */
  acknowledgements: z
    .record(z.string(), CapturedWorkoutAcknowledgementSchema)
    .optional(),
});

export type CapturedWorkoutRecord = z.infer<typeof CapturedWorkoutRecordSchema>;

/** Whether historical metadata matches this coach; never an access check. */
export function isOwnedBy(
  record: CapturedWorkoutRecord,
  owner: CapturedWorkoutOwner
): boolean {
  return (
    record.owner !== undefined &&
    record.owner.coachId === owner.coachId &&
    record.owner.destination === owner.destination
  );
}

/** The record's acknowledgement for this destination and coach, if any. */
export function acknowledgementFor(
  record: CapturedWorkoutRecord,
  owner: CapturedWorkoutOwner
): CapturedWorkoutAcknowledgement | undefined {
  return record.acknowledgements?.[acknowledgementKey(owner)];
}

/** All undismissed captures not acknowledged in the current destination. */
export function isImportCandidateFor(
  record: CapturedWorkoutRecord,
  owner: CapturedWorkoutOwner
): boolean {
  return (
    record.status !== 'dismissed' &&
    acknowledgementFor(record, owner) === undefined
  );
}

/**
 * Informational compatibility count of pending records without a coach
 * annotation. Missing metadata does not prevent visibility or importing.
 */
export function countUnlinkedCapturedWorkouts(
  records: Iterable<CapturedWorkoutRecord>
): number {
  let count = 0;
  for (const record of records) {
    if (record.owner === undefined && record.status === 'pending') {
      count += 1;
    }
  }
  return count;
}

export const CapturedWorkoutsStorageSchema = z.record(
  z.string(),
  CapturedWorkoutRecordSchema
);

export type CapturedWorkoutsStorage = z.infer<
  typeof CapturedWorkoutsStorageSchema
>;

/**
 * Storage key for one captured workout.
 *
 * The environment is part of the key because sandbox and production workout
 * ids are separate namespaces: the same number can name two different
 * workouts, and a key without the environment would let one overwrite the
 * other and inherit its lifecycle.
 */
export function buildCapturedWorkoutKey(
  environment: TrainingPeaksEnvironment,
  athleteId: number,
  workoutId: number
): string {
  return `${environment}:${athleteId}:${workoutId}`;
}

/**
 * Parse the stored map, keeping valid entries and dropping malformed ones.
 * A value that is not an object at all yields an empty map.
 */
export function parseCapturedWorkoutsStorage(
  value: unknown
): CapturedWorkoutsStorage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: CapturedWorkoutsStorage = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const parsed = CapturedWorkoutRecordSchema.safeParse(entry);
    if (parsed.success) {
      result[key] = parsed.data;
    }
  }

  return result;
}

/** Records ordered by `capturedAt` descending (newest first). */
export function sortCapturedWorkoutsNewestFirst(
  records: Iterable<CapturedWorkoutRecord>
): CapturedWorkoutRecord[] {
  return [...records].sort((a, b) => b.capturedAt - a.capturedAt);
}

/** Number of records still awaiting action. */
export function countPendingCapturedWorkouts(
  records: Iterable<CapturedWorkoutRecord>
): number {
  let count = 0;
  for (const record of records) {
    if (record.status === 'pending') {
      count += 1;
    }
  }
  return count;
}

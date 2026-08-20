/**
 * Zod schemas for the PlanMyPeak coach workout-library API.
 *
 * These mirror the published contract (`CoachWorkoutSummary`,
 * `CoachWorkoutDetail`, `WorkoutLibrarySummary` in the PlanMyPeak
 * `packages/contracts` OpenAPI schemas) rather than accepting both camelCase
 * and snake_case: the contract is fixed and published, so tolerating both
 * shapes would only hide drift.
 */

import { z } from 'zod';

const IntegerSchema = z.coerce.number().int();
const NonNegativeIntSchema = IntegerSchema.min(0);
const NumberSchema = z.coerce.number();

/**
 * A workout library — the container. `/workout-libraries` returns these;
 * `/workout-library` returns the workouts inside them.
 */
export const PlanMyPeakLibrarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  workoutCount: NonNegativeIntSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlanMyPeakLibrary = z.infer<typeof PlanMyPeakLibrarySchema>;

export const PlanMyPeakLibrariesResponseSchema = z.object({
  data: z.array(PlanMyPeakLibrarySchema),
});

export type PlanMyPeakLibrariesResponse = z.infer<
  typeof PlanMyPeakLibrariesResponseSchema
>;

/** Disciplines PlanMyPeak accepts. We send these, so the enum is exact. */
export const PLANMYPEAK_WORKOUT_TYPES = [
  'bike',
  'mountain_bike',
  'run',
  'swim',
  'walk',
  'strength',
  'cross_train',
  'cross_country_ski',
  'rowing',
  'race',
  'rest_day',
  'note',
  'other',
] as const;

export const PlanMyPeakWorkoutTypeSchema = z.enum(PLANMYPEAK_WORKOUT_TYPES);

export type PlanMyPeakWorkoutTypeValue = z.infer<
  typeof PlanMyPeakWorkoutTypeSchema
>;

/** Counts derived from the structure. `stepCount` is post-expansion. */
const PlanMyPeakDerivedSummarySchema = z.object({
  segmentCount: NonNegativeIntSchema,
  stepCount: NonNegativeIntSchema,
  estimatedDurationSeconds: NumberSchema.nullable(),
});

/**
 * Intensity profile, or null when the structure yields none.
 *
 * Percentages are always of a threshold, never absolute: a library workout
 * belongs to a coach, so there is no athlete FTP or LTHR to convert against.
 * `metric` says which threshold, and `unit` refines it — %LTHR and %maxHR are
 * different scales and must not share zone boundaries.
 */
const PlanMyPeakWorkoutProfileSchema = z.object({
  metric: z.enum(['power', 'heartrate']),
  unit: z.enum(['percentOfFtp', 'percentOfThresholdHr', 'percentOfMaxHr']),
  segments: z.array(
    z.object({ percentOfThreshold: NumberSchema, seconds: NumberSchema })
  ),
  durationSeconds: NumberSchema,
  /**
   * Null for a heart-rate workout with no provider load: there is no normalized
   * power to derive one from, and the server will not estimate. Guard before
   * formatting — this is never 0 standing in for "unknown".
   */
  intensityFactor: NumberSchema.nullable(),
  tss: NumberSchema.nullable(),
  /**
   * Whether the load above is ours (`derived`) or came from the provider that
   * supplied the workout (`provider`). Never present a provider figure as a
   * derived one.
   */
  loadSource: z.enum(['derived', 'provider']).nullable(),
  peakPercentOfThreshold: NumberSchema,
});

export type PlanMyPeakWorkoutProfile = z.infer<
  typeof PlanMyPeakWorkoutProfileSchema
>;

/** The library a workout is actually filed in, on every read and write. */
const PlanMyPeakLibraryRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * A workout as PlanMyPeak returns it.
 *
 * `rideType` is deliberately a loose string rather than an enum: the server
 * derives it and may add vocabulary, and we only ever display it.
 * `structure` is present on detail reads and absent from list rows.
 */
export const PlanMyPeakWorkoutLibraryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  workoutType: PlanMyPeakWorkoutTypeSchema,
  rideType: z.string().nullable(),
  summary: PlanMyPeakDerivedSummarySchema,
  profile: PlanMyPeakWorkoutProfileSchema.nullable(),
  library: PlanMyPeakLibraryRefSchema,
  provider: z.string().nullable(),
  providerWorkoutId: z.string().nullable(),
  providerMetadata: z.record(z.string(), z.unknown()).nullable(),
  /**
   * Load figures we passed through from TrainingPeaks, readable back so a write
   * can be verified — relevant because undeclared keys are stripped rather than
   * rejected on some paths.
   */
  providerIntensityFactor: NumberSchema.nullable(),
  providerTss: NumberSchema.nullable(),
  structure: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PlanMyPeakWorkoutLibraryItem = z.infer<
  typeof PlanMyPeakWorkoutLibraryItemSchema
>;

/**
 * Response from a workout write. The body is identical for a create and an
 * update — the HTTP status (201 vs 200) is what distinguishes them.
 */
export const PlanMyPeakCreateWorkoutResponseSchema =
  PlanMyPeakWorkoutLibraryItemSchema;

const PlanMyPeakPaginationSchema = z.object({
  limit: NonNegativeIntSchema,
  offset: NonNegativeIntSchema,
  total: NonNegativeIntSchema,
});

/**
 * Facet counts. Each group is counted against the search and the *other*
 * groups' filters but never its own selection, so these do not sum to
 * `pagination.total`. `incomplete` means the library outgrew the bounded scan
 * the counts came from.
 */
const PlanMyPeakFacetCountsSchema = z.object({
  workoutType: z.record(z.string(), IntegerSchema),
  rideType: z.record(z.string(), IntegerSchema),
  duration: z.record(z.string(), IntegerSchema),
  total: NonNegativeIntSchema,
  incomplete: z.boolean(),
});

export const PlanMyPeakWorkoutLibraryResponseSchema = z.object({
  data: z.array(PlanMyPeakWorkoutLibraryItemSchema),
  pagination: PlanMyPeakPaginationSchema,
  facets: PlanMyPeakFacetCountsSchema,
});

export type PlanMyPeakWorkoutLibraryResponse = z.infer<
  typeof PlanMyPeakWorkoutLibraryResponseSchema
>;

/**
 * Per-group result returned by the TrainingPeaks athlete-group ingest endpoint.
 */
export const PlanMyPeakIngestedAthleteGroupSchema = z
  .object({
    trainingPeaksGroupId: z.string(),
    name: z.string(),
    valueId: z.string().optional(),
    isDefault: z.boolean().optional(),
    athletesAssociated: NonNegativeIntSchema.optional(),
    skippedAthleteIds: z.array(z.string()).optional(),
  })
  .passthrough();

/**
 * Response from POST /athlete-tags/ingest/training-peaks.
 * Summarizes how many groups/athletes were ingested and which athletes were
 * skipped (e.g. TrainingPeaks athletes with no matching PlanMyPeak athlete).
 */
export const PlanMyPeakIngestAthleteGroupsResponseSchema = z
  .object({
    groupsProcessed: NonNegativeIntSchema.optional(),
    athletesAssociated: NonNegativeIntSchema.optional(),
    skippedAthleteIds: z.array(z.string()).optional(),
    groups: z.array(PlanMyPeakIngestedAthleteGroupSchema).optional(),
  })
  .passthrough();

export type PlanMyPeakIngestedAthleteGroup = z.infer<
  typeof PlanMyPeakIngestedAthleteGroupSchema
>;

export type PlanMyPeakIngestAthleteGroupsResponse = z.infer<
  typeof PlanMyPeakIngestAthleteGroupsResponseSchema
>;

/**
 * A linked external provider account on a PlanMyPeak coach profile
 * (e.g. providerCode "training_peaks" with the TrainingPeaks user id).
 */
export const PlanMyPeakCoachExternalIdSchema = z
  .object({
    providerCode: z.string(),
    externalId: z.string(),
  })
  .passthrough();

/**
 * PlanMyPeak coach profile from GET /api/backend/coaches/me.
 * Permissive: only the fields the extension needs are typed.
 */
export const PlanMyPeakCoachSchema = z
  .object({
    id: z.string(),
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string().optional(),
    externalIds: z.array(PlanMyPeakCoachExternalIdSchema).optional(),
  })
  .passthrough();

export type PlanMyPeakCoachExternalId = z.infer<
  typeof PlanMyPeakCoachExternalIdSchema
>;
export type PlanMyPeakCoach = z.infer<typeof PlanMyPeakCoachSchema>;

/** Provider code used by PlanMyPeak for linked TrainingPeaks accounts. */
export const TRAINING_PEAKS_PROVIDER_CODE = 'training_peaks';

/**
 * Extract the TrainingPeaks user id a coach profile is linked to, if any.
 */
export function getCoachTrainingPeaksExternalId(
  coach: PlanMyPeakCoach | null | undefined
): string | null {
  const match = coach?.externalIds?.find(
    (entry) => entry.providerCode === TRAINING_PEAKS_PROVIDER_CODE
  );
  return match?.externalId ?? null;
}

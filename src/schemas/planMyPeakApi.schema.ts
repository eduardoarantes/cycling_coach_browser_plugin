/**
 * Zod schemas for PlanMyPeak workout library API responses
 */

import { z } from 'zod';

const IntegerSchema = z.coerce.number().int();
const NonNegativeIntSchema = IntegerSchema.min(0);
const NumberSchema = z.coerce.number();

const NullableNumberSchema = z
  .union([NumberSchema, z.null()])
  .nullable()
  .optional();

const PlanMyPeakLibraryRawSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    owner_id: z.string().nullable().optional(),
    ownerId: z.string().nullable().optional(),
    is_system: z.boolean().optional(),
    isSystem: z.boolean().optional(),
    is_default: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    source_id: z.string().nullable().optional(),
    sourceId: z.string().nullable().optional(),
    created_at: z.string().optional(),
    createdAt: z.string().optional(),
    updated_at: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

/**
 * Normalized schema for a single PlanMyPeak workout library.
 * Accepts snake_case and camelCase keys returned by API variants.
 */
export const PlanMyPeakLibrarySchema = PlanMyPeakLibraryRawSchema.transform(
  (library) => ({
    id: library.id,
    name: library.name,
    owner_id: library.owner_id ?? library.ownerId ?? null,
    is_system: library.is_system ?? library.isSystem ?? false,
    is_default: library.is_default ?? library.isDefault ?? false,
    source_id: library.source_id ?? library.sourceId ?? null,
    created_at: library.created_at ?? library.createdAt ?? '',
    updated_at: library.updated_at ?? library.updatedAt ?? '',
  })
);

export type PlanMyPeakLibrary = z.infer<typeof PlanMyPeakLibrarySchema>;

const PlanMyPeakLibrariesEnvelopeSchema = z
  .object({
    libraries: z.array(PlanMyPeakLibrarySchema),
    total: NonNegativeIntSchema.optional(),
  })
  .passthrough()
  .transform((data) => ({
    libraries: data.libraries,
    total: data.total ?? data.libraries.length,
  }));

const PlanMyPeakLibrariesArraySchema = z
  .array(PlanMyPeakLibrarySchema)
  .transform((libraries) => ({
    libraries,
    total: libraries.length,
  }));

const PlanMyPeakLibrariesDataSchema = z
  .object({
    data: z.array(PlanMyPeakLibrarySchema),
  })
  .passthrough()
  .transform((data) => ({
    libraries: data.data,
    total: data.data.length,
  }));

const PlanMyPeakLibrariesItemsSchema = z
  .object({
    items: z.array(PlanMyPeakLibrarySchema),
  })
  .passthrough()
  .transform((data) => ({
    libraries: data.items,
    total: data.items.length,
  }));

/**
 * Schema for GET /workouts/libraries response.
 * Accepts wrapped and direct-array payload shapes.
 */
export const PlanMyPeakLibrariesResponseSchema = z.union([
  PlanMyPeakLibrariesEnvelopeSchema,
  PlanMyPeakLibrariesArraySchema,
  PlanMyPeakLibrariesDataSchema,
  PlanMyPeakLibrariesItemsSchema,
]);

export type PlanMyPeakLibrariesResponse = z.infer<
  typeof PlanMyPeakLibrariesResponseSchema
>;

const PlanMyPeakWorkoutLibraryItemRawSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    intensity: z.string().optional(),
    structure: z.unknown().optional(),
    base_duration_min: NumberSchema.optional(),
    baseDurationMin: NumberSchema.optional(),
    base_tss: NullableNumberSchema,
    baseTss: NullableNumberSchema,
    library_id: z.string().optional(),
    libraryId: z.string().optional(),
    source_id: z.string().nullable().optional(),
    sourceId: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Minimal normalized schema for a PlanMyPeak workout response.
 * Accepts additional fields because the API may evolve independently.
 */
export const PlanMyPeakWorkoutLibraryItemSchema =
  PlanMyPeakWorkoutLibraryItemRawSchema.transform((workout) => ({
    id: workout.id,
    name: workout.name,
    type: workout.type,
    intensity: workout.intensity ?? 'moderate',
    structure: workout.structure ?? {},
    base_duration_min:
      workout.base_duration_min ?? workout.baseDurationMin ?? 0,
    base_tss: workout.base_tss ?? workout.baseTss ?? null,
    library_id: workout.library_id ?? workout.libraryId ?? '',
    source_id: workout.source_id ?? workout.sourceId ?? null,
  }));

export type PlanMyPeakWorkoutLibraryItem = z.infer<
  typeof PlanMyPeakWorkoutLibraryItemSchema
>;

/**
 * Schema for POST /workouts/library response.
 * Supports both direct item and wrapped `{ workout: {...} }` payloads.
 */
export const PlanMyPeakCreateWorkoutResponseSchema = z
  .union([
    PlanMyPeakWorkoutLibraryItemSchema,
    z.object({
      workout: PlanMyPeakWorkoutLibraryItemSchema,
    }),
    z.object({
      data: PlanMyPeakWorkoutLibraryItemSchema,
    }),
  ])
  .transform((response) => {
    if ('workout' in response) {
      return response.workout;
    }
    if ('data' in response) {
      return response.data;
    }
    return response;
  });

export const PlanMyPeakWorkoutFiltersAppliedSchema = z
  .object({
    library_id: z.string().nullable().optional(),
    libraryId: z.string().nullable().optional(),
    source_id: z.string().nullable().optional(),
    sourceId: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((filters) => ({
    library_id: filters.library_id ?? filters.libraryId ?? null,
    source_id: filters.source_id ?? filters.sourceId ?? null,
  }));

const PlanMyPeakWorkoutLibraryEnvelopeSchema = z
  .object({
    workouts: z.array(PlanMyPeakWorkoutLibraryItemSchema),
    total: NonNegativeIntSchema.optional(),
    filters_applied: PlanMyPeakWorkoutFiltersAppliedSchema.optional(),
    filtersApplied: PlanMyPeakWorkoutFiltersAppliedSchema.optional(),
  })
  .passthrough()
  .transform((data) => ({
    workouts: data.workouts,
    total: data.total ?? data.workouts.length,
    filters_applied: data.filters_applied ?? data.filtersApplied,
  }));

const PlanMyPeakWorkoutLibraryArraySchema = z
  .array(PlanMyPeakWorkoutLibraryItemSchema)
  .transform((workouts) => ({
    workouts,
    total: workouts.length,
  }));

const PlanMyPeakWorkoutLibraryDataSchema = z
  .object({
    data: z.array(PlanMyPeakWorkoutLibraryItemSchema),
  })
  .passthrough()
  .transform((data) => ({
    workouts: data.data,
    total: data.data.length,
  }));

const PlanMyPeakWorkoutLibraryItemsSchema = z
  .object({
    items: z.array(PlanMyPeakWorkoutLibraryItemSchema),
  })
  .passthrough()
  .transform((data) => ({
    workouts: data.items,
    total: data.items.length,
  }));

/**
 * Schema for GET /workouts/library response.
 * Accepts wrapped and direct-array payload shapes.
 */
export const PlanMyPeakWorkoutLibraryResponseSchema = z.union([
  PlanMyPeakWorkoutLibraryEnvelopeSchema,
  PlanMyPeakWorkoutLibraryArraySchema,
  PlanMyPeakWorkoutLibraryDataSchema,
  PlanMyPeakWorkoutLibraryItemsSchema,
]);

export type PlanMyPeakWorkoutLibraryResponse = z.infer<
  typeof PlanMyPeakWorkoutLibraryResponseSchema
>;

/**
 * Zod validation schemas for PlanMyPeak workout format
 */
import { z } from 'zod';

/**
 * PlanMyPeak workout intensity target schema
 */
export const PlanMyPeakTargetSchema = z.object({
  type: z.enum([
    'power',
    'heartRate',
    'cadence',
    'pace',
    'speed',
    'strokeRate',
    'resistance',
  ]),
  minValue: z.number(),
  maxValue: z.number(),
  unit: z
    .enum([
      'percentOfFtp',
      'watts',
      'bpm',
      'percentOfMaxHr',
      'percentOfThresholdHr',
      'rpm',
      'roundOrStridePerMinute',
      'secondsPerKilometer',
      'secondsPerMile',
      'secondsPer100Meters',
      'secondsPer100Yards',
      'kilometersPerHour',
      'milesPerHour',
      'kilograms',
      'pounds',
      'percentOf1RM',
    ])
    .optional(),
});

/**
 * Step/segment length schema
 */
export const PlanMyPeakLengthSchema = z.object({
  unit: z.enum([
    'second',
    'minute',
    'hour',
    'meter',
    'kilometer',
    'mile',
    'repetition',
  ]),
  value: z.number(),
});

/**
 * Individual workout step schema
 */
export const PlanMyPeakStepSchema = z.object({
  name: z.string(),
  intensityClass: z.enum(['active', 'warmUp', 'rest', 'coolDown', 'recovery']),
  length: PlanMyPeakLengthSchema,
  openDuration: z.union([z.null(), z.boolean()]),
  targets: z.array(PlanMyPeakTargetSchema),
});

/**
 * Step or repetition block schema (recursive)
 */
export const PlanMyPeakStructureBlockSchema: z.ZodType<{
  type: 'step' | 'repetition';
  length: {
    unit:
      | 'second'
      | 'minute'
      | 'hour'
      | 'meter'
      | 'kilometer'
      | 'mile'
      | 'repetition';
    value: number;
  };
  steps: unknown[];
}> = z.lazy(() =>
  z.object({
    type: z.enum(['step', 'repetition']),
    length: PlanMyPeakLengthSchema,
    steps: z.array(
      z.union([PlanMyPeakStepSchema, PlanMyPeakStructureBlockSchema])
    ),
  })
);

/**
 * Workout structure schema
 */
export const PlanMyPeakStructureSchema = z.object({
  primaryIntensityMetric: z.enum([
    'percentOfFtp',
    'watts',
    'heartRate',
    'percentOfThresholdPace',
    'pace',
    'speed',
    'resistance',
  ]),
  primaryLengthMetric: z.enum(['duration', 'distance']),
  structure: z.array(PlanMyPeakStructureBlockSchema),
});

export const SportTypeSchema = z.enum([
  'cycling',
  'running',
  'swimming',
  'strength',
]);

/**
 * Training phase schema
 */
export const TrainingPhaseSchema = z.enum([
  'Base',
  'Build',
  'Peak',
  'Recovery',
  'Foundation',
  'Taper',
]);

/**
 * Workout type schema
 */
export const WorkoutTypeSchema = z.enum([
  'mixed',
  'vo2max',
  'threshold',
  'sweet_spot',
  'tempo',
  'endurance',
  'recovery',
  'easy',
  'interval',
  'long_run',
  'fartlek',
  'progression',
  'hill_repeats',
  'technique',
  'sprint',
  'strength',
  'hypertrophy',
  'power',
  'circuit',
]);

/**
 * Intensity level schema
 */
export const IntensityLevelSchema = z.enum([
  'easy',
  'moderate',
  'hard',
  'very_hard',
]);

/**
 * Complete PlanMyPeak workout schema
 */
export const PlanMyPeakWorkoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  detailed_description: z.string().nullable(),
  sport_type: SportTypeSchema,
  type: WorkoutTypeSchema,
  intensity: IntensityLevelSchema,
  suitable_phases: z.array(TrainingPhaseSchema),
  suitable_weekdays: z.array(z.string()).nullable(),
  structure: PlanMyPeakStructureSchema,
  base_duration_min: z.number(),
  base_tss: z.number(),
  variable_components: z.unknown().nullable(),
  source_file: z.string(),
  source_format: z.literal('json'),
  signature: z.string(),
  source_id: z.string().nullable().optional(),
});

/**
 * Export configuration schema
 */
export const PlanMyPeakExportConfigSchema = z.object({
  fileName: z.string().optional(),
  createFolder: z.boolean().optional(),
  existingLibraryAction: z.enum(['replace', 'append']).optional(),
  targetLibraryName: z.string().optional(),
  targetLibraryId: z.string().optional(),
  includeMetadata: z.boolean().optional(),
  defaultWorkoutType: WorkoutTypeSchema.optional(),
  defaultIntensity: IntensityLevelSchema.optional(),
  defaultSuitablePhases: z.array(TrainingPhaseSchema).optional(),
});

export const PlanMyPeakWeekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const PlanMyPeakTrainingPlanMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  goal: z.string().optional(),
  targetFtp: z.number().int().positive().nullable().optional(),
  source_id: z.string().nullable().optional(),
});

export const PlanMyPeakWorkoutPlacementSummarySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  sport_type: SportTypeSchema,
  base_duration_min: z.number().int().positive(),
  base_tss: z.number().nonnegative(),
});

export const PlanMyPeakWorkoutPlacementSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  workoutKey: z.string().min(1),
  workout: PlanMyPeakWorkoutPlacementSummarySchema,
});

export const PlanMyPeakWeekWorkoutsDataSchema = z
  .object({
    monday: z.array(PlanMyPeakWorkoutPlacementSchema),
    tuesday: z.array(PlanMyPeakWorkoutPlacementSchema),
    wednesday: z.array(PlanMyPeakWorkoutPlacementSchema),
    thursday: z.array(PlanMyPeakWorkoutPlacementSchema),
    friday: z.array(PlanMyPeakWorkoutPlacementSchema),
    saturday: z.array(PlanMyPeakWorkoutPlacementSchema),
    sunday: z.array(PlanMyPeakWorkoutPlacementSchema),
  })
  .strict();

export const PlanMyPeakTrainingPlanWeekDataSchema = z.object({
  weekNumber: z.number().int().positive(),
  phase: TrainingPhaseSchema,
  weeklyTss: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
  workouts: PlanMyPeakWeekWorkoutsDataSchema,
});

export const PlanMyPeakCreateTrainingPlanRequestSchema = z.object({
  metadata: PlanMyPeakTrainingPlanMetadataSchema,
  weeks: z.array(PlanMyPeakTrainingPlanWeekDataSchema).min(1),
  publish: z.boolean().optional(),
});

export const PlanMyPeakSaveTrainingPlanResponseSchema = z.object({
  success: z.boolean(),
  planId: z.string().uuid(),
  savedAt: z.string().datetime(),
});

export const PlanMyPeakTrainingPlanNoteSchema = z.object({
  id: z.string().uuid(),
  training_plan_id: z.string().uuid(),
  week_number: z.number().int().positive(),
  day_of_week: z.number().int().min(0).max(6),
  title: z.string().max(200),
  description: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PlanMyPeakCreatePlanNoteRequestSchema = z.object({
  week_number: z.number().int().positive(),
  day_of_week: z.number().int().min(0).max(6),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
});

export const PlanMyPeakCreatePlanNoteResponseSchema = z.object({
  note: PlanMyPeakTrainingPlanNoteSchema,
});

export const PlanMyPeakListPlanNotesResponseSchema = z.object({
  notes: z.array(PlanMyPeakTrainingPlanNoteSchema),
  total: z.number().int().nonnegative(),
});

// Export inferred types
export type PlanMyPeakTarget = z.infer<typeof PlanMyPeakTargetSchema>;
export type PlanMyPeakLength = z.infer<typeof PlanMyPeakLengthSchema>;
export type PlanMyPeakStep = z.infer<typeof PlanMyPeakStepSchema>;
export type PlanMyPeakStructure = z.infer<typeof PlanMyPeakStructureSchema>;
export type PlanMyPeakWorkout = z.infer<typeof PlanMyPeakWorkoutSchema>;
export type PlanMyPeakExportConfig = z.infer<
  typeof PlanMyPeakExportConfigSchema
>;
export type PlanMyPeakWeekday = z.infer<typeof PlanMyPeakWeekdaySchema>;
export type PlanMyPeakTrainingPlanMetadata = z.infer<
  typeof PlanMyPeakTrainingPlanMetadataSchema
>;
export type PlanMyPeakWorkoutPlacementSummary = z.infer<
  typeof PlanMyPeakWorkoutPlacementSummarySchema
>;
export type PlanMyPeakWorkoutPlacement = z.infer<
  typeof PlanMyPeakWorkoutPlacementSchema
>;
export type PlanMyPeakWeekWorkoutsData = z.infer<
  typeof PlanMyPeakWeekWorkoutsDataSchema
>;
export type PlanMyPeakTrainingPlanWeekData = z.infer<
  typeof PlanMyPeakTrainingPlanWeekDataSchema
>;
export type PlanMyPeakCreateTrainingPlanRequest = z.infer<
  typeof PlanMyPeakCreateTrainingPlanRequestSchema
>;
export type PlanMyPeakSaveTrainingPlanResponse = z.infer<
  typeof PlanMyPeakSaveTrainingPlanResponseSchema
>;
export type PlanMyPeakTrainingPlanNote = z.infer<
  typeof PlanMyPeakTrainingPlanNoteSchema
>;
export type PlanMyPeakCreatePlanNoteRequest = z.infer<
  typeof PlanMyPeakCreatePlanNoteRequestSchema
>;
export type PlanMyPeakCreatePlanNoteResponse = z.infer<
  typeof PlanMyPeakCreatePlanNoteResponseSchema
>;
export type PlanMyPeakListPlanNotesResponse = z.infer<
  typeof PlanMyPeakListPlanNotesResponseSchema
>;
export type SportType = z.infer<typeof SportTypeSchema>;
export type TrainingPhase = z.infer<typeof TrainingPhaseSchema>;
export type WorkoutType = z.infer<typeof WorkoutTypeSchema>;
export type IntensityLevel = z.infer<typeof IntensityLevelSchema>;

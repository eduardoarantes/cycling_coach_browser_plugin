/**
 * Zod validation schemas for PlanMyPeak workout format
 */
import { z } from 'zod';

/**
 * PlanMyPeak workout intensity target schema
 */
export const PlanMyPeakTargetSchema = z.object({
  type: z.literal('power'),
  minValue: z.number(),
  maxValue: z.number(),
  unit: z.literal('percentOfFtp'),
});

/**
 * Duration unit schema
 */
export const PlanMyPeakLengthSchema = z.object({
  unit: z.enum(['second', 'repetition']),
  value: z.number(),
});

/**
 * Individual workout step schema
 */
export const PlanMyPeakStepSchema = z.object({
  name: z.string(),
  intensityClass: z.enum(['active', 'warmUp', 'rest', 'coolDown']),
  length: PlanMyPeakLengthSchema,
  openDuration: z.union([z.null(), z.boolean()]),
  targets: z.array(PlanMyPeakTargetSchema),
});

/**
 * Step or repetition block schema (recursive)
 */
export const PlanMyPeakStructureBlockSchema: z.ZodType<{
  type: 'step' | 'repetition';
  length: { unit: 'second' | 'repetition'; value: number };
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
  primaryIntensityMetric: z.literal('percentOfFtp'),
  primaryLengthMetric: z.literal('duration'),
  structure: z.array(PlanMyPeakStructureBlockSchema),
});

/**
 * Training phase schema
 */
export const TrainingPhaseSchema = z.enum([
  'Base',
  'Build',
  'Peak',
  'Recovery',
]);

/**
 * Workout type schema
 */
export const WorkoutTypeSchema = z.enum([
  'vo2max',
  'threshold',
  'tempo',
  'endurance',
  'recovery',
  'anaerobic',
]);

/**
 * Intensity level schema
 */
export const IntensityLevelSchema = z.enum([
  'very_easy',
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
});

/**
 * Export configuration schema
 */
export const PlanMyPeakExportConfigSchema = z.object({
  fileName: z.string().optional(),
  includeMetadata: z.boolean().optional(),
  defaultWorkoutType: WorkoutTypeSchema.optional(),
  defaultIntensity: IntensityLevelSchema.optional(),
  defaultSuitablePhases: z.array(TrainingPhaseSchema).optional(),
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
export type TrainingPhase = z.infer<typeof TrainingPhaseSchema>;
export type WorkoutType = z.infer<typeof WorkoutTypeSchema>;
export type IntensityLevel = z.infer<typeof IntensityLevelSchema>;

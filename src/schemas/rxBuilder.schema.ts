/**
 * Zod schemas for TrainingPeaks RxBuilder (Structured Strength) workouts
 *
 * RxBuilder is TrainingPeaks' new structured strength workout builder
 * that uses exercise sequences instead of traditional interval structures
 */

import { z } from 'zod';

/**
 * Sequence summary for a single exercise/block in the workout
 */
export const RxSequenceSummarySchema = z.object({
  sequenceOrder: z.string(), // e.g., "A", "B1", "C2"
  title: z.string(), // Exercise name
  compliancePercent: z.number(), // 0-100, completion percentage
});

export type RxSequenceSummary = z.infer<typeof RxSequenceSummarySchema>;

/**
 * RxBuilder structured strength workout
 */
export const RxBuilderWorkoutSchema = z.object({
  id: z.string(), // String ID (different from classic workout numeric IDs)
  calendarId: z.number(), // Athlete ID
  title: z.string(),
  instructions: z.string().nullable(),
  prescribedDate: z.string(), // ISO date string (YYYY-MM-DD)
  prescribedStartTime: z.string().nullable(),
  startDateTime: z.string().nullable(),
  completedDateTime: z.string().nullable(),
  orderOnDay: z.number().nullable(),
  workoutType: z.literal('StructuredStrength'), // Only valid RxBuilder workout type
  workoutSubTypeId: z.number().nullable(),
  isLocked: z.boolean(),
  isHidden: z.boolean(),
  totalBlocks: z.number(), // Total exercise blocks
  completedBlocks: z.number(),
  totalPrescriptions: z.number(), // Total exercises prescribed
  completedPrescriptions: z.number(),
  totalSets: z.number(), // Total sets across all exercises
  completedSets: z.number(),
  compliancePercent: z.number(), // Overall completion percentage
  sequenceSummary: z.array(RxSequenceSummarySchema), // List of exercises
  rpe: z.number().nullable(), // Rate of Perceived Exertion
  feel: z.number().nullable(),
  prescribedDurationInSeconds: z.number().nullable(),
  executedDurationInSeconds: z.number().nullable(),
  lastUpdatedAt: z.string(), // ISO datetime string
});

export type RxBuilderWorkout = z.infer<typeof RxBuilderWorkoutSchema>;

/**
 * API response schema for RxBuilder workouts
 * Returns an array of RxBuilder workouts
 */
export const RxBuilderWorkoutsApiResponseSchema = z.array(
  RxBuilderWorkoutSchema
);

export type RxBuilderWorkoutsApiResponse = z.infer<
  typeof RxBuilderWorkoutsApiResponseSchema
>;

/**
 * Zod schemas for Intervals.icu text-based DSLs (normalized ASTs)
 *
 * This file intentionally models provider-specific DSLs used in the Intervals
 * ecosystem rather than generic workout schemas:
 * - Intervals.icu workout builder text syntax (forum "Workout Builder")
 * - Intertools multi-week training plan guide syntax
 *
 * These schemas are for parsed/normalized structures (AST-like objects), not a
 * direct parser for the raw text lines. They are designed to preserve the
 * expressiveness needed for future Intervals-focused exports, including cadence
 * / RPM, absolute pace targets, ramps, timed prompts, and repeated sections.
 */

import { z } from 'zod';

const PositiveFiniteNumberSchema = z.number().finite().positive();
const NonNegativeFiniteNumberSchema = z.number().finite().nonnegative();

const NumericRangeSchema = z
  .object({
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .refine((value) => value.max >= value.min, {
    message: 'Range max must be greater than or equal to min',
  });

const PositiveNumericRangeSchema = NumericRangeSchema.refine(
  (value) => value.min > 0,
  {
    message: 'Range values must be positive',
  }
);

const PositiveNumericPairSchema = z.object({
  min: PositiveFiniteNumberSchema,
  max: PositiveFiniteNumberSchema,
});

/**
 * Canonical units for a normalized Intervals workout step duration.
 * Raw syntax aliases (e.g. "mtr", "yards", "mi") should be normalized before
 * validation.
 */
export const IntervalsWorkoutStepDurationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('time'),
    value: PositiveFiniteNumberSchema,
    unit: z.enum(['seconds', 'minutes', 'hours']),
  }),
  z.object({
    kind: z.literal('distance'),
    value: PositiveFiniteNumberSchema,
    unit: z.enum(['meters', 'kilometers', 'yards', 'miles']),
  }),
  z.object({
    kind: z.literal('press_lap'),
  }),
]);

/**
 * Optional timed prompts inside a step, based on the Intervals workout-builder
 * syntax (e.g. "33^ 2nd prompt at 33s<!>").
 */
export const IntervalsWorkoutTimedPromptSchema = z.object({
  offsetSeconds: NonNegativeFiniteNumberSchema,
  message: z.string().min(1),
  priority: z.enum(['normal', 'alert']).default('normal'),
});

/**
 * Absolute pace target (e.g. 7:15-7:00 Pace /km)
 */
export const IntervalsAbsolutePaceTargetSchema = z.object({
  kind: z.literal('pace_absolute'),
  // Absolute pace ranges are intentionally not ordered because "faster" pace
  // means a smaller time value (e.g. 7:15-7:00 /mi).
  value: z.union([PositiveFiniteNumberSchema, PositiveNumericPairSchema]),
  /**
   * Canonical pace denominator unit.
   * Supports common Intervals examples for run/row/swim pacing.
   */
  denominatorUnit: z.enum(['km', 'mi', '100m', '100y', '250m', '400m', '500m']),
});

/**
 * Threshold-relative pace target (e.g. 90% Pace, 75-85% Pace)
 */
export const IntervalsThresholdPaceTargetSchema = z.object({
  kind: z.literal('pace_percent_threshold'),
  value: z.union([PositiveFiniteNumberSchema, PositiveNumericRangeSchema]),
});

/**
 * Power targets: either percent-of-FTP or absolute watts.
 */
export const IntervalsPowerPercentTargetSchema = z.object({
  kind: z.literal('power_percent_ftp'),
  value: z.union([PositiveFiniteNumberSchema, PositiveNumericRangeSchema]),
});

export const IntervalsPowerWattsTargetSchema = z.object({
  kind: z.literal('power_watts'),
  value: z.union([PositiveFiniteNumberSchema, PositiveNumericRangeSchema]),
});

/**
 * HR targets commonly used in Intervals syntax (% HR and % LTHR).
 */
export const IntervalsHeartRatePercentTargetSchema = z.object({
  kind: z.enum(['hr_percent_max', 'hr_percent_lthr']),
  value: z.union([PositiveFiniteNumberSchema, PositiveNumericRangeSchema]),
});

/**
 * Zone target. Intervals syntax can qualify the metric (e.g. Z2, Z2 HR, Z2 Pace).
 */
export const IntervalsZoneTargetSchema = z.object({
  kind: z.literal('zone'),
  zone: z.string().regex(/^Z\d+$/i, 'Zone must look like Z1, Z2, ...'),
  metric: z.enum(['power', 'heart_rate', 'pace']).default('power'),
});

/**
 * Cadence target (RPM). This is the key addition requested for richer Intervals
 * workout export support.
 */
export const IntervalsCadenceRpmTargetSchema = z.object({
  kind: z.literal('cadence_rpm'),
  value: z.union([
    z.number().int().positive(),
    z
      .object({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .refine((value) => value.max >= value.min, {
        message: 'Cadence RPM range max must be greater than or equal to min',
      }),
  ]),
});

/**
 * Additional free-text annotations that should survive round-trip rendering.
 * Useful for unsupported syntax fragments while parser support is incrementally
 * expanded.
 */
export const IntervalsFreeTextTargetSchema = z.object({
  kind: z.literal('free_text'),
  text: z.string().min(1),
});

export const IntervalsWorkoutStepTargetSchema = z.discriminatedUnion('kind', [
  IntervalsPowerPercentTargetSchema,
  IntervalsPowerWattsTargetSchema,
  IntervalsHeartRatePercentTargetSchema,
  IntervalsThresholdPaceTargetSchema,
  IntervalsAbsolutePaceTargetSchema,
  IntervalsZoneTargetSchema,
  IntervalsCadenceRpmTargetSchema,
  IntervalsFreeTextTargetSchema,
]);

/**
 * A single executable step in the Intervals workout-builder DSL.
 */
export const IntervalsWorkoutStepSchema = z.object({
  kind: z.literal('step'),
  /**
   * Optional step label/text preceding duration and targets
   * e.g. "- Hard 3m 75-85%"
   */
  label: z.string().min(1).optional(),
  duration: IntervalsWorkoutStepDurationSchema,
  /**
   * "ramp" in Intervals syntax affects how the target evolves during the step.
   */
  targetMode: z.enum(['steady', 'ramp']).default('steady'),
  /**
   * Multiple targets are supported (e.g. power + cadence RPM).
   */
  targets: z.array(IntervalsWorkoutStepTargetSchema).default([]),
  /**
   * Optional tags rendered like "intensity=warmup/rest/cooldown".
   */
  intensityTag: z.enum(['warmup', 'active', 'rest', 'cooldown']).optional(),
  prompts: z.array(IntervalsWorkoutTimedPromptSchema).default([]),
  /**
   * Raw line for lossless debugging / round-trip tracing while parser support
   * is evolving.
   */
  rawLine: z.string().min(1).optional(),
});

/**
 * Non-step text line (heading / comment) that should be preserved in the
 * Intervals description.
 */
export const IntervalsWorkoutTextLineSchema = z.object({
  kind: z.literal('text'),
  text: z.string().min(1),
});

export const IntervalsWorkoutSectionItemSchema = z.union([
  IntervalsWorkoutStepSchema,
  IntervalsWorkoutTextLineSchema,
]);

/**
 * A logical section in the Intervals workout description. A section may be:
 * - a standalone sequence of steps
 * - a repeated block ("3x")
 * - a headed group (e.g. "Cooldown")
 */
export const IntervalsWorkoutSectionSchema = z.object({
  kind: z.literal('section'),
  heading: z.string().min(1).optional(),
  repeatCount: z.number().int().positive().optional(),
  items: z.array(IntervalsWorkoutSectionItemSchema).min(1),
});

/**
 * Top-level normalized workout-builder document.
 */
export const IntervalsWorkoutBuilderDocumentSchema = z.object({
  source: z
    .literal('intervals_workout_builder_text')
    .default('intervals_workout_builder_text'),
  sportHint: z
    .enum([
      'Ride',
      'Run',
      'Swim',
      'WeightTraining',
      'Walk',
      'Rowing',
      'NordicSki',
      'Other',
    ])
    .optional(),
  sections: z.array(IntervalsWorkoutSectionSchema).min(1),
});

/**
 * Intertools "criterion" slots used in the multi-week plan guide syntax
 * (forum example: zone:load:time:intensity, e.g. z5:120:90:95).
 *
 * We model the normalized form instead of raw text tokens so future parsers can
 * support richer operators without rewriting downstream validation.
 */
export const IntertoolsCriterionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('any') }),
  z.object({ kind: z.literal('min') }),
  z.object({ kind: z.literal('max') }),
  z.object({
    kind: z.literal('exact'),
    value: z.number().finite(),
  }),
  z
    .object({
      kind: z.literal('range'),
      min: z.number().finite(),
      max: z.number().finite(),
    })
    .refine((value) => value.max >= value.min, {
      message: 'Criterion range max must be greater than or equal to min',
    }),
  z.object({
    kind: z.literal('gte'),
    value: z.number().finite(),
  }),
  z.object({
    kind: z.literal('lte'),
    value: z.number().finite(),
  }),
]);

export const IntertoolsZoneSchema = z
  .string()
  .regex(/^z\d+$/i, 'Zone must look like z1, z2, ...')
  .transform((value) => value.toLowerCase());

/**
 * A single Intertools plan-guide day specification.
 * "rest" and "rest day" are represented as a dedicated day type.
 */
export const IntertoolsPlanGuideDaySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rest'),
    label: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('workout'),
    zone: IntertoolsZoneSchema,
    load: IntertoolsCriterionSchema,
    /**
     * Planned duration (typically minutes) criterion in Intertools syntax.
     */
    duration: IntertoolsCriterionSchema,
    /**
     * Planned intensity criterion (often percent-ish scalar in examples).
     */
    intensity: IntertoolsCriterionSchema,
    notes: z.string().min(1).optional(),
  }),
]);

/**
 * Intertools weekly plan-guide schema (exactly 7 days).
 */
export const IntertoolsPlanGuideWeekSchema = z.object({
  weekIndex: z.number().int().positive().optional(),
  days: z.array(IntertoolsPlanGuideDaySchema).length(7),
});

/**
 * Full Intertools plan guide document (1+ weeks).
 */
export const IntertoolsPlanGuideDocumentSchema = z.object({
  source: z
    .literal('intertools_multi_week_plan_guide')
    .default('intertools_multi_week_plan_guide'),
  weeks: z.array(IntertoolsPlanGuideWeekSchema).min(1),
});

export type IntervalsWorkoutStepDuration = z.infer<
  typeof IntervalsWorkoutStepDurationSchema
>;
export type IntervalsWorkoutTimedPrompt = z.infer<
  typeof IntervalsWorkoutTimedPromptSchema
>;
export type IntervalsWorkoutStepTarget = z.infer<
  typeof IntervalsWorkoutStepTargetSchema
>;
export type IntervalsWorkoutStep = z.infer<typeof IntervalsWorkoutStepSchema>;
export type IntervalsWorkoutSectionItem = z.infer<
  typeof IntervalsWorkoutSectionItemSchema
>;
export type IntervalsWorkoutSection = z.infer<
  typeof IntervalsWorkoutSectionSchema
>;
export type IntervalsWorkoutBuilderDocument = z.infer<
  typeof IntervalsWorkoutBuilderDocumentSchema
>;
export type IntertoolsCriterion = z.infer<typeof IntertoolsCriterionSchema>;
export type IntertoolsPlanGuideDay = z.infer<
  typeof IntertoolsPlanGuideDaySchema
>;
export type IntertoolsPlanGuideWeek = z.infer<
  typeof IntertoolsPlanGuideWeekSchema
>;
export type IntertoolsPlanGuideDocument = z.infer<
  typeof IntertoolsPlanGuideDocumentSchema
>;

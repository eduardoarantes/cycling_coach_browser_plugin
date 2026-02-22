/**
 * Zod schemas for training plan validation
 *
 * Provides runtime validation for TrainingPeaks training plan API responses
 */

import { z } from 'zod';

/**
 * Schema for plan access control data
 * Contains information about user's access rights to a training plan
 */
export const PlanAccessSchema = z.object({
  planAccessId: z.number(),
  personId: z.number(),
  planId: z.number(),
  accessFromPayment: z.boolean(),
  accessFromShare: z.boolean(),
  grantedFromPersonId: z.number().nullable(),
  planAccessType: z.number(),
});

export type PlanAccess = z.infer<typeof PlanAccessSchema>;

/**
 * Schema for workout structure data
 * Contains detailed workout step information
 */
export const WorkoutStructureSchema = z.object({
  structure: z.array(z.unknown()),
  primaryLengthMetric: z.string(),
  primaryIntensityMetric: z.string(),
  primaryIntensityTargetOrRange: z.string().optional(),
  visualizationDistanceUnit: z.string().optional(),
});

export type WorkoutStructure = z.infer<typeof WorkoutStructureSchema>;

/**
 * Schema for a single training plan object
 * Matches the structure from /trainingplans/v2/plansWithAccess endpoint
 */
export const TrainingPlanSchema = z.object({
  planAccess: PlanAccessSchema,
  planId: z.number(),
  planPersonId: z.number(),
  ownerPersonId: z.number(),
  createdOn: z.string(),
  title: z.string(),
  author: z.string(),
  planEmail: z.string(),
  planLanguage: z.string().nullable(),
  dayCount: z.number(),
  weekCount: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  workoutCount: z.number(),
  eventCount: z.number(),
  description: z.string().nullable(),
  planCategory: z.number(),
  subcategory: z.number().nullable(),
  additionalCriteria: z.array(z.number()).nullable(),
  eventPlan: z.boolean(),
  eventName: z.string().nullable(),
  eventDate: z.string().nullable(),
  forceDate: z.boolean(),
  isDynamic: z.boolean(),
  isPublic: z.boolean(),
  isSearchable: z.boolean(),
  price: z.number().nullable(),
  customUrl: z.number(),
  hasWeeklyGoals: z.boolean(),
  sampleWeekOne: z.number().nullable(),
  sampleWeekTwo: z.number().nullable(),
});

export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

/**
 * Schema for training plans list API response
 * The API returns an array of training plan objects directly
 */
export const TrainingPlansApiResponseSchema = z.array(TrainingPlanSchema);

export type TrainingPlansApiResponse = z.infer<
  typeof TrainingPlansApiResponseSchema
>;

/**
 * Schema for a single plan workout object
 * Matches the structure from /trainingplans/v2/plans/{planId}/workouts endpoint
 */
export const PlanWorkoutSchema = z.object({
  workoutId: z.number(),
  athleteId: z.number(),
  title: z.string(),
  workoutTypeValueId: z.number(),
  code: z.string().nullable(),
  workoutDay: z.string(),
  startTime: z.string().nullable(),
  startTimePlanned: z.string().nullable(),
  isItAnOr: z.boolean(),
  isHidden: z.boolean().nullable(),
  completed: z.boolean().nullable(),
  description: z.string().nullable(),
  userTags: z.string().nullable(),
  coachComments: z.string().nullable(),
  workoutComments: z.string().nullable(),
  newComment: z.string().nullable(),
  hasPrivateWorkoutNoteForCaller: z.boolean(),
  publicSettingValue: z.number(),
  sharedWorkoutInformationKey: z.string().nullable(),
  sharedWorkoutInformationExpireKey: z.string().nullable(),
  distance: z.number().nullable(),
  distancePlanned: z.number().nullable(),
  distanceCustomized: z.number().nullable(),
  distanceUnitsCustomized: z.number().nullable(),
  totalTime: z.number().nullable(),
  totalTimePlanned: z.number().nullable(),
  heartRateMinimum: z.number().nullable(),
  heartRateMaximum: z.number().nullable(),
  heartRateAverage: z.number().nullable(),
  calories: z.number().nullable(),
  caloriesPlanned: z.number().nullable(),
  tssActual: z.number().nullable(),
  tssPlanned: z.number().nullable(),
  tssSource: z.number().nullable(),
  if: z.number().nullable(),
  ifPlanned: z.number().nullable(),
  velocityAverage: z.number().nullable(),
  velocityPlanned: z.number().nullable(),
  velocityMaximum: z.number().nullable(),
  normalizedSpeedActual: z.number().nullable(),
  normalizedPowerActual: z.number().nullable(),
  powerAverage: z.number().nullable(),
  powerMaximum: z.number().nullable(),
  energy: z.number().nullable(),
  energyPlanned: z.number().nullable(),
  elevationGain: z.number().nullable(),
  elevationGainPlanned: z.number().nullable(),
  elevationLoss: z.number().nullable(),
  elevationMinimum: z.number().nullable(),
  elevationAverage: z.number().nullable(),
  elevationMaximum: z.number().nullable(),
  torqueAverage: z.number().nullable(),
  torqueMaximum: z.number().nullable(),
  tempMin: z.number().nullable(),
  tempAvg: z.number().nullable(),
  tempMax: z.number().nullable(),
  cadenceAverage: z.number().nullable(),
  cadenceMaximum: z.number().nullable(),
  lastModifiedDate: z.string(),
  equipmentBikeId: z.number().nullable(),
  equipmentShoeId: z.number().nullable(),
  isLocked: z.boolean().nullable(),
  complianceDurationPercent: z.number().nullable(),
  complianceDistancePercent: z.number().nullable(),
  complianceTssPercent: z.number().nullable(),
  rpe: z.number().nullable(),
  feeling: z.number().nullable(),
  structure: WorkoutStructureSchema.nullable(),
  orderOnDay: z.number().nullable(),
  personalRecordCount: z.number().nullable(),
  syncedTo: z.string().nullable(),
  poolLengthOptionId: z.number().nullable(),
  workoutSubTypeId: z.number().nullable(),
  workoutDeviceSource: z.string().nullable(),
});

export type PlanWorkout = z.infer<typeof PlanWorkoutSchema>;

/**
 * Schema for plan workouts API response
 * The API returns an array of workout objects directly
 */
export const PlanWorkoutsApiResponseSchema = z.array(PlanWorkoutSchema);

export type PlanWorkoutsApiResponse = z.infer<
  typeof PlanWorkoutsApiResponseSchema
>;

/**
 * Schema for a single calendar note object
 * Matches the structure from /trainingplans/v2/plans/{planId}/calendarnotes endpoint
 */
export const CalendarNoteSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  noteDate: z.string(),
  createdDate: z.string(),
  modifiedDate: z.string(),
  planId: z.number(),
  attachments: z.array(z.unknown()),
});

export type CalendarNote = z.infer<typeof CalendarNoteSchema>;

/**
 * Schema for calendar notes API response
 * The API returns an array of note objects directly
 */
export const CalendarNotesApiResponseSchema = z.array(CalendarNoteSchema);

export type CalendarNotesApiResponse = z.infer<
  typeof CalendarNotesApiResponseSchema
>;

/**
 * Schema for a single calendar event object
 * Matches the structure from /trainingplans/v2/plans/{planId}/events endpoint
 */
export const CalendarEventSchema = z.object({
  id: z.number(),
  planId: z.number(),
  eventDate: z.string(),
  name: z.string(),
  eventType: z.string(),
  description: z.string().nullable(),
  comment: z.string().nullable(),
  distance: z.number().nullable(),
  distanceUnits: z.string().nullable(),
  legs: z.array(z.unknown()),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

/**
 * Schema for calendar events API response
 * The API returns an array of event objects directly
 */
export const CalendarEventsApiResponseSchema = z.array(CalendarEventSchema);

export type CalendarEventsApiResponse = z.infer<
  typeof CalendarEventsApiResponseSchema
>;

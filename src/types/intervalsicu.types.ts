/**
 * Type definitions for Intervals.icu API integration
 *
 * Based on Intervals.icu API v1 documentation:
 * https://intervals.icu/api-docs.html
 *
 * Architecture: Library folders and reusable PLAN folders (NOT direct calendar events)
 */

import type { ExportConfig } from '@/export/adapters/base';

export type IntervalsFolderVisibility = 'PRIVATE' | 'PUBLIC';
export type IntervalsWorkoutTarget = 'AUTO' | 'POWER' | 'HR' | 'PACE';
export type IntervalsPlanConflictAction = 'replace' | 'append';

/**
 * Intervals.icu folder payload for library creation
 * POST /api/v1/athlete/{id}/folders
 */
export interface IntervalsFolderPayload {
  /** Folder name (library name from TrainingPeaks) */
  name: string;
  /** Optional description */
  description?: string;
}

/**
 * Intervals.icu PLAN folder payload for reusable training plans
 * POST /api/v1/athlete/{id}/folders
 */
export interface IntervalsPlanFolderPayload {
  /** Must be PLAN for reusable plan folders */
  type: 'PLAN';
  /** Plan name (mapped from TrainingPeaks training plan title) */
  name: string;
  /** Required local plan anchor date at midnight (YYYY-MM-DDT00:00:00) */
  start_date_local: string;
  /** Optional plan description */
  description?: string;
  /** Optional visibility */
  visibility?: IntervalsFolderVisibility;
  /** Optional metadata fields */
  duration_weeks?: number;
  num_workouts?: number;
  activity_types?: string[];
  workout_targets?: IntervalsWorkoutTarget[];
}

/**
 * Intervals.icu folder response
 */
export interface IntervalsFolderResponse {
  /** Intervals.icu folder ID */
  id: number;
  /** Folder name */
  name: string;
  /** Athlete ID */
  athlete_id: string | number;
  /** Optional folder type (PLAN/FOLDER), commonly present in list endpoints */
  type?: string | null;
  /** Optional plan anchor date on PLAN folders (list endpoints) */
  start_date_local?: string | null;
}

/**
 * Intervals.icu athlete info response
 * GET /api/v1/athlete/{id}
 */
export interface IntervalsAthleteResponse {
  /** Athlete ID */
  id: string | number;
  /** Athlete name */
  name?: string;
  /** Athlete email */
  email?: string;
}

/**
 * Intervals.icu workout template payload (no dates - library-based)
 * POST /api/v1/athlete/{id}/workouts
 */
export interface IntervalsWorkoutPayload {
  /** Workout category (WORKOUT for planned workouts) */
  category: 'WORKOUT';
  /** Activity type (Ride, Run, Swim, WeightTraining, etc.) */
  type: string;
  /** Workout name/title */
  name: string;
  /** Workout description (supports markdown) */
  description: string;
  /** Optional folder ID to organize workout */
  folder_id?: number;
  /** Optional structured workout data */
  workout_doc?: string;
  /** Optional moving time in seconds */
  moving_time?: number;
  /** Optional training load (TSS) */
  icu_training_load?: number;
}

/**
 * Intervals.icu workout payload for a workout stored inside a PLAN folder
 * POST /api/v1/athlete/{id}/workouts
 */
export interface IntervalsPlanWorkoutPayload extends IntervalsWorkoutPayload {
  /** PLAN folder id */
  folder_id: number;
  /** Zero-based day offset from plan start date (day 0 = plan start day) */
  day: number;
  /** Weekly/flexible placement flag (false for fixed-day TP mapping) */
  for_week: boolean;
  /** Unknown semantics for now; omitted unless verified */
  days?: number | null;
}

/**
 * Intervals.icu NOTE payload stored inside a folder/plan via /workouts
 */
export interface IntervalsPlanNotePayload {
  /** Note title */
  name: string;
  /** Note body text */
  description: string;
  /** NOTE item type */
  type: 'NOTE';
  /** Intervals note color (observed string enum in UI/network, keep open for now) */
  color: string;
  /** Zero-based day offset from plan start date (day 0 = plan start day) */
  day: number;
  /** PLAN folder id */
  folder_id: number;
}

/**
 * Intervals.icu event marker payload stored inside a PLAN via /workouts
 * (race annotation style item)
 */
export interface IntervalsPlanEventPayload {
  /** Event title */
  name: string;
  /** Event details / notes */
  description: string;
  /** Activity type (Ride, Run, Swim, etc.) */
  type: string;
  /** Intervals race annotation category */
  category: 'RACE_A';
  /** Zero-based day offset from plan start date (day 0 = plan start day) */
  day: number;
  /** PLAN folder id */
  folder_id: number;
}

/**
 * Intervals.icu workout template response
 */
export interface IntervalsWorkoutResponse {
  /** Intervals.icu workout ID */
  id: number;
  /** Workout name */
  name: string;
  /** Activity type */
  type: string;
  /** Workout category */
  category?: string;
  /** Folder ID (null if not in folder) */
  folder_id?: number | null;
  /** Athlete ID */
  athlete_id?: string | number;
}

/**
 * Result of creating an Intervals reusable plan folder for a TP training plan.
 */
export interface IntervalsPlanFolderCreationResult {
  folder: IntervalsFolderResponse;
  start_date_local: string;
}

/**
 * Result of exporting a TP training plan to an Intervals reusable PLAN folder.
 */
export interface IntervalsTrainingPlanExportResult {
  folder: IntervalsFolderResponse;
  workouts: IntervalsWorkoutResponse[];
  start_date_local: string;
}

/**
 * Export configuration for Intervals.icu adapter
 */
export interface IntervalsIcuExportConfig extends ExportConfig {
  /** Intervals.icu API key (required for authentication) */
  apiKey?: string;
  /** Athlete ID (defaults to 0 for current user) */
  athleteId?: string;
  /** Library name for folder creation */
  libraryName?: string;
  /** Optional description for the folder */
  description?: string;
  /** Whether to create a new folder */
  createFolder?: boolean;
  /** Existing library folder handling for library export */
  existingLibraryAction?: IntervalsPlanConflictAction;
  /** Existing plan handling for training plan export */
  existingPlanAction?: IntervalsPlanConflictAction;
}

/**
 * Storage schema for Intervals.icu API key
 */
export interface IntervalsApiKeyStorage {
  /** Intervals.icu API key */
  intervals_api_key?: string;
}

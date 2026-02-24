/**
 * Type definitions for Intervals.icu API integration
 *
 * Based on Intervals.icu API v1 documentation:
 * https://intervals.icu/api-docs.html
 *
 * Architecture: Library/folder-based export (NOT calendar events)
 */

import type { ExportConfig } from '@/export/adapters/base';

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
 * Intervals.icu folder response
 */
export interface IntervalsFolderResponse {
  /** Intervals.icu folder ID */
  id: number;
  /** Folder name */
  name: string;
  /** Athlete ID */
  athlete_id: string | number;
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
}

/**
 * Storage schema for Intervals.icu API key
 */
export interface IntervalsApiKeyStorage {
  /** Intervals.icu API key */
  intervals_api_key?: string;
}

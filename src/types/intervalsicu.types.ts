/**
 * Type definitions for Intervals.icu API integration
 *
 * Based on Intervals.icu API v1 documentation:
 * https://intervals.icu/api-docs.html
 */

import type { ExportConfig } from '@/export/adapters/base';

/**
 * Intervals.icu event payload for bulk upload
 * POST /api/v1/athlete/{id}/events/bulk
 */
export interface IntervalsEventPayload {
  /** Event category (WORKOUT for planned workouts) */
  category: 'WORKOUT';
  /** ISO 8601 date-time string (local timezone) */
  start_date_local: string;
  /** Activity type (Ride, Run, Swim, WeightTraining, etc.) */
  type: string;
  /** Workout name/title */
  name: string;
  /** Workout description (supports markdown) */
  description: string;
  /** Duration in seconds */
  moving_time?: number;
  /** Training load (TSS equivalent) */
  icu_training_load?: number;
  /** External ID for deduplication (e.g., tp_123456) */
  external_id: string;
}

/**
 * Intervals.icu event response from bulk upload
 */
export interface IntervalsEventResponse {
  /** Intervals.icu event ID */
  id: number;
  /** ISO 8601 date string (local timezone) */
  start_date_local: string;
  /** Activity type */
  type: string;
  /** Event category */
  category: string;
  /** Workout name */
  name?: string;
  /** Training load (TSS) */
  icu_training_load?: number;
}

/**
 * Export configuration for Intervals.icu adapter
 */
export interface IntervalsIcuExportConfig extends ExportConfig {
  /** Intervals.icu API key (required for authentication) */
  apiKey?: string;
  /** Athlete ID (defaults to 0 for current user) */
  athleteId?: string;
  /** Start date for first workout (YYYY-MM-DD format) */
  startDate?: string;
}

/**
 * Storage schema for Intervals.icu API key
 */
export interface IntervalsApiKeyStorage {
  /** Intervals.icu API key */
  intervals_api_key?: string;
}

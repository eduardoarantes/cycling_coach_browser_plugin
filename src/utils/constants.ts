/**
 * Application constants
 *
 * Centralized configuration values
 */

/**
 * TrainingPeaks API base URLs
 */
export const API_BASE_URL = 'https://tpapi.trainingpeaks.com';

/**
 * Build mode flags exposed by Vite.
 * Use these instead of guessing based on the current hostname.
 */
export const IS_DEVELOPMENT = import.meta.env.DEV;

/**
 * PlanMyPeak app URL.
 * Development uses the local app, production uses the deployed site.
 */
export const PLANMYPEAK_APP_URL = IS_DEVELOPMENT
  ? 'http://localhost:3006'
  : 'https://planmypeak.com';

/**
 * Short PlanMyPeak host label for UI copy.
 */
export const PLANMYPEAK_HOST_LABEL = IS_DEVELOPMENT
  ? 'localhost:3006'
  : 'planmypeak.com';

/**
 * PlanMyPeak auth validation base URL.
 * Development hits the local Supabase instance directly.
 * Production validates via the deployed app host.
 */
export const PLANMYPEAK_AUTH_BASE_URL = IS_DEVELOPMENT
  ? 'http://127.0.0.1:54361'
  : PLANMYPEAK_APP_URL;

/**
 * PlanMyPeak API base URL.
 */
export const PLANMYPEAK_API_BASE_URL = `${PLANMYPEAK_APP_URL}/api`;

/**
 * Backward-compatible aliases used across the codebase.
 */
export const MYPEAK_APP_URL = PLANMYPEAK_APP_URL;
export const MYPEAK_SUPABASE_URL = PLANMYPEAK_AUTH_BASE_URL;

/**
 * TrainingPeaks RxBuilder (structured strength) API base URL
 * Uses a different domain from the classic API
 */
export const RX_API_BASE_URL = 'https://api.peakswaresb.com';

/**
 * Intervals.icu API base URL
 */
export const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

/**
 * Token expiration threshold (24 hours in milliseconds)
 */
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Extension display name
 */
export const EXTENSION_NAME = 'PlanMyPeak Importer';

/**
 * Extension version (should match manifest.json)
 */
export const EXTENSION_VERSION = '1.0.0';

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TOKEN_TIMESTAMP: 'token_timestamp',
  MYPEAK_AUTH_TOKEN: 'mypeak_auth_token',
  MYPEAK_TOKEN_TIMESTAMP: 'mypeak_token_timestamp',
  MYPEAK_SUPABASE_API_KEY: 'mypeak_supabase_api_key',
  INTERVALS_API_KEY: 'intervals_api_key',
  CONNECTION_ENABLE_PLANMYPEAK: 'connection_enable_planmypeak',
  CONNECTION_ENABLE_INTERVALS: 'connection_enable_intervals',
} as const;

/**
 * Date range constants for training plan API endpoints
 * These dates represent the widest possible range supported by the API
 */
export const PLAN_DATE_RANGE = {
  START_DATE: '2010-12-15',
  END_DATE: '2038-09-13',
} as const;

/**
 * React Query cache durations (in milliseconds)
 * Controls how long data remains fresh before refetching
 */
export const CACHE_DURATIONS = {
  USER: 5 * 60 * 1000, // 5 minutes - user profile rarely changes
  LIBRARIES: 10 * 60 * 1000, // 10 minutes - library list is relatively static
  LIBRARY_ITEMS: 3 * 60 * 1000, // 3 minutes - library items may be edited
  TRAINING_PLANS: 10 * 60 * 1000, // 10 minutes - plan list rarely changes
  PLAN_WORKOUTS: 3 * 60 * 1000, // 3 minutes - workouts may be modified
  PLAN_NOTES: 3 * 60 * 1000, // 3 minutes - notes may be edited
  PLAN_EVENTS: 3 * 60 * 1000, // 3 minutes - events may change
  RX_BUILDER_WORKOUTS: 3 * 60 * 1000, // 3 minutes - strength workouts may be modified
} as const;

/**
 * Create headers for TrainingPeaks API requests
 *
 * Headers match exactly what TrainingPeaks web app sends for authentication.
 * Some headers (sec-*) are automatically added by the browser.
 *
 * @param token - Bearer token for authentication
 * @returns Headers object for fetch requests
 */
export function createApiHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    origin: 'https://app.trainingpeaks.com',
    referer: 'https://app.trainingpeaks.com/',
    // Note: sec-fetch-* headers are automatically added by Chrome
    // Note: user-agent is a forbidden header and cannot be set by extensions
  };
}

/**
 * Application constants
 *
 * Centralized configuration values
 */

/**
 * TrainingPeaks environment (production vs sandbox).
 * Switchable at runtime via the Settings panel; stored in chrome.storage.
 */
export type TrainingPeaksEnvironment = 'production' | 'sandbox';

export interface TrainingPeaksEnvironmentConfig {
  apiBaseUrl: string;
  appUrl: string;
}

export const TRAININGPEAKS_ENVIRONMENTS: Record<
  TrainingPeaksEnvironment,
  TrainingPeaksEnvironmentConfig
> = {
  production: {
    apiBaseUrl: 'https://tpapi.trainingpeaks.com',
    appUrl: 'https://app.trainingpeaks.com',
  },
  sandbox: {
    apiBaseUrl: 'https://tpapi.sandbox.trainingpeaks.com',
    appUrl: 'https://app.sandbox.trainingpeaks.com',
  },
};

export const DEFAULT_TRAININGPEAKS_ENVIRONMENT: TrainingPeaksEnvironment =
  'production';

export function isTrainingPeaksEnvironment(
  value: string | undefined
): value is TrainingPeaksEnvironment {
  return value === 'production' || value === 'sandbox';
}

/**
 * TrainingPeaks API base URL (production default).
 * Prefer the environment-aware helpers in trainingPeaksConfigService for
 * runtime calls; this constant remains the production fallback.
 */
export const API_BASE_URL = TRAININGPEAKS_ENVIRONMENTS.production.apiBaseUrl;

/**
 * Build mode flags exposed by Vite.
 * Use these instead of guessing based on the current hostname.
 */
export const IS_DEVELOPMENT = import.meta.env.DEV;

/**
 * Explicit PlanMyPeak host target.
 * This can override the default behavior so local-target bundles can be built.
 */
export type PlanMyPeakTarget = 'local' | 'production';

function isPlanMyPeakTarget(
  value: string | undefined
): value is PlanMyPeakTarget {
  return value === 'local' || value === 'production';
}

export function resolvePlanMyPeakTarget(
  configuredTarget: string | undefined,
  isDevelopment: boolean
): PlanMyPeakTarget {
  if (isPlanMyPeakTarget(configuredTarget)) {
    return configuredTarget;
  }

  return isDevelopment ? 'local' : 'production';
}

/**
 * Active PlanMyPeak host target.
 * Defaults to local in Vite dev mode and production for built bundles.
 */
export const PLANMYPEAK_TARGET = resolvePlanMyPeakTarget(
  import.meta.env.VITE_PLANMYPEAK_TARGET,
  IS_DEVELOPMENT
);

/**
 * Whether the current PlanMyPeak target is a local development host.
 */
export const IS_LOCAL_PLANMYPEAK_TARGET = PLANMYPEAK_TARGET === 'local';

/**
 * Default ports for local PlanMyPeak development.
 * These can be overridden via chrome.storage in local builds.
 * Supported port sets: 3002/54341 (default) and 3006/54361
 * Note: the app runs over https locally; Supabase runs over http.
 */
export const DEFAULT_PLANMYPEAK_APP_PORT = 3002;
export const DEFAULT_PLANMYPEAK_SUPABASE_PORT = 54341;
export const SUPPORTED_PLANMYPEAK_APP_PORTS = [3002, 3004, 3006] as const;
export const SUPPORTED_PLANMYPEAK_SUPABASE_PORTS = [54341, 54361] as const;

export function isSupportedPlanMyPeakAppPort(port: number): boolean {
  return (SUPPORTED_PLANMYPEAK_APP_PORTS as readonly number[]).includes(port);
}

export function isSupportedPlanMyPeakSupabasePort(port: number): boolean {
  return (SUPPORTED_PLANMYPEAK_SUPABASE_PORTS as readonly number[]).includes(
    port
  );
}

/**
 * PlanMyPeak app URL (uses default port, actual port may be configured in local builds).
 * Local uses the local app, production uses the deployed site.
 */
export const PLANMYPEAK_APP_URL = IS_LOCAL_PLANMYPEAK_TARGET
  ? `https://localhost:${DEFAULT_PLANMYPEAK_APP_PORT}`
  : 'https://portal.planmypeak.com';

/**
 * Short PlanMyPeak host label for UI copy (uses default port).
 */
export const PLANMYPEAK_HOST_LABEL = IS_LOCAL_PLANMYPEAK_TARGET
  ? `localhost:${DEFAULT_PLANMYPEAK_APP_PORT}`
  : 'portal.planmypeak.com';

/**
 * PlanMyPeak auth validation base URL (uses default port, actual port may be configured in local builds).
 * Development hits the local Supabase instance directly.
 * Production validates via the Supabase cloud instance the rewritten portal authenticates against.
 */
export const PLANMYPEAK_AUTH_BASE_URL = IS_LOCAL_PLANMYPEAK_TARGET
  ? `http://localhost:${DEFAULT_PLANMYPEAK_SUPABASE_PORT}`
  : 'https://nwvtltfibnkdogdeeluh.supabase.co';

/**
 * PlanMyPeak Supabase anon (publishable) key, used as the `apikey` header when
 * validating a captured user token against Supabase `/auth/v1/user`.
 *
 * The rewritten portal restores its session from localStorage and routes data
 * through its own `/api/backend`, so the anon key is (almost) never emitted on
 * intercepted traffic. This is the public, static publishable key baked into
 * the production portal browser build, so embedding it here is equivalent to
 * what the web app already ships. Local builds fall back to the anon key
 * captured from intercepted local Supabase traffic.
 */
export const PLANMYPEAK_SUPABASE_ANON_KEY = IS_LOCAL_PLANMYPEAK_TARGET
  ? ''
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dnRsdGZpYm5rZG9nZGVlbHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTE3ODgsImV4cCI6MjA5NzY4Nzc4OH0.WqJxwP_OTwbFjo_n1yJWENpy3Xq5xOVzqQ9YcACRr54';

/**
 * PlanMyPeak API base URL.
 */
export const PLANMYPEAK_API_BASE_URL = `${PLANMYPEAK_APP_URL}/api`;

/**
 * Default local port for the PlanMyPeak athlete-tags ingest service.
 * This runs as a standalone service, separate from the main app.
 */
export const DEFAULT_PLANMYPEAK_ATHLETE_TAGS_PORT = 4002;

/**
 * Base URL for the PlanMyPeak athlete-tags ingest service.
 * Local development runs it as a standalone service on its own port; production
 * serves it from the portal host. Note: there is no `/api` prefix on this host.
 */
export const PLANMYPEAK_ATHLETE_TAGS_BASE_URL = IS_LOCAL_PLANMYPEAK_TARGET
  ? `https://localhost:${DEFAULT_PLANMYPEAK_ATHLETE_TAGS_PORT}`
  : 'https://portal.planmypeak.com';

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
 * Storage keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TOKEN_TIMESTAMP: 'token_timestamp',
  TRAININGPEAKS_API_LOGS: 'trainingpeaks_api_logs',
  MYPEAK_AUTH_TOKEN: 'mypeak_auth_token',
  MYPEAK_TOKEN_TIMESTAMP: 'mypeak_token_timestamp',
  MYPEAK_SUPABASE_API_KEY: 'mypeak_supabase_api_key',
  INTERVALS_API_KEY: 'intervals_api_key',
  CONNECTION_ENABLE_PLANMYPEAK: 'connection_enable_planmypeak',
  CONNECTION_ENABLE_INTERVALS: 'connection_enable_intervals',
  PLANMYPEAK_APP_PORT: 'planmypeak_app_port',
  PLANMYPEAK_SUPABASE_PORT: 'planmypeak_supabase_port',
  TRAININGPEAKS_ENVIRONMENT: 'trainingpeaks_environment',
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
  ATHLETE_GROUPS: 5 * 60 * 1000, // 5 minutes - athlete groups change infrequently
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
export function createApiHeaders(
  token: string,
  appOrigin: string = TRAININGPEAKS_ENVIRONMENTS.production.appUrl
): Record<string, string> {
  return {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    origin: appOrigin,
    referer: `${appOrigin}/`,
    // Note: sec-fetch-* headers are automatically added by Chrome
    // Note: user-agent is a forbidden header and cannot be set by extensions
  };
}

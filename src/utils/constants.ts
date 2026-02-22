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
 * TrainingPeaks RxBuilder (structured strength) API base URL
 * Uses a different domain from the classic API
 */
export const RX_API_BASE_URL = 'https://api.peakswaresb.com';

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
 * Create headers for TrainingPeaks API requests
 *
 * Headers match exactly what TrainingPeaks web app sends for authentication.
 * Some headers (sec-*) are automatically added by the browser.
 *
 * @param token - Bearer token for authentication
 * @returns Headers object for fetch requests
 */
export function createApiHeaders(token: string): HeadersInit {
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

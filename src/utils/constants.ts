/**
 * Application constants
 *
 * Centralized configuration values
 */

/**
 * TrainingPeaks API base URL
 */
export const API_BASE_URL = 'https://tpapi.trainingpeaks.com';

/**
 * Token expiration threshold (24 hours in milliseconds)
 */
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Extension display name
 */
export const EXTENSION_NAME = 'TrainingPeaks Library Access';

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

/**
 * Zod schemas for storage validation
 *
 * Provides runtime validation for chrome.storage data
 */

import { z } from 'zod';
import { STORAGE_KEYS } from '@/utils/constants';

/**
 * Schema for token storage data
 */
export const TokenStorageSchema = z.object({
  auth_token: z.string().nullable().optional(),
  token_timestamp: z.number().nullable().optional(),
});

export type TokenStorage = z.infer<typeof TokenStorageSchema>;

/**
 * Schema for validated token data (after retrieval)
 */
export const ValidatedTokenDataSchema = z.object({
  auth_token: z.string().nullable(),
  token_timestamp: z.number().nullable(),
});

export type ValidatedTokenData = z.infer<typeof ValidatedTokenDataSchema>;

/**
 * Schema for connection settings storage
 *
 * Validates the enabled/disabled state of optional provider connections.
 * Uses dynamic keys from STORAGE_KEYS to ensure consistency.
 */
export const ConnectionSettingsStorageSchema = z.object({
  [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: z.boolean().optional(),
  [STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS]: z.boolean().optional(),
});

export type ConnectionSettingsStorage = z.infer<
  typeof ConnectionSettingsStorageSchema
>;

/**
 * Schema for validated connection settings (with defaults applied)
 *
 * Used after retrieval to ensure all values are defined booleans.
 */
export const ValidatedConnectionSettingsSchema = z.object({
  isPlanMyPeakEnabled: z.boolean(),
  isIntervalsEnabled: z.boolean(),
});

export type ValidatedConnectionSettings = z.infer<
  typeof ValidatedConnectionSettingsSchema
>;

/**
 * Parse raw storage data into validated connection settings
 *
 * Applies defaults for missing values (false = disabled by default).
 *
 * @param data - Raw data from chrome.storage.local
 * @returns Validated connection settings with defaults applied
 */
export function parseConnectionSettings(
  data: unknown
): ValidatedConnectionSettings {
  // First validate the raw storage shape
  const parsed = ConnectionSettingsStorageSchema.safeParse(data);

  if (!parsed.success) {
    // Return defaults if validation fails
    return {
      isPlanMyPeakEnabled: false,
      isIntervalsEnabled: false,
    };
  }

  // Transform to validated shape with defaults
  return {
    isPlanMyPeakEnabled:
      parsed.data[STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK] === true,
    isIntervalsEnabled:
      parsed.data[STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS] === true,
  };
}

/**
 * Intervals.icu API Key Storage Service
 *
 * Manages CRUD operations for Intervals.icu API key in chrome.storage.local
 * Provides type-safe access with Zod validation
 */

import { IntervalsApiKeyStorageSchema } from '@/schemas/intervalsicu.schema';
import { logger } from '@/utils/logger';

/**
 * Storage key for Intervals.icu API key
 */
const STORAGE_KEY = 'intervals_api_key';

/**
 * Store Intervals.icu API key in chrome.storage.local
 *
 * @param apiKey - Intervals.icu API key to store
 * @throws Error if API key is empty or whitespace only
 */
export async function setIntervalsApiKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) {
    throw new Error('API key cannot be empty');
  }

  logger.debug('[IntervalsApiKeyService] Storing API key');
  await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
  logger.info('[IntervalsApiKeyService] API key stored successfully');
}

/**
 * Retrieve Intervals.icu API key from chrome.storage.local
 *
 * @returns API key if exists, null otherwise
 * @throws Error if stored data fails Zod validation
 */
export async function getIntervalsApiKey(): Promise<string | null> {
  logger.debug('[IntervalsApiKeyService] Retrieving API key');

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const validated = IntervalsApiKeyStorageSchema.parse(data);

  const apiKey = validated.intervals_api_key ?? null;

  if (apiKey) {
    logger.debug('[IntervalsApiKeyService] API key found');
  } else {
    logger.debug('[IntervalsApiKeyService] No API key stored');
  }

  return apiKey;
}

/**
 * Check if Intervals.icu API key exists in storage
 *
 * @returns true if API key exists and is non-empty, false otherwise
 */
export async function hasIntervalsApiKey(): Promise<boolean> {
  const apiKey = await getIntervalsApiKey();
  return apiKey !== null && apiKey.trim().length > 0;
}

/**
 * Remove Intervals.icu API key from chrome.storage.local
 */
export async function clearIntervalsApiKey(): Promise<void> {
  logger.info('[IntervalsApiKeyService] Clearing API key');
  await chrome.storage.local.remove(STORAGE_KEY);
  logger.debug('[IntervalsApiKeyService] API key cleared');
}

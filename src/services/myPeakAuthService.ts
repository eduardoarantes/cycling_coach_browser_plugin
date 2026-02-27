/**
 * PlanMyPeak authentication service (local app + local Supabase)
 *
 * Stores and validates a separate auth token from the TrainingPeaks token.
 */

import { TOKEN_EXPIRY_MS, STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null && token !== '';
}

export async function getAuthToken(): Promise<string | null> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.MYPEAK_AUTH_TOKEN]);
  return (data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] as string | undefined) ?? null;
}

export async function getSupabaseApiKey(): Promise<string | null> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY,
  ]);
  return (
    (data[STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY] as string | undefined) ?? null
  );
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
    STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
  ]);
}

export async function getTokenAge(): Promise<number | null> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
  ]);
  const timestamp = data[STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP] as
    | number
    | undefined;

  if (!timestamp) {
    return null;
  }

  return Date.now() - timestamp;
}

export async function isTokenExpired(): Promise<boolean> {
  const age = await getTokenAge();
  if (age === null) {
    return true;
  }

  return age > TOKEN_EXPIRY_MS;
}

export async function validateToken(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'VALIDATE_MY_PEAK_TOKEN',
    })) as { valid: boolean; userId?: string };

    if (response.valid) {
      logger.info('[PlanMyPeak Auth] Token valid', response.userId);
      return true;
    }

    logger.warn('[PlanMyPeak Auth] Token invalid');
    return false;
  } catch (error) {
    logger.error('[PlanMyPeak Auth] Error validating token:', error);
    return false;
  }
}

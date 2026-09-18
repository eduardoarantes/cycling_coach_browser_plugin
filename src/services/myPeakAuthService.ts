/**
 * PlanMyPeak authentication service (local app + local Supabase)
 *
 * Stores and validates a separate auth token from the TrainingPeaks token.
 */

import { STORAGE_KEYS } from '@/utils/constants';
import { isAccessTokenExpired } from '@/utils/jwt';
import { logger } from '@/utils/logger';
import type { DiscardStaleMyPeakTokenMessage } from '@/types';

/**
 * Whether a PlanMyPeak credential is *held*, not whether it is usable.
 *
 * Presence-based on purpose: the site-control handshake reports this value as
 * `planMyPeak.authenticated`, and an expired credential that recovery could
 * still replace must not make the page hide its import entry point. Use
 * {@link isTokenExpired} (or the background resolver) for freshness.
 */
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

/**
 * Sign out on the coach's explicit request (e.g. switching environment).
 * Automatic removals go through {@link discardStaleToken} instead.
 */
export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
    STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
    STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT,
  ]);
}

/**
 * Ask the background, which owns the credential, to remove it if it is stale.
 * The background decides again under its lock, so a fresh credential captured
 * after this side judged the old one stale is not erased.
 */
export async function discardStaleToken(): Promise<void> {
  try {
    await chrome.runtime.sendMessage<DiscardStaleMyPeakTokenMessage>({
      type: 'DISCARD_STALE_MY_PEAK_TOKEN',
    });
  } catch (error) {
    logger.warn('[PlanMyPeak Auth] Could not discard a stale token:', error);
  }
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

/**
 * Whether the stored credential should be treated as expired, by the shared
 * rule in `@/utils/jwt`: the token's own expiry claim, falling back to the
 * maximum age since capture when the value carries no usable expiry.
 */
export async function isTokenExpired(): Promise<boolean> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
    STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
  ]);
  const token = data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] as string | undefined;
  if (!token) {
    return true;
  }

  return isAccessTokenExpired(
    token,
    data[STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP] as number | undefined
  );
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

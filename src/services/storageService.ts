/**
 * Storage service for managing chrome.storage.local
 *
 * Provides type-safe wrapper around Chrome storage API with Zod validation
 */

import type { TokenStorage } from '@/types';
import { TokenStorageSchema } from '@/schemas/storage.schema';

/**
 * Store authentication token
 */
export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({
    auth_token: token,
    token_timestamp: Date.now(),
  });
}

/**
 * Retrieve authentication token
 */
export async function getToken(): Promise<string | null> {
  const data = await chrome.storage.local.get('auth_token');
  const validated = TokenStorageSchema.parse(data);
  return validated.auth_token ?? null;
}

/**
 * Get token with timestamp (validated)
 */
export async function getTokenWithTimestamp(): Promise<TokenStorage> {
  const data = await chrome.storage.local.get([
    'auth_token',
    'token_timestamp',
  ]);
  const validated = TokenStorageSchema.parse(data);
  return {
    auth_token: validated.auth_token ?? null,
    token_timestamp: validated.token_timestamp ?? null,
  };
}

/**
 * Clear authentication token
 */
export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(['auth_token', 'token_timestamp']);
}

/**
 * Check if token exists
 */
export async function hasToken(): Promise<boolean> {
  const token = await getToken();
  return token !== null && token !== '';
}

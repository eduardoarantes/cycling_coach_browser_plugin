/**
 * Storage service for managing chrome.storage.local
 *
 * Provides type-safe wrapper around Chrome storage API
 */

import type { TokenStorage } from '../types';

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
  return (data.auth_token as string) || null;
}

/**
 * Get token with timestamp
 */
export async function getTokenWithTimestamp(): Promise<TokenStorage> {
  const data = await chrome.storage.local.get([
    'auth_token',
    'token_timestamp',
  ]);
  return {
    auth_token: (data.auth_token as string) || null,
    token_timestamp: (data.token_timestamp as number) || null,
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

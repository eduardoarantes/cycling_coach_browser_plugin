/**
 * Authentication service
 *
 * Manages authentication state and token operations
 */

import * as storageService from './storageService';

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  return await storageService.hasToken();
}

/**
 * Get current authentication token
 */
export async function getAuthToken(): Promise<string | null> {
  return await storageService.getToken();
}

/**
 * Store authentication token
 */
export async function setAuthToken(token: string): Promise<void> {
  if (!token || token.trim() === '') {
    throw new Error('Token cannot be empty');
  }
  await storageService.setToken(token);
}

/**
 * Clear authentication (logout)
 */
export async function clearAuth(): Promise<void> {
  await storageService.clearToken();
}

/**
 * Get token age in milliseconds
 */
export async function getTokenAge(): Promise<number | null> {
  const { token_timestamp } = await storageService.getTokenWithTimestamp();
  if (!token_timestamp) {
    return null;
  }
  return Date.now() - token_timestamp;
}

/**
 * Check if token is expired (older than 24 hours)
 */
export async function isTokenExpired(): Promise<boolean> {
  const age = await getTokenAge();
  if (age === null) {
    return true;
  }
  // Consider token expired if older than 24 hours
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  return age > TWENTY_FOUR_HOURS;
}

/**
 * Authentication service
 *
 * Manages authentication state and token operations
 */

import * as storageService from './storageService';
import { TOKEN_EXPIRY_MS } from '@/utils/constants';
import { logger } from '@/utils/logger';

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
  return age > TOKEN_EXPIRY_MS;
}

/**
 * Validate token by sending message to background worker
 * Background worker makes the API call (bypasses CORS)
 * Returns true if token is valid, false if invalid
 */
export async function validateToken(): Promise<boolean> {
  console.log('[Auth Service] Requesting token validation from background...');

  try {
    // Send validation request to background worker
    const response = (await chrome.runtime.sendMessage({
      type: 'VALIDATE_TOKEN',
    })) as { valid: boolean; userId?: number };

    console.log('[Auth Service] Validation response:', response);

    if (response.valid) {
      console.log('[Auth Service] ✅ Token is valid');
      if (response.userId) {
        console.log('[Auth Service] User ID:', response.userId);
      }
      return true;
    } else {
      console.log('[Auth Service] ❌ Token is invalid (cleared by background)');
      return false;
    }
  } catch (error) {
    console.error('[Auth Service] Error during validation:', error);
    logger.error('Error validating token:', error);
    return false;
  }
}

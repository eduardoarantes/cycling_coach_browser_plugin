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
  logger.debug('Requesting token validation from background worker');

  try {
    // Send validation request to background worker
    const response = (await chrome.runtime.sendMessage({
      type: 'VALIDATE_TOKEN',
    })) as { valid: boolean; userId?: number };

    if (response.valid) {
      logger.debug('TrainingPeaks token validated successfully');
      return true;
    } else {
      logger.debug('TrainingPeaks token is invalid');
      return false;
    }
  } catch (error) {
    logger.error('Error validating token:', error);
    return false;
  }
}

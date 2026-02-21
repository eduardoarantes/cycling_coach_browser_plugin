/**
 * Message handler for background service worker
 *
 * Handles messages from content scripts and popup
 */

import type { RuntimeMessage } from '@/types';
import type {
  UserProfile,
  Library,
  LibraryItem,
  ApiResponse,
} from '@/types/api.types';
import { logger } from '@/utils/logger';
import { API_BASE_URL, createApiHeaders } from '@/utils/constants';
import {
  fetchUser,
  fetchLibraries,
  fetchLibraryItems,
} from './api/trainingPeaks';

type MessageResponse =
  | { success: true }
  | { success: false; error: string }
  | { token: string | null; timestamp: number | null }
  | { valid: boolean; userId?: number }
  | ApiResponse<UserProfile>
  | ApiResponse<Library[]>
  | ApiResponse<LibraryItem[]>;

/**
 * Handle TOKEN_FOUND message from content script
 */
async function handleTokenFound(
  token: string,
  timestamp: number
): Promise<void> {
  try {
    logger.info('🎫 Storing bearer token, length:', token.length);
    logger.info('📅 Token timestamp:', new Date(timestamp).toISOString());

    // Store token in chrome.storage.local
    await chrome.storage.local.set({
      auth_token: token,
      token_timestamp: timestamp,
    });

    logger.info('✅ Token stored successfully in chrome.storage.local');

    // Verify storage (debug)
    const stored = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    logger.info('🔍 Verification - Token exists:', !!stored.auth_token);
    logger.info(
      '🔍 Verification - Timestamp exists:',
      !!stored.token_timestamp
    );
  } catch (error) {
    logger.error('❌ Failed to store token:', error);
    throw error;
  }
}

/**
 * Handle GET_TOKEN message from popup
 */
async function handleGetToken(): Promise<{
  token: string | null;
  timestamp: number | null;
}> {
  try {
    const data = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    return {
      token: (data.auth_token as string) || null,
      timestamp: (data.token_timestamp as number) || null,
    };
  } catch (error) {
    logger.error('Failed to retrieve token:', error);
    throw error;
  }
}

/**
 * Handle CLEAR_TOKEN message from popup
 */
async function handleClearToken(): Promise<void> {
  try {
    await chrome.storage.local.remove(['auth_token', 'token_timestamp']);
    logger.info('Token cleared');
  } catch (error) {
    logger.error('Failed to clear token:', error);
    throw error;
  }
}

/**
 * Handle VALIDATE_TOKEN message from popup
 * Validates token by calling TrainingPeaks API from background context (bypasses CORS)
 */
async function handleValidateToken(): Promise<{
  valid: boolean;
  userId?: number;
}> {
  try {
    console.log('[TP Extension - Background] 🔍 Starting token validation...');
    logger.debug('Starting token validation...');

    // Get token from storage
    const data = await chrome.storage.local.get(['auth_token']);
    const token = data.auth_token as string | undefined;

    console.log('[TP Extension - Background] Has token:', !!token);
    logger.debug('Has token:', !!token);

    if (!token) {
      console.log('[TP Extension - Background] ❌ No token to validate');
      logger.debug('No token to validate');
      return { valid: false };
    }

    console.log('[TP Extension - Background] Token length:', token.length);
    logger.debug('Token length:', token.length);

    // Call TrainingPeaks API from background context (has host_permissions)
    const endpoint = `${API_BASE_URL}/users/v3/user`;
    console.log('[TP Extension - Background] 🌐 Calling API:', endpoint);
    logger.debug('Calling API:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: createApiHeaders(token),
    });

    console.log(
      '[TP Extension - Background] 📡 Response status:',
      response.status
    );
    console.log('[TP Extension - Background] Response ok:', response.ok);
    logger.debug('Response status:', response.status);
    logger.debug('Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log(
        '[TP Extension - Background] ✅ Token is valid! User ID:',
        data.user?.userId
      );
      logger.info('Token is valid, User ID:', data.user?.userId);
      return { valid: true, userId: data.user?.userId };
    }

    // Token validation failed
    const errorText = await response.text();
    console.error(
      '[TP Extension - Background] ❌ Token validation failed - Status:',
      response.status,
      'Response:',
      errorText
    );
    logger.error(
      'Token validation failed - Status:',
      response.status,
      'Response:',
      errorText
    );

    // Don't automatically clear the token - it might still work for other API calls
    // Let the user clear it manually if needed
    console.log(
      '[TP Extension - Background] ⚠️ Token validation failed, but keeping token (might work for other endpoints)'
    );
    logger.warn(
      'Token validation failed, but keeping token (might work for other endpoints)'
    );

    return { valid: false };
  } catch (error) {
    console.error(
      '[TP Extension - Background] ❌ ERROR validating token:',
      error
    );
    logger.error('Error validating token:', error);
    // On network error, don't clear token (might be temporary)
    return { valid: false };
  }
}

/**
 * Handle GET_USER message from popup
 * Fetches user profile from TrainingPeaks API
 */
async function handleGetUser(): Promise<ApiResponse<UserProfile>> {
  logger.debug('Handling GET_USER message');
  return await fetchUser();
}

/**
 * Handle GET_LIBRARIES message from popup
 * Fetches libraries list from TrainingPeaks API
 */
async function handleGetLibraries(): Promise<ApiResponse<Library[]>> {
  logger.debug('Handling GET_LIBRARIES message');
  return await fetchLibraries();
}

/**
 * Handle GET_LIBRARY_ITEMS message from popup
 * Fetches library items from TrainingPeaks API
 */
async function handleGetLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  logger.debug('Handling GET_LIBRARY_ITEMS message for library:', libraryId);
  return await fetchLibraryItems(libraryId);
}

/**
 * Main message router
 */
export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  logger.debug('Background received message:', message.type, 'from:', sender);

  switch (message.type) {
    case 'TOKEN_FOUND':
      await handleTokenFound(message.token, message.timestamp);
      return { success: true };

    case 'GET_TOKEN':
      return await handleGetToken();

    case 'CLEAR_TOKEN':
      await handleClearToken();
      return { success: true };

    case 'VALIDATE_TOKEN':
      return await handleValidateToken();

    case 'GET_USER':
      return await handleGetUser();

    case 'GET_LIBRARIES':
      return await handleGetLibraries();

    case 'GET_LIBRARY_ITEMS':
      return await handleGetLibraryItems(message.libraryId);

    default:
      logger.warn('Unknown message type received');
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Message handler for background service worker
 *
 * Handles messages from content scripts and popup
 */

import type { RuntimeMessage } from '@/types';
import { logger } from '@/utils/logger';

type MessageResponse =
  | { success: true }
  | { success: false; error: string }
  | { token: string | null; timestamp: number | null };

/**
 * Handle TOKEN_FOUND message from content script
 */
async function handleTokenFound(
  token: string,
  timestamp: number
): Promise<void> {
  try {
    // Store token in chrome.storage.local
    await chrome.storage.local.set({
      auth_token: token,
      token_timestamp: timestamp,
    });

    logger.info('Token stored successfully');
  } catch (error) {
    logger.error('Failed to store token:', error);
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

    default:
      logger.warn('Unknown message type received');
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Message handler for background service worker
 *
 * Handles messages from content scripts and popup
 */

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

    console.log('TrainingPeaks Extension: Token stored successfully');
  } catch (error) {
    console.error('Failed to store token:', error);
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
    console.error('Failed to retrieve token:', error);
    throw error;
  }
}

/**
 * Handle CLEAR_TOKEN message from popup
 */
async function handleClearToken(): Promise<void> {
  try {
    await chrome.storage.local.remove(['auth_token', 'token_timestamp']);
    console.log('TrainingPeaks Extension: Token cleared');
  } catch (error) {
    console.error('Failed to clear token:', error);
    throw error;
  }
}

/**
 * Main message router
 */
export async function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  console.log('Background received message:', message.type, 'from:', sender);

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
      console.warn('Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

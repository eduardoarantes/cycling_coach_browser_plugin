/**
 * Utility functions for interacting with TrainingPeaks tabs
 */

import { logger } from './logger';

const TRAINING_PEAKS_URL = 'https://app.trainingpeaks.com';

/**
 * Opens or focuses the TrainingPeaks tab to allow token refresh
 *
 * Strategy:
 * 1. Look for existing TrainingPeaks tab
 * 2. If found, reload and focus it
 * 3. If not found, create new tab
 *
 * This allows the content script to capture a fresh authentication token
 */
export async function openTrainingPeaksTab(): Promise<void> {
  try {
    // Query for existing TrainingPeaks tabs
    const tabs = await chrome.tabs.query({
      url: `${TRAINING_PEAKS_URL}/*`,
    });

    if (tabs.length > 0 && tabs[0].id) {
      // Found existing tab - reload and focus it
      logger.info('Found existing TrainingPeaks tab, reloading...');
      await chrome.tabs.reload(tabs[0].id);
      await chrome.tabs.update(tabs[0].id, { active: true });

      // Focus the window containing the tab
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      // No existing tab - create new one
      logger.info('Creating new TrainingPeaks tab...');
      await chrome.tabs.create({
        url: TRAINING_PEAKS_URL,
        active: true,
      });
    }
  } catch (error) {
    logger.error('Failed to open TrainingPeaks tab:', error);
    throw error;
  }
}

/**
 * Check if an error is a 401 authentication error
 */
export function is401Error(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('not authenticated') ||
    message.includes('no_token')
  );
}

/**
 * Utility functions for interacting with the local PlanMyPeak tab
 */

import { MYPEAK_APP_URL } from './constants';
import { logger } from './logger';

export async function openMyPeakTab(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({
      url: `${MYPEAK_APP_URL}/*`,
    });

    if (tabs.length > 0 && tabs[0].id) {
      logger.info('Found existing PlanMyPeak tab, reloading...');
      await chrome.tabs.reload(tabs[0].id);
      await chrome.tabs.update(tabs[0].id, { active: true });

      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }

      return;
    }

    logger.info('Creating new PlanMyPeak tab...');
    await chrome.tabs.create({
      url: MYPEAK_APP_URL,
      active: true,
    });
  } catch (error) {
    logger.error('Failed to open PlanMyPeak tab:', error);
    throw error;
  }
}

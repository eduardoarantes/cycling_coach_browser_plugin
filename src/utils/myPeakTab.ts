/**
 * PlanMyPeak tab helpers for the popup.
 *
 * Two different needs live here and must not be confused:
 *
 * - `requestPlanMyPeakAuthRefresh` refreshes the captured token quietly, in a
 *   temporary background tab handled by the background worker. The coach's
 *   own PlanMyPeak tab is never reloaded or focused.
 * - `reloadPlanMyPeakTab` is a **data** refresh of the portal itself (for
 *   example so freshly imported groups appear). It does reload and focus the
 *   coach's tab, and is only ever run when they explicitly ask for it.
 */

import type { AuthRefreshResult, RefreshProviderAuthMessage } from '@/types';
import { getPlanMyPeakAppUrl } from '@/services/planMyPeakConfigService';
import { logger } from './logger';

/**
 * Ask the background to refresh the PlanMyPeak token in a temporary
 * background tab. See `requestTrainingPeaksAuthRefresh` for the contract.
 */
export async function requestPlanMyPeakAuthRefresh(): Promise<AuthRefreshResult> {
  try {
    return await chrome.runtime.sendMessage<
      RefreshProviderAuthMessage,
      AuthRefreshResult
    >({ type: 'REFRESH_PROVIDER_AUTH', provider: 'planmypeak' });
  } catch (error) {
    logger.error('Failed to request PlanMyPeak auth refresh:', error);
    return {
      outcome: 'error',
      error: error instanceof Error ? error.message : 'Auth refresh failed',
    };
  }
}

/**
 * Reload and focus the coach's PlanMyPeak tab (or open one) so the portal
 * shows fresh data. This is disruptive by design and is only used when the
 * coach explicitly asks to see the result of an import in PlanMyPeak.
 */
export async function reloadPlanMyPeakTab(): Promise<void> {
  try {
    const appUrl = await getPlanMyPeakAppUrl();

    const tabs = await chrome.tabs.query({
      url: `${appUrl}/*`,
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

    logger.info(`Creating new PlanMyPeak tab at ${appUrl}...`);
    await chrome.tabs.create({
      url: appUrl,
      active: true,
    });
  } catch (error) {
    logger.error('Failed to open PlanMyPeak tab:', error);
    throw error;
  }
}

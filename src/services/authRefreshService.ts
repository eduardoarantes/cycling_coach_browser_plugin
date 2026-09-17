/**
 * Auth refresh service (background only)
 *
 * Refreshes a provider's captured bearer token without touching the coach's
 * own tabs. The extension holds no credential of its own: the TrainingPeaks
 * and PlanMyPeak tokens are only visible when the site's page makes an
 * authenticated request, which the main-world interceptor captures and the
 * background stores. So a refresh is: open a temporary **background** tab on
 * the site, let its normal page load issue that request, and close the tab as
 * soon as the token lands in storage.
 *
 * A background tab, not a window: a new window steals focus and closes the
 * popup. And the existing site tab is never reloaded — that is exactly the
 * disruption this replaces.
 *
 * Runs in the service worker so the sequence completes even if the popup is
 * closed mid-way, and callers get a real completion signal instead of a timer.
 */

import { STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';
import { getTrainingPeaksAppUrl } from '@/services/trainingPeaksConfigService';
import { getPlanMyPeakAppUrl } from '@/services/planMyPeakConfigService';

export type AuthRefreshProvider = 'trainingpeaks' | 'planmypeak';

export type AuthRefreshOutcome =
  | 'refreshed'
  | 'sign_in_required'
  | 'cancelled'
  | 'error';

export interface AuthRefreshResult {
  outcome: AuthRefreshOutcome;
  /** Tab left open for the coach to sign in (only for `sign_in_required`). */
  tabId?: number;
  error?: string;
}

/**
 * How long a freshly opened site tab gets to produce an authenticated request
 * before we assume the coach is signed out and surface the tab.
 */
export const AUTH_REFRESH_TIMEOUT_MS = 20_000;

interface ProviderSpec {
  appUrl: () => Promise<string>;
  tokenKey: string;
  timestampKey: string;
}

const PROVIDERS: Record<AuthRefreshProvider, ProviderSpec> = {
  trainingpeaks: {
    appUrl: getTrainingPeaksAppUrl,
    tokenKey: STORAGE_KEYS.AUTH_TOKEN,
    timestampKey: STORAGE_KEYS.TOKEN_TIMESTAMP,
  },
  planmypeak: {
    appUrl: getPlanMyPeakAppUrl,
    tokenKey: STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
    timestampKey: STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
  },
};

/** One refresh per provider at a time; a second request joins the first. */
const inFlight = new Map<AuthRefreshProvider, Promise<AuthRefreshResult>>();

async function removeTabQuietly(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    // Already closed by the coach or the browser; nothing to do.
    logger.debug('Auth refresh tab already gone:', tabId, error);
  }
}

/**
 * Wait for the provider's token to be (re)written, the tab to be closed, or
 * the timeout — whichever comes first.
 */
function waitForCapture(
  spec: ProviderSpec,
  tabId: number,
  startedAt: number,
  timeoutMs: number
): Promise<'captured' | 'tab_closed' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: 'captured' | 'tab_closed' | 'timeout'): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onStorageChange);
      chrome.tabs.onRemoved.removeListener(onTabRemoved);
      resolve(result);
    };

    const onStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const tokenChange = changes[spec.tokenKey];
      if (!tokenChange || typeof tokenChange.newValue !== 'string') return;
      if (tokenChange.newValue.length === 0) return;

      // A token written before we opened the tab is not the one we asked for.
      const timestampChange = changes[spec.timestampKey];
      const writtenAt =
        typeof timestampChange?.newValue === 'number'
          ? timestampChange.newValue
          : Date.now();
      if (writtenAt < startedAt) return;

      finish('captured');
    };

    const onTabRemoved = (removedTabId: number): void => {
      if (removedTabId === tabId) {
        finish('tab_closed');
      }
    };

    const timer = setTimeout(() => finish('timeout'), timeoutMs);

    chrome.storage.onChanged.addListener(onStorageChange);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
  });
}

async function runRefresh(
  provider: AuthRefreshProvider,
  timeoutMs: number
): Promise<AuthRefreshResult> {
  const spec = PROVIDERS[provider];
  let tabId: number | undefined;

  try {
    const url = await spec.appUrl();
    const startedAt = Date.now();

    logger.info(`Refreshing ${provider} auth in a background tab:`, url);
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    if (tabId === undefined) {
      return { outcome: 'error', error: 'Browser did not return a tab id' };
    }

    const result = await waitForCapture(spec, tabId, startedAt, timeoutMs);

    if (result === 'captured') {
      logger.info(`${provider} auth refreshed; closing background tab`);
      await removeTabQuietly(tabId);
      return { outcome: 'refreshed' };
    }

    if (result === 'tab_closed') {
      logger.info(`${provider} auth refresh cancelled: tab was closed`);
      return { outcome: 'cancelled' };
    }

    // No authenticated request arrived: the coach is most likely signed out.
    // Leave the tab open and bring it forward so they can sign in there.
    logger.warn(`${provider} auth refresh timed out; surfacing the tab`);
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      logger.debug('Could not activate auth refresh tab:', error);
    }
    return { outcome: 'sign_in_required', tabId };
  } catch (error) {
    logger.error(`Failed to refresh ${provider} auth:`, error);
    if (tabId !== undefined) {
      await removeTabQuietly(tabId);
    }
    return {
      outcome: 'error',
      error: error instanceof Error ? error.message : 'Auth refresh failed',
    };
  }
}

/**
 * Refresh a provider's token in a temporary background tab.
 *
 * Concurrent calls for the same provider share one tab and one result.
 */
export function refreshProviderAuth(
  provider: AuthRefreshProvider,
  options: { timeoutMs?: number } = {}
): Promise<AuthRefreshResult> {
  const existing = inFlight.get(provider);
  if (existing) {
    return existing;
  }

  const run = runRefresh(
    provider,
    options.timeoutMs ?? AUTH_REFRESH_TIMEOUT_MS
  ).finally(() => {
    inFlight.delete(provider);
  });
  inFlight.set(provider, run);
  return run;
}

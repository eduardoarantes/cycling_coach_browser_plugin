/**
 * PlanMyPeak credential handling as seen through the background router:
 * captures are refused from an inactive environment, the handshake stays
 * presence-based and prompt, and only a run minted for an extension page may
 * recover.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import { resetPlanMyPeakAuthRecovery } from '@/background/api/planMyPeakAuthRecovery';
import { resetPlanMyPeakIdentityCache } from '@/services/planMyPeakIdentityService';
import { COACH_LOOKUP_TIMEOUT_MS } from '@/services/planMyPeakIdentityService';
import * as authService from '@/services/authService';
import { refreshProviderAuth } from '@/services/authRefreshService';
import { STORAGE_KEYS } from '@/utils/constants';
import type { SiteControlRequestMessage } from '@/types';
import type {
  SiteControlPingResult,
  SiteControlRequest,
  SiteControlResponse,
} from '@/types/siteControl.types';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_PAGE_SOURCE,
  SITE_CONTROL_REQUEST_TYPES,
} from '@/types/siteControl.types';

vi.mock('@/services/authRefreshService', () => ({
  refreshProviderAuth: vi.fn(),
  AUTH_REFRESH_TIMEOUT_MS: 20_000,
}));

const PORTAL = 'https://portal.planmypeak.com';
const STAGING = 'https://staging.app.planmypeak.com';

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(expiresInSeconds: number, subject: string): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return [
    base64Url('{"alg":"HS256"}'),
    base64Url(JSON.stringify({ sub: subject, exp })),
    'sig',
  ].join('.');
}

function tabSender(origin: string): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    origin,
    tab: { id: 7, url: `${origin}/dashboard` } as chrome.tabs.Tab,
  };
}

/** The popup: an extension page, so no `tab`. */
const popupSender: chrome.runtime.MessageSender = {
  id: 'test-extension-id',
  url: 'chrome-extension://test-extension-id/popup.html',
};

function ping(): SiteControlRequestMessage {
  return {
    type: 'SITE_CONTROL_REQUEST',
    request: {
      source: SITE_CONTROL_PAGE_SOURCE,
      version: PLANMYPEAK_SITE_CONTROL_VERSION,
      requestId: 'req-1',
      type: 'PING',
      payload: {},
    } as SiteControlRequest,
  };
}

async function storedToken(): Promise<unknown> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.MYPEAK_AUTH_TOKEN]);
  return data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN];
}

describe('messageHandler PlanMyPeak credentials', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
    });
    resetPlanMyPeakAuthRecovery();
    resetPlanMyPeakIdentityCache();
    vi.mocked(refreshProviderAuth).mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(authService, 'isAuthenticated').mockResolvedValue(true);
    vi.spyOn(authService, 'isTokenExpired').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MY_PEAK_AUTH_FOUND', () => {
    it('should not let a staging-origin capture displace the production credential', async () => {
      const production = jwt(3600, 'production');
      await handleMessage(
        {
          type: 'MY_PEAK_AUTH_FOUND',
          token: production,
          timestamp: Date.now(),
        },
        tabSender(PORTAL)
      );

      await handleMessage(
        {
          type: 'MY_PEAK_AUTH_FOUND',
          token: jwt(3600, 'staging'),
          timestamp: Date.now(),
        },
        tabSender(STAGING)
      );

      expect(await storedToken()).toBe(production);
    });

    it('should derive the environment from the sender, not the message', async () => {
      await handleMessage(
        {
          type: 'MY_PEAK_AUTH_FOUND',
          token: jwt(3600, 'coach'),
          timestamp: Date.now(),
          // Not part of the contract; a sender cannot choose its environment.
          environment: 'staging',
        } as never,
        tabSender(PORTAL)
      );

      const data = await chrome.storage.local.get([
        STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT,
      ]);
      expect(data[STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT]).toBe('production');
    });
  });

  describe('PING', () => {
    it('should still report authenticated for a present but expired credential', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
        [STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP]: Date.now(),
      });

      const response = (await handleMessage(
        ping(),
        tabSender(PORTAL)
      )) as SiteControlResponse;

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      const result = response.data as SiteControlPingResult;
      expect(result.planMyPeak.authenticated).toBe(true);
      // Passive: no lookup is sent with a credential known to be expired.
      expect(result.planMyPeak.coachId).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should answer within its budget while a recovery is in flight', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
        [STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP]: Date.now(),
      });
      vi.mocked(refreshProviderAuth).mockReturnValue(new Promise(() => {}));

      // An export is recovering under its run.
      const { authRunId } = (await handleMessage(
        { type: 'BEGIN_PLANMYPEAK_AUTH_RUN' },
        popupSender
      )) as { authRunId: string };
      void handleMessage(
        { type: 'GET_PLANMYPEAK_LIBRARIES', authRunId },
        popupSender
      );

      const startedAt = Date.now();
      await handleMessage(ping(), tabSender(PORTAL));

      expect(Date.now() - startedAt).toBeLessThan(COACH_LOOKUP_TIMEOUT_MS);
      expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe('recovery runs', () => {
    it('should mint a run for an extension page', async () => {
      const result = (await handleMessage(
        { type: 'BEGIN_PLANMYPEAK_AUTH_RUN' },
        popupSender
      )) as { authRunId: string | null };

      expect(typeof result.authRunId).toBe('string');
    });

    it('should refuse to mint a run for a tab, including an allowlisted one', async () => {
      const result = (await handleMessage(
        { type: 'BEGIN_PLANMYPEAK_AUTH_RUN' },
        tabSender(PORTAL)
      )) as { authRunId: string | null };

      expect(result.authRunId).toBeNull();
    });

    it('should resolve a library request without a run passively', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
      });

      const result = await handleMessage(
        { type: 'GET_PLANMYPEAK_LIBRARIES' },
        popupSender
      );

      expect(result).toMatchObject({ success: false });
      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should resolve a request carrying an id the background never minted passively', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
      });

      await handleMessage(
        { type: 'GET_PLANMYPEAK_LIBRARIES', authRunId: 'invented' },
        popupSender
      );

      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should resolve a request under an ended run passively', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
      });
      const { authRunId } = (await handleMessage(
        { type: 'BEGIN_PLANMYPEAK_AUTH_RUN' },
        popupSender
      )) as { authRunId: string };
      await handleMessage(
        { type: 'END_PLANMYPEAK_AUTH_RUN', authRunId },
        popupSender
      );

      await handleMessage(
        { type: 'GET_PLANMYPEAK_LIBRARIES', authRunId },
        popupSender
      );

      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should keep the captured-workout send passive even when it carries a run', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
      });
      const { authRunId } = (await handleMessage(
        { type: 'BEGIN_PLANMYPEAK_AUTH_RUN' },
        popupSender
      )) as { authRunId: string };

      await handleMessage(
        {
          type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
          workouts: [],
          libraryId: 'lib-1',
          capturedKeys: { 'cal:1': 'production:1:1' },
          authRunId,
        },
        popupSender
      );

      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });
  });

  describe('page surface', () => {
    it('should not expose the run or credential messages as site-control requests', () => {
      for (const type of [
        'BEGIN_PLANMYPEAK_AUTH_RUN',
        'END_PLANMYPEAK_AUTH_RUN',
        'DISCARD_STALE_MY_PEAK_TOKEN',
      ]) {
        expect(SITE_CONTROL_REQUEST_TYPES as readonly string[]).not.toContain(
          type
        );
      }
    });
  });

  describe('DISCARD_STALE_MY_PEAK_TOKEN', () => {
    it('should remove a stale credential', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: jwt(-60, 'expired'),
      });

      await handleMessage({ type: 'DISCARD_STALE_MY_PEAK_TOKEN' }, popupSender);

      expect(await storedToken()).toBeUndefined();
    });

    it('should leave a fresh credential in place', async () => {
      const fresh = jwt(3600, 'fresh');
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: fresh,
      });

      await handleMessage({ type: 'DISCARD_STALE_MY_PEAK_TOKEN' }, popupSender);

      expect(await storedToken()).toBe(fresh);
    });
  });
});

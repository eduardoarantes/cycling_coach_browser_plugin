/**
 * PlanMyPeak credential resolution and recovery: passive answers never open a
 * tab, recovery is single-flight and scoped to a run, and a capture is not a
 * success until the API accepts it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_RUN_IDLE_TTL_MS,
  beginAuthRun,
  endAuthRun,
  getAuthRun,
  latchAuthRun,
  recoverForRun,
  resetPlanMyPeakAuthRecovery,
  resolveCredential,
} from '@/background/api/planMyPeakAuthRecovery';
import {
  removePlanMyPeakCredentialIf,
  removePlanMyPeakCredentialIfStale,
  storeObservedPlanMyPeakAuth,
} from '@/background/api/planMyPeakCredential';
import { refreshProviderAuth } from '@/services/authRefreshService';
import { STORAGE_KEYS } from '@/utils/constants';

vi.mock('@/services/authRefreshService', () => ({
  refreshProviderAuth: vi.fn(),
}));

const PORTAL = 'https://portal.planmypeak.com';
const STAGING = 'https://staging.app.planmypeak.com';

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwt(expiresInSeconds: number, subject = 'coach'): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return [
    base64Url('{"alg":"HS256"}'),
    base64Url(JSON.stringify({ sub: subject, exp })),
    'sig',
  ].join('.');
}

async function storeCredential(
  token: string,
  environment: string | null = 'production'
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: token,
    [STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP]: Date.now(),
    ...(environment
      ? { [STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT]: environment }
      : {}),
  });
}

async function storedToken(): Promise<unknown> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.MYPEAK_AUTH_TOKEN]);
  return data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN];
}

/** A refresh that captures `token`, the way the real background tab would. */
function refreshCaptures(token: string): void {
  vi.mocked(refreshProviderAuth).mockImplementation(async () => {
    await storeCredential(token);
    return { outcome: 'refreshed' };
  });
}

describe('planMyPeakAuthRecovery', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
    });
    resetPlanMyPeakAuthRecovery();
    vi.mocked(refreshProviderAuth).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('resolveCredential', () => {
    it('should report a fresh stored credential as usable', async () => {
      const token = jwt(3600);
      await storeCredential(token);

      expect(await resolveCredential()).toEqual({ usable: true, token });
    });

    it('should report an expired credential as not usable without refreshing', async () => {
      await storeCredential(jwt(-60));

      expect((await resolveCredential()).usable).toBe(false);
      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should treat a credential from a confirmed other environment as absent', async () => {
      await storeCredential(jwt(3600), 'staging');

      expect(await resolveCredential()).toEqual({ usable: false, token: null });
    });

    it('should keep a credential with no recorded environment usable', async () => {
      await storeCredential(jwt(3600), null);

      expect((await resolveCredential()).usable).toBe(true);
    });

    it('should keep a credential recorded as unknown usable', async () => {
      await storeCredential(jwt(3600), 'unknown');

      expect((await resolveCredential()).usable).toBe(true);
    });

    it('should not wait on a recovery that is in flight', async () => {
      await storeCredential(jwt(-60));
      vi.mocked(refreshProviderAuth).mockReturnValue(new Promise(() => {}));

      const run = beginAuthRun();
      void recoverForRun(run);

      const answer = await Promise.race([
        resolveCredential().then(() => 'answered'),
        new Promise((resolve) => setTimeout(() => resolve('waited'), 50)),
      ]);

      expect(answer).toBe('answered');
    });
  });

  describe('recoverForRun', () => {
    it('should return a usable stored credential without refreshing', async () => {
      const token = jwt(3600);
      await storeCredential(token);

      expect(await recoverForRun(beginAuthRun())).toEqual({ ok: true, token });
      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });

    it('should refresh and return the captured credential', async () => {
      await storeCredential(jwt(-60));
      const fresh = jwt(3600, 'fresh');
      refreshCaptures(fresh);

      expect(await recoverForRun(beginAuthRun())).toEqual({
        ok: true,
        token: fresh,
      });
    });

    it('should not return the credential a request just had rejected', async () => {
      const rejected = jwt(3600, 'rejected');
      await storeCredential(rejected);
      const fresh = jwt(3600, 'fresh');
      refreshCaptures(fresh);

      const result = await recoverForRun(beginAuthRun(), {
        rejectedToken: rejected,
      });

      expect(result).toEqual({ ok: true, token: fresh });
      expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    });

    it('should share one attempt between concurrent callers', async () => {
      const fresh = jwt(3600, 'fresh');
      refreshCaptures(fresh);

      const [a, b] = await Promise.all([
        recoverForRun(beginAuthRun()),
        recoverForRun(beginAuthRun()),
      ]);

      expect(a).toEqual({ ok: true, token: fresh });
      expect(b).toEqual({ ok: true, token: fresh });
      expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    });

    it('should count a non-refreshed outcome as unsuccessful and latch the run', async () => {
      vi.mocked(refreshProviderAuth).mockResolvedValue({
        outcome: 'sign_in_required',
        tabId: 7,
      });
      const run = beginAuthRun();

      expect(await recoverForRun(run)).toMatchObject({
        ok: false,
        reason: 'sign_in_required',
        tabOpened: true,
      });

      // Latched: no further attempt, no tab, no claim that one was opened.
      expect(await recoverForRun(run)).toMatchObject({
        ok: false,
        tabOpened: false,
      });
      expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    });

    it('should count a captured credential that is already expired as unsuccessful', async () => {
      refreshCaptures(jwt(-60));

      expect(await recoverForRun(beginAuthRun())).toMatchObject({
        ok: false,
        reason: 'sign_in_required',
      });
    });

    it('should count a captured credential from another environment as unsuccessful', async () => {
      vi.mocked(refreshProviderAuth).mockImplementation(async () => {
        await storeCredential(jwt(3600), 'staging');
        return { outcome: 'refreshed' };
      });

      expect(await recoverForRun(beginAuthRun())).toMatchObject({
        ok: false,
        reason: 'environment_mismatch',
      });
    });

    it('should open at most one tab across a thirty-request batch', async () => {
      vi.mocked(refreshProviderAuth).mockResolvedValue({
        outcome: 'sign_in_required',
      });
      const run = beginAuthRun();

      for (let i = 0; i < 30; i++) {
        await recoverForRun(run);
      }

      expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    });

    it('should not let a terminal run block a concurrent unrelated run', async () => {
      const failed = beginAuthRun();
      latchAuthRun(failed, 'sign_in_required');
      resetCooldown();

      const other = beginAuthRun();
      const fresh = jwt(3600);
      refreshCaptures(fresh);

      expect(await recoverForRun(other)).toEqual({ ok: true, token: fresh });
      expect(await recoverForRun(failed)).toMatchObject({ ok: false });
    });

    it('should let an explicit retry after signing in start a fresh run', async () => {
      vi.mocked(refreshProviderAuth).mockResolvedValue({
        outcome: 'sign_in_required',
      });
      const first = beginAuthRun();
      await recoverForRun(first);
      endAuthRun(first);

      // The coach signs in; the page's own request is captured.
      const signedIn = jwt(3600);
      await storeCredential(signedIn);

      expect(await recoverForRun(beginAuthRun())).toEqual({
        ok: true,
        token: signedIn,
      });
    });

    it('should refuse to recover under an ended run', async () => {
      const run = beginAuthRun();
      endAuthRun(run);

      expect(await recoverForRun(run)).toMatchObject({
        ok: false,
        tabOpened: false,
      });
      expect(refreshProviderAuth).not.toHaveBeenCalled();
    });
  });

  describe('run lifetime', () => {
    it('should expire a run that is never ended', () => {
      vi.useFakeTimers();
      const run = beginAuthRun();
      latchAuthRun(run, 'sign_in_required');

      vi.advanceTimersByTime(AUTH_RUN_IDLE_TTL_MS + 1);

      expect(getAuthRun(run.id)).toBeNull();
    });

    it('should keep a run alive while it is being used', () => {
      vi.useFakeTimers();
      const run = beginAuthRun();

      vi.advanceTimersByTime(AUTH_RUN_IDLE_TTL_MS - 1000);
      expect(getAuthRun(run.id)).not.toBeNull();
      vi.advanceTimersByTime(AUTH_RUN_IDLE_TTL_MS - 1000);

      expect(getAuthRun(run.id)).not.toBeNull();
    });

    it('should not know an id the background never minted', () => {
      expect(getAuthRun('made-up-by-a-caller')).toBeNull();
    });
  });

  describe('credential owner', () => {
    it('should not erase a replacement captured between the decision and the removal', async () => {
      const judged = jwt(3600, 'old');
      await storeCredential(judged);
      const replacement = jwt(3600, 'new');

      // The replacement is queued first; the removal of the judged token runs
      // after it, compares, and leaves storage alone.
      const capture = storeObservedPlanMyPeakAuth({
        token: replacement,
        apiKey: null,
        timestamp: Date.now(),
        senderOrigin: PORTAL,
      });
      const removal = removePlanMyPeakCredentialIf(judged, 'rejected');
      await Promise.all([capture, removal]);

      expect(await removal).toBe(false);
      expect(await storedToken()).toBe(replacement);
    });

    it('should not let a late rejection clear a newer credential', async () => {
      await storeCredential(jwt(3600, 'newer'));

      expect(
        await removePlanMyPeakCredentialIf(jwt(3600, 'older'), '401')
      ).toBe(false);
      expect(await storedToken()).toBeDefined();
    });

    it('should remove the credential that was actually rejected', async () => {
      const rejected = jwt(3600);
      await storeCredential(rejected);

      expect(await removePlanMyPeakCredentialIf(rejected, '401')).toBe(true);
      expect(await storedToken()).toBeUndefined();
    });

    it('should apply the same rule to a freshness-driven removal', async () => {
      await storeCredential(jwt(-60));
      const replacement = jwt(3600);
      const capture = storeObservedPlanMyPeakAuth({
        token: replacement,
        apiKey: null,
        timestamp: Date.now(),
        senderOrigin: PORTAL,
      });
      const removal = removePlanMyPeakCredentialIfStale();
      await Promise.all([capture, removal]);

      expect(await removal).toBe(false);
      expect(await storedToken()).toBe(replacement);
    });

    it('should remove a stale credential nobody replaced', async () => {
      await storeCredential(jwt(-60));

      expect(await removePlanMyPeakCredentialIfStale()).toBe(true);
      expect(await storedToken()).toBeUndefined();
    });

    it('should refuse a capture from a confirmed inactive environment', async () => {
      const production = jwt(3600, 'production');
      await storeCredential(production);

      expect(
        await storeObservedPlanMyPeakAuth({
          token: jwt(3600, 'staging'),
          apiKey: null,
          timestamp: Date.now(),
          senderOrigin: STAGING,
        })
      ).toBe('refused');
      expect(await storedToken()).toBe(production);
    });

    it('should record an unmapped origin as unknown', async () => {
      await storeObservedPlanMyPeakAuth({
        token: jwt(3600),
        apiKey: null,
        timestamp: Date.now(),
        senderOrigin: 'https://example.com',
      });

      const data = await chrome.storage.local.get([
        STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT,
      ]);
      expect(data[STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT]).toBe('unknown');
    });
  });
});

/**
 * Latching records a failed recovery, which starts the secondary cooldown.
 * Tests that exercise an unrelated run right after need it cleared without
 * forgetting the latched run itself.
 */
function resetCooldown(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + 60_000);
}

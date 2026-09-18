import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlanMyPeakCoach } from '@/background/api/planMyPeak';
import {
  backfillCachedCaptureCoach,
  listImportCandidates,
  publishCaptureCoachCache,
  readCaptureCoachCache,
  storeCapture,
  withCapturedWorkoutsLock,
  type CaptureCoachCache,
} from '@/services/capturedWorkoutService';
import {
  refreshCaptureCoachIfDue,
  resetCaptureCoachEnrichment,
  resumeCaptureCoachEnrichment,
  CAPTURE_COACH_REFRESH_TIMEOUT_MS,
} from '@/services/captureCoachRefreshService';
import {
  resolvePlanMyPeakCoachId,
  resetPlanMyPeakIdentityCache,
} from '@/services/planMyPeakIdentityService';
import { STORAGE_KEYS } from '@/utils/constants';
import {
  capturedRecord,
  seedRecords,
  storedRecord,
  OWNER,
} from '../background/capturedImports/fixtures';

const cache: CaptureCoachCache = { version: 1, ...OWNER, verifiedAt: 123 };
const capture = {
  type: 'WORKOUT_CAPTURED' as const,
  kind: 'create' as const,
  athleteId: 1,
  workoutId: 2,
  timestamp: 100,
  request: {
    title: 'Example workout',
    workoutDay: '2026-09-18',
    workoutTypeValueId: 2,
  },
  response: { workoutId: 2 },
};
function profileResponse(id = 'coach-new'): Response {
  return { ok: true, status: 200, json: async () => ({ id }) } as Response;
}

describe('durable capture coach metadata', () => {
  beforeEach(async () => {
    resetPlanMyPeakIdentityCache();
    resetCaptureCoachEnrichment();
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('persists without tokens, annotates new captures, but cannot authorize the current coach', async () => {
    await publishCaptureCoachCache(cache, async () => true);
    resetPlanMyPeakIdentityCache();
    expect(await resolvePlanMyPeakCoachId()).toBeNull();
    const stored = await storeCapture(capture, 'production');
    expect(stored?.owner).toEqual(OWNER);
    expect(await readCaptureCoachCache()).toEqual(cache);
  });

  it('keeps a cold-start unowned capture eligible before any cache or backfill', async () => {
    const stored = await storeCapture(capture, 'production');
    expect(stored?.owner).toBeUndefined();
    expect(await readCaptureCoachCache()).toBeNull();
    expect(
      (await listImportCandidates(OWNER)).map((record) => record.key)
    ).toEqual([stored?.key]);
  });

  it('serializes cache publication with capture and preserves previous annotations and outcomes', async () => {
    const previous = capturedRecord(1, {
      status: 'sent',
      lastSendError: 'previous',
      owner: { ...OWNER, coachId: 'older' },
    });
    await seedRecords([previous]);
    await Promise.all([
      storeCapture(capture, 'production'),
      publishCaptureCoachCache(cache, async () => true),
    ]);
    expect((await storedRecord('production:1:2'))?.owner).toEqual(OWNER);
    expect(await storedRecord(previous.key)).toEqual(previous);
  });

  it('resumes interrupted enrichment from durable storage without reviving dismissed records', async () => {
    const previous = capturedRecord(1, {
      owner: undefined,
      status: 'dismissed',
    });
    await seedRecords([previous]);
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURE_COACH_CACHE]: cache,
    });
    await backfillCachedCaptureCoach();
    await backfillCachedCaptureCoach();
    expect(await storedRecord(previous.key)).toEqual({
      ...previous,
      owner: OWNER,
    });
  });

  it('treats a corrupt cache as missing and still saves the workout', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURE_COACH_CACHE]: { version: 99 },
    });
    expect((await storeCapture(capture, 'production'))?.owner).toBeUndefined();
  });

  it('consumes a normal successful coach API response and automatically enriches legacy captures', async () => {
    await seedRecords([capturedRecord(1, { owner: undefined })]);
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    const fetch = vi.fn().mockResolvedValue(profileResponse());
    vi.stubGlobal('fetch', fetch);
    expect((await fetchPlanMyPeakCoach()).success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await readCaptureCoachCache()).toMatchObject({
      coachId: 'coach-new',
      destination: OWNER.destination,
    });
    expect((await storedRecord('production:1:1'))?.owner?.coachId).toBe(
      'coach-new'
    );
  });

  it.each(['token', 'destination'])(
    'discards a profile if its %s changed in flight',
    async (changed) => {
      await publishCaptureCoachCache(cache, async () => true);
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          await chrome.storage.local.set(
            changed === 'token'
              ? { [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'replacement-token' }
              : { [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'staging' }
          );
          return profileResponse();
        })
      );
      expect((await fetchPlanMyPeakCoach()).success).toBe(true);
      expect(await readCaptureCoachCache()).toEqual(cache);
    }
  );

  it('does not fail a valid profile response when metadata storage fails', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(
      new Error('storage unavailable')
    );
    expect(await fetchPlanMyPeakCoach()).toMatchObject({
      success: true,
      data: { id: 'coach-new' },
    });
  });

  it('coalesces and persistently throttles opportunities, with an immediate attempt for a new token', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    const fetch = vi.fn().mockResolvedValue(profileResponse());
    vi.stubGlobal('fetch', fetch);
    await Promise.all([
      refreshCaptureCoachIfDue(),
      refreshCaptureCoachIfDue(),
      refreshCaptureCoachIfDue(),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await refreshCaptureCoachIfDue();
    expect(fetch).toHaveBeenCalledTimes(1);
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'new-token',
    });
    await refreshCaptureCoachIfDue();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('bounds a hanging profile request and ignores its late result', async () => {
    vi.useFakeTimers();
    await publishCaptureCoachCache(cache, async () => true);
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', fetch);
    const refresh = refreshCaptureCoachIfDue();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(CAPTURE_COACH_REFRESH_TIMEOUT_MS);
    await refresh;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    finish(profileResponse());
    await vi.advanceTimersByTimeAsync(0);
    expect(await readCaptureCoachCache()).toEqual(cache);
  });

  it('keeps cached identity after a rejection and does not attempt refresh with no token', async () => {
    await publishCaptureCoachCache(cache, async () => true);
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch);
    await refreshCaptureCoachIfDue();
    expect(fetch).not.toHaveBeenCalled();
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    await refreshCaptureCoachIfDue();
    expect(await readCaptureCoachCache()).toEqual(cache);
  });

  it('runs start-up enrichment once per worker: backfill first, then one due refresh', async () => {
    await seedRecords([capturedRecord(1, { owner: undefined })]);
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURE_COACH_CACHE]: cache,
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    const fetch = vi.fn().mockResolvedValue(profileResponse(OWNER.coachId));
    vi.stubGlobal('fetch', fetch);

    const first = resumeCaptureCoachEnrichment();
    expect(resumeCaptureCoachEnrichment()).toBe(first);
    await first;

    expect((await storedRecord('production:1:1'))?.owner).toEqual(OWNER);
    expect(fetch).toHaveBeenCalledTimes(1);
    await resumeCaptureCoachEnrichment();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never rejects start-up enrichment when storage fails', async () => {
    const get = chrome.storage.local.get;
    chrome.storage.local.get = vi
      .fn()
      .mockRejectedValue(new Error('storage unavailable'));
    try {
      await expect(resumeCaptureCoachEnrichment()).resolves.toBeUndefined();
    } finally {
      chrome.storage.local.get = get;
    }
  });

  it('holds a profile response behind a busy capture lock without losing either write', async () => {
    await seedRecords([capturedRecord(1, { owner: undefined })]);
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'test-token',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));

    let release!: () => void;
    const busy = withCapturedWorkoutsLock(
      () => new Promise<void>((resolve) => (release = resolve))
    );
    let settled = false;
    const lookup = fetchPlanMyPeakCoach().then((result) => {
      settled = true;
      return result;
    });
    const captured = storeCapture(capture, 'production');

    // Publication waits for the lock, so the profile response does too: this
    // is the latency coupling, pinned so a change to it is deliberate.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    release();
    await busy;
    expect((await lookup).success).toBe(true);
    await captured;
    expect((await storedRecord('production:1:1'))?.owner?.coachId).toBe(
      'coach-new'
    );
    expect((await storedRecord('production:1:2'))?.owner?.coachId).toBe(
      'coach-new'
    );
  });
});

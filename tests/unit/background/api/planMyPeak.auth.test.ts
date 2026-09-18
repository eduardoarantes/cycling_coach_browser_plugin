/**
 * The API client's credential policy: passive requests never recover, a run
 * retries a rejected request exactly once, and removal is left to the
 * credential owner.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportWorkoutsToPlanMyPeakLibrary,
  fetchPlanMyPeakLibraries,
} from '@/background/api/planMyPeak';
import {
  beginAuthRun,
  resetPlanMyPeakAuthRecovery,
} from '@/background/api/planMyPeakAuthRecovery';
import * as credentialOwner from '@/background/api/planMyPeakCredential';
import { refreshProviderAuth } from '@/services/authRefreshService';
import { STORAGE_KEYS } from '@/utils/constants';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';

vi.mock('@/services/authRefreshService', () => ({
  refreshProviderAuth: vi.fn(),
}));

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

async function storeCredential(token: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: token,
    [STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP]: Date.now(),
    [STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT]: 'production',
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const LIBRARIES = { data: [] };

function bearerOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit;
  return new Headers(init.headers).get('authorization');
}

function makeWorkout(id: string): PlanMyPeakWorkout {
  return {
    id: `tp-${id}`,
    name: `Workout ${id}`,
    detailed_description: '',
    sport_type: 'cycling',
    discipline: 'bike',
    type: 'endurance',
    intensity: 'easy',
    suitable_phases: [],
    suitable_weekdays: null,
    structure: {
      primaryIntensityMetric: 'percentOfFtp',
      primaryLengthMetric: 'duration',
      structure: [],
    },
    base_duration_min: 60,
    base_tss: 50,
    variable_components: null,
    source_file: `workout_${id}.json`,
    source_format: 'json',
    signature: id,
    provider_workout_id: id,
    provider_item_type: 'WorkoutTemplate',
    source_id: `TP:${id}`,
  } as PlanMyPeakWorkout;
}

describe('PlanMyPeak API credential policy', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
    });
    resetPlanMyPeakAuthRecovery();
    vi.mocked(refreshProviderAuth).mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.restoreAllMocks();
  });

  it('should not send a passive request with an expired credential', async () => {
    await storeCredential(jwt(-60, 'expired'));

    const result = await fetchPlanMyPeakLibraries();

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NO_TOKEN' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshProviderAuth).not.toHaveBeenCalled();
  });

  it('should not retry or recover a passive request that is rejected', async () => {
    const stale = jwt(3600, 'stale');
    await storeCredential(stale);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));

    const result = await fetchPlanMyPeakLibraries();

    // The failure can reach a page through a page-driven import.
    expect(JSON.stringify(result)).not.toContain(stale);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED', status: 401 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshProviderAuth).not.toHaveBeenCalled();
  });

  it('should defer removal of a rejected credential to the owner', async () => {
    const rejected = jwt(3600, 'stale');
    await storeCredential(rejected);
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const removeIf = vi.spyOn(credentialOwner, 'removePlanMyPeakCredentialIf');

    await fetchPlanMyPeakLibraries();

    expect(removeIf).toHaveBeenCalledWith(rejected, expect.any(String));
  });

  it('should recover once and retry with the new credential inside a run', async () => {
    const rejected = jwt(3600, 'stale');
    const fresh = jwt(3600, 'fresh');
    await storeCredential(rejected);
    vi.mocked(refreshProviderAuth).mockImplementation(async () => {
      await storeCredential(fresh);
      return { outcome: 'refreshed' };
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, LIBRARIES));

    const result = await fetchPlanMyPeakLibraries({ run: beginAuthRun() });

    expect(result).toEqual({ success: true, data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bearerOf(fetchMock.mock.calls[1])).toBe(`Bearer ${fresh}`);
  });

  it('should retry at most once and latch the run when the captured credential is rejected too', async () => {
    await storeCredential(jwt(3600, 'stale'));
    let captures = 0;
    vi.mocked(refreshProviderAuth).mockImplementation(async () => {
      captures += 1;
      await storeCredential(jwt(3600, `fresh-${captures}`));
      return { outcome: 'refreshed' };
    });
    fetchMock.mockImplementation(async () => jsonResponse(401, {}));
    const run = beginAuthRun();

    const first = await fetchPlanMyPeakLibraries({ run });

    expect(first).toMatchObject({ success: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Latched: a later request in the same run neither refreshes nor sends.
    fetchMock.mockClear();
    const second = await fetchPlanMyPeakLibraries({ run });

    expect(second).toMatchObject({
      success: false,
      error: { code: 'NO_TOKEN' },
    });
    expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should recover before sending when the stored credential is already expired', async () => {
    await storeCredential(jwt(-60, 'expired'));
    const fresh = jwt(3600, 'fresh');
    vi.mocked(refreshProviderAuth).mockImplementation(async () => {
      await storeCredential(fresh);
      return { outcome: 'refreshed' };
    });
    fetchMock.mockResolvedValue(jsonResponse(200, LIBRARIES));

    const result = await fetchPlanMyPeakLibraries({ run: beginAuthRun() });

    expect(result).toEqual({ success: true, data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe(`Bearer ${fresh}`);
  });

  it('should not recover a second time when a credential recovered before sending is rejected', async () => {
    await storeCredential(jwt(-60, 'expired'));
    let captures = 0;
    vi.mocked(refreshProviderAuth).mockImplementation(async () => {
      captures += 1;
      await storeCredential(jwt(3600, `fresh-${captures}`));
      return { outcome: 'refreshed' };
    });
    fetchMock.mockImplementation(async () => jsonResponse(401, {}));
    const run = beginAuthRun();

    const result = await fetchPlanMyPeakLibraries({ run });

    expect(result).toMatchObject({ success: false });
    expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // And the run is latched: nothing further is sent or refreshed.
    fetchMock.mockClear();
    await fetchPlanMyPeakLibraries({ run });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
  });

  it('should not let a credential captured elsewhere resume a terminal run', async () => {
    await storeCredential(jwt(-60, 'expired'));
    vi.mocked(refreshProviderAuth).mockResolvedValue({
      outcome: 'sign_in_required',
    });
    const run = beginAuthRun();
    await fetchPlanMyPeakLibraries({ run });

    // The coach signs in in another tab; the page's request is captured.
    await storeCredential(jwt(3600, 'captured-elsewhere'));
    fetchMock.mockResolvedValue(jsonResponse(200, LIBRARIES));

    const result = await fetchPlanMyPeakLibraries({ run });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NO_TOKEN' },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // A fresh run, as an explicit retry starts, uses the new credential.
    expect(await fetchPlanMyPeakLibraries({ run: beginAuthRun() })).toEqual({
      success: true,
      data: [],
    });
  });

  it('should replay a JSON body exactly once after recovering', async () => {
    await storeCredential(jwt(3600, 'stale'));
    vi.mocked(refreshProviderAuth).mockImplementation(async () => {
      await storeCredential(jwt(3600, 'fresh'));
      return { outcome: 'refreshed' };
    });
    fetchMock.mockImplementation(async () => jsonResponse(401, {}));

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout('1')], 'lib-1', {
      trackProgress: false,
      auth: { run: beginAuthRun() },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should stop a thirty-workout batch after the first auth failure and open at most one tab', async () => {
    await storeCredential(jwt(-60, 'expired'));
    vi.mocked(refreshProviderAuth).mockResolvedValue({
      outcome: 'sign_in_required',
    });
    const workouts = Array.from({ length: 30 }, (_, i) =>
      makeWorkout(String(i + 1))
    );

    const result = await exportWorkoutsToPlanMyPeakLibrary(workouts, 'lib-1', {
      trackProgress: false,
      auth: { run: beginAuthRun() },
    });

    expect(refreshProviderAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.failures).toHaveLength(30);
      expect(result.data.failures.every((f) => f.code === 'NO_TOKEN')).toBe(
        true
      );
    }
  });

  it('should carry the auth code on every failure after five successes', async () => {
    await storeCredential(jwt(3600, 'good'));
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls += 1;
      if (calls <= 5) {
        return jsonResponse(201, {
          id: `w-${calls}`,
          name: `Workout ${calls}`,
          description: null,
          workoutType: 'bike',
          rideType: 'endurance',
          summary: {
            segmentCount: 0,
            stepCount: 0,
            estimatedDurationSeconds: 3600,
          },
          profile: null,
          library: { id: 'lib-1', name: 'Lib' },
          provider: 'training_peaks',
          providerWorkoutId: String(calls),
          providerMetadata: {},
          providerIntensityFactor: null,
          providerTss: null,
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z',
        });
      }
      return jsonResponse(401, {});
    });
    const workouts = Array.from({ length: 8 }, (_, i) =>
      makeWorkout(String(i + 1))
    );

    const result = await exportWorkoutsToPlanMyPeakLibrary(workouts, 'lib-1', {
      trackProgress: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.failures).toHaveLength(3);
      expect(result.data.failures.every((f) => f.code === 'UNAUTHORIZED')).toBe(
        true
      );
    }
    // One rejected POST; the rest stop without reaching the network.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

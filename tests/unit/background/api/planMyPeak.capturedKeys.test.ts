/**
 * The upload loop writes each captured workout's outcome to its record as it
 * goes, so a popup that closes mid-send loses nothing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportWorkoutsToPlanMyPeakLibrary,
  isTotalUploadFailure,
} from '@/background/api/planMyPeak';
import {
  listCapturedWorkouts,
  storeCapture,
} from '@/services/capturedWorkoutService';
import {
  primePlanMyPeakIdentity,
  resetPlanMyPeakIdentityCache,
} from '@/services/planMyPeakIdentityService';
import { acknowledgementFor } from '@/schemas/capturedWorkout.schema';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import type { WorkoutCapturedMessage } from '@/types';
import { STORAGE_KEYS } from '@/utils/constants';

const TARGET_LIBRARY_ID = '472318eb-c402-43e5-b556-004a5e5ecd73';

function makeWorkout(
  overrides: Partial<PlanMyPeakWorkout> = {}
): PlanMyPeakWorkout {
  return {
    id: 'tp-123',
    name: 'Intervals',
    detailed_description: null,
    sport_type: 'cycling',
    discipline: 'bike',
    type: 'interval',
    intensity: 'hard',
    suitable_phases: [],
    suitable_weekdays: null,
    structure: {
      primaryIntensityMetric: 'percentOfFtp',
      primaryLengthMetric: 'duration',
      structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Work',
              intensityClass: 'active',
              length: { unit: 'second', value: 300 },
              openDuration: null,
              targets: [
                {
                  type: 'power',
                  minValue: 90,
                  maxValue: 95,
                  unit: 'percentOfFtp',
                },
              ],
            },
          ],
        },
      ],
    },
    base_duration_min: 60,
    base_tss: 50,
    variable_components: null,
    source_file: 'workout_cal_1.json',
    source_format: 'json',
    signature: 'sig',
    provider_workout_id: 'cal:1',
    provider_item_type: 'Workout',
    provider_intensity_factor: 0.75,
    provider_tss: 50,
    ...overrides,
  };
}

function createdWorkoutResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w-1',
    name: 'Intervals',
    description: null,
    workoutType: 'bike',
    rideType: 'interval',
    summary: { segmentCount: 1, stepCount: 1, estimatedDurationSeconds: 300 },
    profile: null,
    library: { id: TARGET_LIBRARY_ID, name: 'My Library' },
    provider: 'training_peaks',
    providerWorkoutId: 'cal:1',
    providerMetadata: {},
    providerIntensityFactor: null,
    providerTss: null,
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

function capture(workoutId: number): WorkoutCapturedMessage {
  const body = {
    athleteId: 1,
    workoutId,
    title: 'Intervals',
    workoutDay: '2026-09-20T00:00:00',
    workoutTypeValueId: 2,
  };
  return {
    type: 'WORKOUT_CAPTURED',
    kind: 'create',
    athleteId: 1,
    workoutId,
    request: { ...body, workoutId: 0 },
    response: body,
    timestamp: 1000 + workoutId,
  };
}

function okResponse(id: string, providerWorkoutId: string): Response {
  return {
    ok: true,
    status: 201,
    json: async () => createdWorkoutResponse({ id, providerWorkoutId }),
  } as Response;
}

function failResponse(message: string): Response {
  return {
    ok: false,
    status: 400,
    json: async () => ({ message }),
  } as Response;
}

async function recordByKey(key: string) {
  const { records } = await listCapturedWorkouts();
  return records.find((record) => record.key === key);
}

describe('exportWorkoutsToPlanMyPeakLibrary with capturedKeys', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
    await storeCapture(capture(1), 'production');
    await storeCapture(capture(2), 'production');
    resetPlanMyPeakIdentityCache();
  });

  it('writes each outcome before the next upload starts', async () => {
    const seenAtSecondUpload: string[] = [];
    global.fetch = vi
      .fn()
      .mockImplementationOnce(async () => okResponse('w-1', 'cal:1'))
      .mockImplementationOnce(async () => {
        const first = await recordByKey('production:1:1');
        seenAtSecondUpload.push(first?.status ?? 'missing');
        return okResponse('w-2', 'cal:2');
      });

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({ provider_workout_id: 'cal:1' }),
        makeWorkout({ provider_workout_id: 'cal:2' }),
      ],
      TARGET_LIBRARY_ID,
      {
        capturedKeys: {
          'cal:1': 'production:1:1',
          'cal:2': 'production:1:2',
        },
      }
    );

    expect(result.success).toBe(true);
    expect(seenAtSecondUpload).toEqual(['sent']);
  });

  it('records success and failure on their own records', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse('w-1', 'cal:1'))
      .mockResolvedValueOnce(failResponse('name too long'));

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({ provider_workout_id: 'cal:1' }),
        makeWorkout({ provider_workout_id: 'cal:2', name: 'Intervals' }),
      ],
      TARGET_LIBRARY_ID,
      {
        capturedKeys: {
          'cal:1': 'production:1:1',
          'cal:2': 'production:1:2',
        },
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const sent = await recordByKey('production:1:1');
    expect(sent).toMatchObject({
      status: 'sent',
      planMyPeakWorkoutId: 'w-1',
      planMyPeakLibraryName: 'My Library',
    });
    expect(typeof sent?.sentAt).toBe('number');

    const failed = await recordByKey('production:1:2');
    expect(failed).toMatchObject({
      status: 'pending',
      lastSendError: 'name too long',
    });

    // Identically named workouts are told apart by provider id.
    expect(result.data.failures).toEqual([
      {
        providerWorkoutId: 'cal:2',
        name: 'Intervals',
        message: 'name too long',
      },
    ]);
  });

  it('touches no record when the message carries no capturedKeys', async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse('w-1', 'cal:1'));

    await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ provider_workout_id: 'cal:1' })],
      TARGET_LIBRARY_ID
    );

    expect((await recordByKey('production:1:1'))?.status).toBe('pending');
    expect(await recordByKey('production:1:1')).not.toHaveProperty(
      'lastSendError'
    );
  });

  it('touches only the keyed records', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse('w-1', 'cal:1'))
      .mockResolvedValueOnce(okResponse('w-9', '9'));

    await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({ provider_workout_id: 'cal:1' }),
        makeWorkout({ provider_workout_id: '9' }),
      ],
      TARGET_LIBRARY_ID,
      { capturedKeys: { 'cal:1': 'production:1:1' } }
    );

    expect((await recordByKey('production:1:1'))?.status).toBe('sent');
    expect((await recordByKey('production:1:2'))?.status).toBe('pending');
  });

  it('returns success with an empty result list and every keyed failure when all uploads fail', async () => {
    global.fetch = vi.fn().mockResolvedValue(failResponse('rejected'));

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({ provider_workout_id: 'cal:1', name: 'One' }),
        makeWorkout({ provider_workout_id: 'cal:2', name: 'Two' }),
      ],
      TARGET_LIBRARY_ID,
      {
        capturedKeys: {
          'cal:1': 'production:1:1',
          'cal:2': 'production:1:2',
        },
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.results).toEqual([]);
    expect(result.data.failures).toEqual([
      { providerWorkoutId: 'cal:1', name: 'One', message: 'rejected' },
      { providerWorkoutId: 'cal:2', name: 'Two', message: 'rejected' },
    ]);
    expect(isTotalUploadFailure(result.data)).toBe(true);
    expect((await recordByKey('production:1:1'))?.lastSendError).toBe(
      'rejected'
    );
    expect((await recordByKey('production:1:2'))?.lastSendError).toBe(
      'rejected'
    );
  });

  describe('onItemResult', () => {
    it('should report each workout right after its POST, in order', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(okResponse('w-1', 'cal:1'))
        .mockResolvedValueOnce(failResponse('rejected'));
      const onItemResult = vi.fn();

      await exportWorkoutsToPlanMyPeakLibrary(
        [
          makeWorkout({ provider_workout_id: 'cal:1', name: 'One' }),
          makeWorkout({ provider_workout_id: 'cal:2', name: 'Two' }),
        ],
        TARGET_LIBRARY_ID,
        { onItemResult }
      );

      expect(onItemResult.mock.calls.map(([result]) => result)).toEqual([
        {
          providerWorkoutId: 'cal:1',
          name: 'One',
          success: true,
          created: true,
        },
        {
          providerWorkoutId: 'cal:2',
          name: 'Two',
          success: false,
          error: 'rejected',
        },
      ]);
    });

    it('should wait for the callback before the next POST', async () => {
      const order: string[] = [];
      global.fetch = vi.fn().mockImplementation(async () => {
        order.push('post');
        return okResponse('w', 'cal:1');
      });

      await exportWorkoutsToPlanMyPeakLibrary(
        [
          makeWorkout({ provider_workout_id: 'cal:1' }),
          makeWorkout({ provider_workout_id: 'cal:2' }),
        ],
        TARGET_LIBRARY_ID,
        {
          onItemResult: async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            order.push('reported');
          },
        }
      );

      expect(order).toEqual(['post', 'reported', 'post', 'reported']);
    });
  });

  describe('shouldContinue', () => {
    it('should stop writing once refused and fail the rest with the reason', async () => {
      global.fetch = vi.fn().mockResolvedValue(okResponse('w-1', 'cal:1'));
      const shouldContinue = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: false, reason: 'account changed' });
      const onItemResult = vi.fn();

      const result = await exportWorkoutsToPlanMyPeakLibrary(
        [
          makeWorkout({ provider_workout_id: 'cal:1', name: 'One' }),
          makeWorkout({ provider_workout_id: 'cal:2', name: 'Two' }),
          makeWorkout({ provider_workout_id: 'cal:3', name: 'Three' }),
        ],
        TARGET_LIBRARY_ID,
        {
          capturedKeys: {
            'cal:1': 'production:1:1',
            'cal:2': 'production:1:2',
          },
          shouldContinue,
          onItemResult,
        }
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      // Asked again only until the first refusal.
      expect(shouldContinue).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.results).toHaveLength(1);
      expect(result.data.failures).toEqual([
        { providerWorkoutId: 'cal:2', name: 'Two', message: 'account changed' },
        {
          providerWorkoutId: 'cal:3',
          name: 'Three',
          message: 'account changed',
        },
      ]);
      expect(onItemResult).toHaveBeenCalledTimes(3);
      expect((await recordByKey('production:1:1'))?.status).toBe('sent');
      const stopped = await recordByKey('production:1:2');
      expect(stopped?.status).toBe('pending');
      expect(stopped?.lastSendError).toBe('account changed');
    });

    it('should write nothing when refused before the first POST', async () => {
      global.fetch = vi.fn();

      const result = await exportWorkoutsToPlanMyPeakLibrary(
        [makeWorkout({ provider_workout_id: 'cal:1' })],
        TARGET_LIBRARY_ID,
        { shouldContinue: async () => ({ ok: false, reason: 'stopped' }) }
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.success && isTotalUploadFailure(result.data)).toBe(true);
    });
  });

  describe('destination acknowledgement', () => {
    const owner = {
      coachId: 'coach-1',
      destination: 'https://portal.planmypeak.com',
    };

    beforeEach(async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
      });
    });

    it('should acknowledge a landed capture for the cached coach and destination', async () => {
      primePlanMyPeakIdentity('token-123', 'coach-1');
      global.fetch = vi.fn().mockResolvedValue(okResponse('w-1', 'cal:1'));

      await exportWorkoutsToPlanMyPeakLibrary(
        [makeWorkout({ provider_workout_id: 'cal:1' })],
        TARGET_LIBRARY_ID,
        { capturedKeys: { 'cal:1': 'production:1:1' } }
      );

      const record = await recordByKey('production:1:1');
      expect(record && acknowledgementFor(record, owner)).toMatchObject({
        reason: 'imported',
        planMyPeakWorkoutId: 'w-1',
        libraryName: 'My Library',
      });
    });

    it('should mark the capture sent without an acknowledgement, and without a lookup, when the coach is not cached', async () => {
      global.fetch = vi.fn().mockResolvedValue(okResponse('w-1', 'cal:1'));

      await exportWorkoutsToPlanMyPeakLibrary(
        [makeWorkout({ provider_workout_id: 'cal:1' })],
        TARGET_LIBRARY_ID,
        { capturedKeys: { 'cal:1': 'production:1:1' } }
      );

      const record = await recordByKey('production:1:1');
      expect(record?.status).toBe('sent');
      expect(record?.acknowledgements).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not use an identity cached for a different token', async () => {
      primePlanMyPeakIdentity('some-older-token', 'coach-1');
      global.fetch = vi.fn().mockResolvedValue(okResponse('w-1', 'cal:1'));

      await exportWorkoutsToPlanMyPeakLibrary(
        [makeWorkout({ provider_workout_id: 'cal:1' })],
        TARGET_LIBRARY_ID,
        { capturedKeys: { 'cal:1': 'production:1:1' } }
      );

      expect(
        (await recordByKey('production:1:1'))?.acknowledgements
      ).toBeUndefined();
    });
  });
});

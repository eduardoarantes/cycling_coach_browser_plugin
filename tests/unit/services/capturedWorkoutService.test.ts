import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildCapturedPayload,
  getPendingCapturedCount,
  listCapturedWorkouts,
  normalizeCapturedWorkout,
  removeCapturedWorkouts,
  storeCapture,
  updateCapturedWorkout,
  withCapturedWorkoutsLock,
} from '@/services/capturedWorkoutService';
import { CapturedWorkoutPayloadSchema } from '@/schemas/capturedWorkout.schema';
import { STORAGE_KEYS } from '@/utils/constants';
import type { WorkoutCapturedMessage } from '@/types';

const structure = {
  structure: [
    {
      type: 'step',
      length: { unit: 'second', value: 600 },
      steps: [
        {
          name: 'Warm up',
          length: { unit: 'second', value: 600 },
          targets: [{ minValue: 50, maxValue: 60 }],
          intensityClass: 'warmUp',
          openDuration: false,
        },
      ],
    },
  ],
  polyline: [
    [0, 0],
    [600, 55],
  ],
  primaryLengthMetric: 'duration',
  primaryIntensityMetric: 'percentOfFtp',
  primaryIntensityTargetOrRange: 'range',
};

function requestBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    athleteId: 4830660,
    workoutId: 0,
    title: 'Sweet Spot',
    workoutDay: '2026-09-20T00:00:00',
    workoutTypeValueId: 2,
    structure: JSON.stringify(structure),
    totalTimePlanned: 1.5,
    tssPlanned: 85,
    ifPlanned: 0.86,
    description: 'Ride steady',
    coachComments: 'Keep cadence high',
    userTags: null,
    ...overrides,
  };
}

function captureMessage(
  overrides: Partial<WorkoutCapturedMessage> & {
    responseOverrides?: Record<string, unknown>;
  } = {}
): WorkoutCapturedMessage {
  const { responseOverrides, ...rest } = overrides;
  const workoutId = rest.workoutId ?? 555;
  const request = requestBody();
  return {
    type: 'WORKOUT_CAPTURED',
    kind: 'create',
    athleteId: 4830660,
    workoutId,
    request,
    response: {
      ...request,
      workoutId,
      lastModifiedDate: '2026-09-17T10:00:00',
      personalRecordCount: 0,
      ...responseOverrides,
    },
    timestamp: 1_700_000_000_000,
    ...rest,
  };
}

async function storedMap(): Promise<Record<string, unknown>> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_WORKOUTS);
  return (
    (data[STORAGE_KEYS.CAPTURED_WORKOUTS] as Record<string, unknown>) ?? {}
  );
}

describe('capturedWorkoutService', () => {
  beforeEach(async () => {
    await chrome.storage.local.remove(STORAGE_KEYS.CAPTURED_WORKOUTS);
  });

  describe('normalization', () => {
    it('merges response over request and takes ids from the message', () => {
      const merged = buildCapturedPayload({
        athleteId: 1,
        workoutId: 9,
        request: { title: 'from request', workoutId: 0, tssPlanned: 10 },
        response: { title: 'from response', tssPlanned: null, extra: true },
      }) as Record<string, unknown>;

      expect(merged.title).toBe('from response');
      expect(merged.tssPlanned).toBe(10);
      expect(merged.workoutId).toBe(9);
      expect(merged.athleteId).toBe(1);
    });

    it('parses a structure string and drops the polyline', () => {
      const payload = CapturedWorkoutPayloadSchema.parse(
        buildCapturedPayload(captureMessage())
      );
      const workout = normalizeCapturedWorkout('create', payload);

      expect(workout.structure).not.toBeNull();
      expect(workout.structure).not.toHaveProperty('polyline');
      expect(workout.structure?.primaryIntensityMetric).toBe('percentOfFtp');
      expect(workout.structure?.structure).toHaveLength(1);
      expect(workout.lastModifiedDate).toBe('2026-09-17T10:00:00');
      expect(workout.coachComments).toBe('Keep cadence high');
    });

    it('stores a null structure when the string is not JSON', () => {
      const payload = CapturedWorkoutPayloadSchema.parse(
        buildCapturedPayload(
          captureMessage({ responseOverrides: { structure: '{broken' } })
        )
      );
      expect(normalizeCapturedWorkout('create', payload).structure).toBeNull();
    });
  });

  describe('storeCapture', () => {
    it('stores a new create as pending with the capture timestamp', async () => {
      const record = await storeCapture(captureMessage(), 'production');

      expect(record).not.toBeNull();
      expect(record).toMatchObject({
        key: 'production:4830660:555',
        athleteId: 4830660,
        workoutId: 555,
        environment: 'production',
        status: 'pending',
        capturedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });
      expect(record?.workout.title).toBe('Sweet Spot');
      expect(await storedMap()).toHaveProperty('production:4830660:555');
    });

    it('collapses a duplicate create and preserves its lifecycle', async () => {
      await storeCapture(captureMessage(), 'production');
      await updateCapturedWorkout('production:4830660:555', {
        status: 'sent',
        planMyPeakWorkoutId: 'pmp-1',
        sentAt: 1_700_000_005_000,
      });

      const again = await storeCapture(
        captureMessage({
          timestamp: 1_700_000_009_000,
          responseOverrides: { title: 'Sweet Spot v2' },
        }),
        'production'
      );

      expect(again).toMatchObject({
        status: 'sent',
        capturedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_009_000,
        sentAt: 1_700_000_005_000,
        planMyPeakWorkoutId: 'pmp-1',
      });
      expect(again?.workout.title).toBe('Sweet Spot v2');
      expect(Object.keys(await storedMap())).toHaveLength(1);
    });

    it('keeps production and sandbox captures of the same id as distinct records', async () => {
      await storeCapture(captureMessage(), 'production');
      await storeCapture(captureMessage(), 'sandbox');

      const map = await storedMap();
      expect(Object.keys(map).sort()).toEqual([
        'production:4830660:555',
        'sandbox:4830660:555',
      ]);

      await updateCapturedWorkout('production:4830660:555', { status: 'sent' });
      const { records } = await listCapturedWorkouts();
      expect(records.find((r) => r.key === 'sandbox:4830660:555')?.status).toBe(
        'pending'
      );
    });

    it('refreshes an existing record on update without changing status', async () => {
      await storeCapture(captureMessage(), 'production');
      await updateCapturedWorkout('production:4830660:555', {
        status: 'dismissed',
      });

      const refreshed = await storeCapture(
        captureMessage({
          kind: 'update',
          timestamp: 1_700_000_010_000,
          responseOverrides: { title: 'Edited', tssPlanned: 90 },
        }),
        'production'
      );

      expect(refreshed?.status).toBe('dismissed');
      expect(refreshed?.workout.title).toBe('Edited');
      expect(refreshed?.workout.tssPlanned).toBe(90);
      expect(refreshed?.updatedAt).toBe(1_700_000_010_000);
    });

    it('ignores an update for a workout that was never captured', async () => {
      const result = await storeCapture(
        captureMessage({ kind: 'update' }),
        'production'
      );

      expect(result).toBeNull();
      expect(await storedMap()).toEqual({});
    });

    it('rejects an invalid payload and stores nothing', async () => {
      const result = await storeCapture(
        captureMessage({
          request: { athleteId: 1 },
          response: { workoutId: 555 },
        }),
        'production'
      );

      expect(result).toBeNull();
      expect(await storedMap()).toEqual({});
    });

    it('stores as many records as are captured', async () => {
      for (let i = 0; i < 200; i++) {
        await storeCapture(
          captureMessage({ workoutId: 1000 + i }),
          'production'
        );
      }

      const { records, pendingCount } = await listCapturedWorkouts();
      expect(records).toHaveLength(200);
      expect(pendingCount).toBe(200);
    });
  });

  describe('updateCapturedWorkout', () => {
    beforeEach(async () => {
      await storeCapture(captureMessage(), 'production');
    });

    it('marks a record sent, stamps sentAt and clears the last error', async () => {
      await updateCapturedWorkout('production:4830660:555', {
        lastSendError: 'boom',
      });

      const sent = await updateCapturedWorkout('production:4830660:555', {
        status: 'sent',
        planMyPeakWorkoutId: 'pmp-9',
        planMyPeakLibraryName: 'My Library',
      });

      expect(sent).toMatchObject({
        status: 'sent',
        planMyPeakWorkoutId: 'pmp-9',
        planMyPeakLibraryName: 'My Library',
      });
      expect(typeof sent?.sentAt).toBe('number');
      expect(sent).not.toHaveProperty('lastSendError');
    });

    it('records a send error without changing status', async () => {
      const updated = await updateCapturedWorkout('production:4830660:555', {
        lastSendError: 'Upload failed',
      });

      expect(updated?.status).toBe('pending');
      expect(updated?.lastSendError).toBe('Upload failed');
    });

    it('dismisses a record', async () => {
      const updated = await updateCapturedWorkout('production:4830660:555', {
        status: 'dismissed',
      });

      expect(updated?.status).toBe('dismissed');
      expect(await getPendingCapturedCount()).toBe(0);
    });

    it('returns null for an unknown key', async () => {
      expect(
        await updateCapturedWorkout('production:0:0', { status: 'sent' })
      ).toBeNull();
    });
  });

  describe('removeCapturedWorkouts and counts', () => {
    it('removes finished records and keeps pending ones', async () => {
      await storeCapture(captureMessage({ workoutId: 1 }), 'production');
      await storeCapture(captureMessage({ workoutId: 2 }), 'production');
      await storeCapture(captureMessage({ workoutId: 3 }), 'production');
      await updateCapturedWorkout('production:4830660:1', { status: 'sent' });
      await updateCapturedWorkout('production:4830660:2', {
        status: 'dismissed',
      });

      const removed = await removeCapturedWorkouts(['sent', 'dismissed']);

      expect(removed).toBe(2);
      const { records, pendingCount } = await listCapturedWorkouts();
      expect(records.map((r) => r.key)).toEqual(['production:4830660:3']);
      expect(pendingCount).toBe(1);
    });

    it('lists newest first and counts only pending', async () => {
      await storeCapture(
        captureMessage({ workoutId: 1, timestamp: 100 }),
        'production'
      );
      await storeCapture(
        captureMessage({ workoutId: 2, timestamp: 300 }),
        'production'
      );
      await storeCapture(
        captureMessage({ workoutId: 3, timestamp: 200 }),
        'production'
      );
      await updateCapturedWorkout('production:4830660:2', { status: 'sent' });

      const { records, pendingCount } = await listCapturedWorkouts();
      expect(records.map((r) => r.workoutId)).toEqual([2, 3, 1]);
      expect(pendingCount).toBe(2);
      expect(await getPendingCapturedCount()).toBe(2);
    });

    it('skips malformed stored entries on read', async () => {
      await storeCapture(captureMessage(), 'production');
      const map = await storedMap();
      await chrome.storage.local.set({
        [STORAGE_KEYS.CAPTURED_WORKOUTS]: { ...map, junk: { key: 'junk' } },
      });

      const { records } = await listCapturedWorkouts();
      expect(records.map((r) => r.key)).toEqual(['production:4830660:555']);
    });
  });

  describe('serialized mutations', () => {
    /** Delay every storage read so an unserialized read-modify-write races. */
    function delayStorageReads(ms: number): void {
      const getMock = vi.mocked(chrome.storage.local.get);
      const original = getMock.getMockImplementation() as (
        ...args: unknown[]
      ) => Promise<unknown>;
      getMock.mockImplementation(
        (...args: unknown[]) =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(original(...args));
            }, ms);
          }) as never
      );
    }

    it('lands two captures for different keys started without awaiting', async () => {
      delayStorageReads(5);

      await Promise.all([
        storeCapture(captureMessage({ workoutId: 1 }), 'production'),
        storeCapture(captureMessage({ workoutId: 2 }), 'production'),
      ]);

      expect(Object.keys(await storedMap()).sort()).toEqual([
        'production:4830660:1',
        'production:4830660:2',
      ]);
    });

    it('loses neither a capture nor a status update that race', async () => {
      await storeCapture(captureMessage({ workoutId: 1 }), 'production');
      delayStorageReads(5);

      await Promise.all([
        storeCapture(captureMessage({ workoutId: 2 }), 'production'),
        updateCapturedWorkout('production:4830660:1', { status: 'sent' }),
      ]);

      const { records } = await listCapturedWorkouts();
      expect(records.map((r) => r.key).sort()).toEqual([
        'production:4830660:1',
        'production:4830660:2',
      ]);
      expect(
        records.find((r) => r.key === 'production:4830660:1')?.status
      ).toBe('sent');
    });

    it('runs queued work in order and keeps going after a failure', async () => {
      const order: string[] = [];
      const failing = withCapturedWorkoutsLock(async () => {
        order.push('first');
        throw new Error('nope');
      });
      const following = withCapturedWorkoutsLock(async () => {
        order.push('second');
        return 'ok';
      });

      await expect(failing).rejects.toThrow('nope');
      await expect(following).resolves.toBe('ok');
      expect(order).toEqual(['first', 'second']);
    });
  });
});

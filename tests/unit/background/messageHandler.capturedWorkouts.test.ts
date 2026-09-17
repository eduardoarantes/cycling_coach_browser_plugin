/**
 * Captured-workout routing in the background worker: the origin gate on
 * captures, and the list/update/remove messages the popup drives.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as badgeService from '@/services/badgeService';
import type {
  GetCapturedWorkoutsMessage,
  RemoveCapturedWorkoutsMessage,
  UpdateCapturedWorkoutMessage,
  WorkoutCapturedMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { CapturedWorkoutsListResult } from '@/types';
import { STORAGE_KEYS } from '@/utils/constants';

function tabSender(url: string): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    url,
    tab: { id: 7, url } as chrome.tabs.Tab,
  };
}

const popupSender: chrome.runtime.MessageSender = { id: 'test-extension-id' };

function capture(
  overrides: Partial<WorkoutCapturedMessage> = {}
): WorkoutCapturedMessage {
  const body = {
    athleteId: 4830660,
    workoutId: 555,
    title: 'Sweet Spot',
    workoutDay: '2026-09-20T00:00:00',
    workoutTypeValueId: 2,
    structure:
      '{"structure":[],"primaryLengthMetric":"duration","primaryIntensityMetric":"percentOfFtp","polyline":[[0,0]]}',
  };
  return {
    type: 'WORKOUT_CAPTURED',
    kind: 'create',
    athleteId: 4830660,
    workoutId: 555,
    request: { ...body, workoutId: 0 },
    response: body,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

async function storedMap(): Promise<Record<string, { environment: string }>> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_WORKOUTS);
  return (data[STORAGE_KEYS.CAPTURED_WORKOUTS] as never) ?? {};
}

async function list(): Promise<CapturedWorkoutsListResult> {
  const response = (await handleMessage(
    { type: 'GET_CAPTURED_WORKOUTS' } satisfies GetCapturedWorkoutsMessage,
    popupSender
  )) as ApiResponse<CapturedWorkoutsListResult>;
  if (!response.success) throw new Error('list failed');
  return response.data;
}

describe('messageHandler captured workouts', () => {
  let refreshBadge: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await chrome.storage.local.clear();
    vi.clearAllMocks();
    refreshBadge = vi
      .spyOn(badgeService, 'refreshBadge')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WORKOUT_CAPTURED origin gate', () => {
    it('rejects a capture from the popup (no tab)', async () => {
      const result = await handleMessage(capture(), popupSender);

      expect(result).toMatchObject({ success: false });
      expect(await storedMap()).toEqual({});
      expect(refreshBadge).not.toHaveBeenCalled();
    });

    it('rejects a capture from a foreign tab', async () => {
      const result = await handleMessage(
        capture(),
        tabSender('https://portal.planmypeak.com/dashboard')
      );

      expect(result).toMatchObject({ success: false });
      expect(await storedMap()).toEqual({});
    });

    it('rejects a lookalike TrainingPeaks origin', async () => {
      const result = await handleMessage(
        capture(),
        tabSender('https://app.trainingpeaks.com.evil.test/calendar')
      );

      expect(result).toMatchObject({ success: false });
      expect(await storedMap()).toEqual({});
    });

    it('accepts a capture from the production app and tags it production', async () => {
      const result = await handleMessage(
        capture(),
        tabSender('https://app.trainingpeaks.com/#calendar')
      );

      expect(result).toEqual({ success: true });
      const map = await storedMap();
      expect(Object.keys(map)).toEqual(['production:4830660:555']);
      expect(map['production:4830660:555'].environment).toBe('production');
      expect(refreshBadge).toHaveBeenCalledTimes(1);
    });

    it('accepts a capture from the sandbox app and tags it sandbox', async () => {
      const result = await handleMessage(
        capture(),
        tabSender('https://app.sandbox.trainingpeaks.com/#calendar')
      );

      expect(result).toEqual({ success: true });
      expect(Object.keys(await storedMap())).toEqual(['sandbox:4830660:555']);
    });

    it('falls back to the tab URL when sender.url is absent', async () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        tab: {
          id: 7,
          url: 'https://app.trainingpeaks.com/',
        } as chrome.tabs.Tab,
      };

      const result = await handleMessage(capture(), sender);

      expect(result).toEqual({ success: true });
    });

    it('rejects an invalid payload from a trusted tab', async () => {
      const result = await handleMessage(
        capture({ request: { athleteId: 1 }, response: { workoutId: 555 } }),
        tabSender('https://app.trainingpeaks.com/')
      );

      expect(result).toMatchObject({ success: false });
      expect(await storedMap()).toEqual({});
      expect(refreshBadge).not.toHaveBeenCalled();
    });
  });

  describe('popup-driven lifecycle', () => {
    const tp = tabSender('https://app.trainingpeaks.com/');

    beforeEach(async () => {
      await handleMessage(capture({ workoutId: 1, timestamp: 100 }), tp);
      await handleMessage(capture({ workoutId: 2, timestamp: 200 }), tp);
      refreshBadge.mockClear();
    });

    it('lists records newest first with the pending count', async () => {
      const data = await list();

      expect(data.records.map((r) => r.workoutId)).toEqual([2, 1]);
      expect(data.pendingCount).toBe(2);
      expect(refreshBadge).not.toHaveBeenCalled();
    });

    it('updates a record and refreshes the badge', async () => {
      const message: UpdateCapturedWorkoutMessage = {
        type: 'UPDATE_CAPTURED_WORKOUT',
        key: 'production:4830660:1',
        status: 'sent',
        planMyPeakWorkoutId: 'pmp-1',
        planMyPeakLibraryName: 'My Library',
      };

      const result = (await handleMessage(
        message,
        popupSender
      )) as ApiResponse<{
        status: string;
      } | null>;

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data?.status).toBe('sent');
      expect(refreshBadge).toHaveBeenCalledTimes(1);
      expect((await list()).pendingCount).toBe(1);
    });

    it('records a send error through the update message', async () => {
      await handleMessage(
        {
          type: 'UPDATE_CAPTURED_WORKOUT',
          key: 'production:4830660:1',
          lastSendError: 'Upload failed',
        } satisfies UpdateCapturedWorkoutMessage,
        popupSender
      );

      const data = await list();
      const record = data.records.find((r) => r.workoutId === 1);
      expect(record?.status).toBe('pending');
      expect(record?.lastSendError).toBe('Upload failed');
    });

    it('removes finished records and refreshes the badge', async () => {
      await handleMessage(
        {
          type: 'UPDATE_CAPTURED_WORKOUT',
          key: 'production:4830660:2',
          status: 'dismissed',
        } satisfies UpdateCapturedWorkoutMessage,
        popupSender
      );
      refreshBadge.mockClear();

      const result = (await handleMessage(
        {
          type: 'REMOVE_CAPTURED_WORKOUTS',
          statuses: ['sent', 'dismissed'],
        } satisfies RemoveCapturedWorkoutsMessage,
        popupSender
      )) as ApiResponse<{ removed: number }>;

      expect(result).toEqual({ success: true, data: { removed: 1 } });
      expect(refreshBadge).toHaveBeenCalledTimes(1);
      expect((await list()).records.map((r) => r.workoutId)).toEqual([1]);
    });

    it('refreshes a captured workout on an edit without changing its status', async () => {
      await handleMessage(
        {
          type: 'UPDATE_CAPTURED_WORKOUT',
          key: 'production:4830660:1',
          status: 'dismissed',
        } satisfies UpdateCapturedWorkoutMessage,
        popupSender
      );

      await handleMessage(
        capture({
          kind: 'update',
          workoutId: 1,
          timestamp: 900,
          response: {
            athleteId: 4830660,
            workoutId: 1,
            title: 'Edited',
            workoutDay: '2026-09-21T00:00:00',
            workoutTypeValueId: 3,
          },
        }),
        tp
      );

      const record = (await list()).records.find((r) => r.workoutId === 1);
      expect(record?.status).toBe('dismissed');
      expect(record?.workout.title).toBe('Edited');
      expect(record?.updatedAt).toBe(900);
    });
  });
});

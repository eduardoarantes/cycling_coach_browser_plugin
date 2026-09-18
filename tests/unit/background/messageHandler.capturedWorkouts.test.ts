/**
 * Captured-workout routing in the background worker: the origin gate on
 * captures, and the list/update/remove messages the popup drives.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as badgeService from '@/services/badgeService';
import * as identityService from '@/services/planMyPeakIdentityService';
import * as coachRefresh from '@/services/captureCoachRefreshService';
import * as planMyPeakApi from '@/background/api/planMyPeak';
import {
  markOperationLive,
  resetLiveOperations,
} from '@/background/capturedImports/importOperations';
import {
  isPopupCapturedSendInFlight,
  resetPopupCapturedSend,
} from '@/background/capturedImports/importRunner';
import type {
  ClaimCapturedWorkoutsMessage,
  ClaimCapturedWorkoutsResult,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetCapturedWorkoutsMessage,
  RemoveCapturedWorkoutsMessage,
  UpdateCapturedWorkoutMessage,
  WorkoutCapturedMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { CapturedWorkoutsListResult } from '@/types';
import { STORAGE_KEYS } from '@/utils/constants';
import { capturedRecord, seedRecords } from './capturedImports/fixtures';

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
    identityService.resetPlanMyPeakIdentityCache();
    coachRefresh.resetCaptureCoachEnrichment();
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

  describe('ownership at capture time', () => {
    const tp = tabSender('https://app.trainingpeaks.com/calendar');
    const context: identityService.CaptureContext = {
      coachId: 'coach-1',
      destination: 'https://portal.planmypeak.com',
      environment: 'production',
      contextId: 'ctx-a',
    };

    it('persists and updates the badge before a coach refresh finishes', async () => {
      let finish!: () => void;
      const refresh = vi
        .spyOn(coachRefresh, 'refreshCaptureCoachIfDue')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            })
        );
      const handling = handleMessage(capture(), tp);
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect((await list()).pendingCount).toBe(1);
      expect(refreshBadge).toHaveBeenCalledOnce();
      finish();
      expect(await handling).toEqual({ success: true });
    });

    it('should stamp from the durable coach even with no tokens and no popup', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.CAPTURE_COACH_CACHE]: {
          version: 1,
          coachId: context.coachId,
          destination: context.destination,
          verifiedAt: 1,
        },
      });
      const lookup = vi.spyOn(identityService, 'resolveCaptureContext');
      await handleMessage(capture(), tp);
      expect(lookup).not.toHaveBeenCalled();

      const [record] = (await list()).records;
      expect(record.owner).toEqual({
        coachId: 'coach-1',
        destination: 'https://portal.planmypeak.com',
      });
    });

    it("finishes this worker's start-up enrichment inside the capture event", async () => {
      await seedRecords([capturedRecord(1, { owner: undefined })]);
      await chrome.storage.local.set({
        [STORAGE_KEYS.CAPTURE_COACH_CACHE]: {
          version: 1,
          coachId: context.coachId,
          destination: context.destination,
          verifiedAt: 1,
        },
      });

      expect(await handleMessage(capture(), tp)).toEqual({ success: true });

      // The legacy record was enriched by the start-up backfill the handler
      // awaited, not by anything the test ran afterwards.
      expect((await list()).records.map((record) => record.owner)).toEqual([
        { coachId: 'coach-1', destination: 'https://portal.planmypeak.com' },
        { coachId: 'coach-1', destination: 'https://portal.planmypeak.com' },
      ]);
    });

    it('should ignore an owner supplied in the message', async () => {
      vi.spyOn(identityService, 'resolveCaptureContext').mockResolvedValue(
        null
      );

      await handleMessage(
        {
          ...capture(),
          owner: { coachId: 'coach-9', destination: 'https://evil.test' },
        } as WorkoutCapturedMessage,
        tp
      );

      const result = await list();
      expect(result.records[0]).not.toHaveProperty('owner');
      expect(result.unlinkedCount).toBe(1);
    });

    it('should still store the capture when the account cannot be resolved', async () => {
      vi.spyOn(identityService, 'resolveCaptureContext').mockResolvedValue(
        null
      );

      const response = await handleMessage(capture(), tp);

      expect(response).toMatchObject({ success: true });
      expect((await list()).records).toHaveLength(1);
    });
  });

  describe('CLAIM_CAPTURED_WORKOUTS', () => {
    const claim: ClaimCapturedWorkoutsMessage = {
      type: 'CLAIM_CAPTURED_WORKOUTS',
    };
    const tp = tabSender('https://app.trainingpeaks.com/calendar');

    beforeEach(async () => {
      vi.spyOn(identityService, 'resolveCaptureContext').mockResolvedValue(
        null
      );
      await handleMessage(capture({ workoutId: 1 }), tp);
      await handleMessage(capture({ workoutId: 2 }), tp);
    });

    it('should link unowned captures to the verified session from the popup', async () => {
      vi.spyOn(identityService, 'resolveCaptureContext').mockResolvedValue({
        coachId: 'coach-1',
        destination: 'https://portal.planmypeak.com',
        environment: 'production',
        contextId: 'ctx-a',
      });

      const response = (await handleMessage(
        claim,
        popupSender
      )) as ApiResponse<ClaimCapturedWorkoutsResult>;

      expect(response).toEqual({ success: true, data: { claimed: 2 } });
      const result = await list();
      expect(result.unlinkedCount).toBe(0);
      expect(result.records.every((r) => r.owner?.coachId === 'coach-1')).toBe(
        true
      );
    });

    it.each([
      ['a TrainingPeaks tab', 'https://app.trainingpeaks.com/calendar'],
      ['a PlanMyPeak tab', 'https://portal.planmypeak.com/workout-library'],
    ])('should refuse a claim from %s', async (_label, url) => {
      vi.spyOn(identityService, 'resolveCaptureContext').mockResolvedValue({
        coachId: 'coach-1',
        destination: 'https://portal.planmypeak.com',
        environment: 'production',
        contextId: 'ctx-a',
      });

      const response = await handleMessage(claim, tabSender(url));

      expect(response).toMatchObject({ success: false });
      expect((await list()).unlinkedCount).toBe(2);
    });

    it('should link nothing when the session cannot be verified', async () => {
      const response = await handleMessage(claim, popupSender);

      expect(response).toMatchObject({
        success: false,
        error: { code: 'NO_TOKEN' },
      });
      expect((await list()).unlinkedCount).toBe(2);
    });
  });

  describe('GET_PLANMYPEAK_COACH identity priming', () => {
    beforeEach(async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-a',
      });
    });

    it('should prime the identity cache for the token the lookup ran under', async () => {
      vi.spyOn(planMyPeakApi, 'fetchPlanMyPeakCoach').mockResolvedValue({
        success: true,
        data: { id: 'coach-a' } as never,
      });

      await handleMessage({ type: 'GET_PLANMYPEAK_COACH' }, popupSender);

      expect(await identityService.peekPlanMyPeakCoachId()).toBe('coach-a');
    });

    it('should not bind coach A to token B when the session changes mid-request', async () => {
      vi.spyOn(planMyPeakApi, 'fetchPlanMyPeakCoach').mockImplementation(
        async () => {
          await chrome.storage.local.set({
            [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-b',
          });
          return { success: true, data: { id: 'coach-a' } as never };
        }
      );

      await handleMessage({ type: 'GET_PLANMYPEAK_COACH' }, popupSender);

      expect(await identityService.peekPlanMyPeakCoachId()).toBeNull();
    });
  });

  describe('one captured-workout import at a time', () => {
    const exportMessage = (
      capturedKeys?: Record<string, string>
    ): ExportWorkoutsToPlanMyPeakLibraryMessage => ({
      type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
      workouts: [],
      libraryId: 'lib-1',
      ...(capturedKeys ? { capturedKeys } : {}),
    });

    let upload: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      resetLiveOperations();
      resetPopupCapturedSend();
      upload = vi
        .spyOn(planMyPeakApi, 'exportWorkoutsToPlanMyPeakLibrary')
        .mockResolvedValue({
          success: true,
          data: {
            results: [],
            createdCount: 0,
            updatedCount: 0,
            destinationEmpty: false,
            failures: [],
          },
        });
    });

    afterEach(() => {
      resetLiveOperations();
      resetPopupCapturedSend();
    });

    it('should refuse a popup send of captures while a page import is running', async () => {
      markOperationLive('op-1');

      const response = await handleMessage(
        exportMessage({ 'cal:1': 'production:1:1' }),
        popupSender
      );

      expect(response).toMatchObject({
        success: false,
        error: { code: 'IMPORT_IN_PROGRESS' },
      });
      expect(upload).not.toHaveBeenCalled();
    });

    it('should not hold up an ordinary library export', async () => {
      markOperationLive('op-1');

      const response = await handleMessage(exportMessage(), popupSender);

      expect(response).toMatchObject({ success: true });
      expect(upload).toHaveBeenCalledTimes(1);
    });

    it('should register a popup send of captures for the page import to wait on', async () => {
      let inFlightDuringUpload = false;
      upload.mockImplementation(async () => {
        await Promise.resolve();
        inFlightDuringUpload = isPopupCapturedSendInFlight();
        return {
          success: true,
          data: {
            results: [],
            createdCount: 0,
            updatedCount: 0,
            destinationEmpty: false,
            failures: [],
          },
        };
      });

      await handleMessage(
        exportMessage({ 'cal:1': 'production:1:1' }),
        popupSender
      );
      await Promise.resolve();

      expect(inFlightDuringUpload).toBe(true);
      expect(isPopupCapturedSendInFlight()).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as planMyPeakApi from '@/background/api/planMyPeak';
import * as trainingPeaksApi from '@/background/api/trainingPeaks';
import * as contextGuard from '@/background/capturedImports/contextGuard';
import * as badgeService from '@/services/badgeService';
import {
  SUMMARY_RECONCILE_BUDGET_MS,
  handleCapturedWorkoutImportStatus,
  handleCapturedWorkoutSummary,
  handleImportMissingWorkouts,
  isSiteControlCapturedImportActive,
} from '@/background/capturedImports/siteControlHandlers';
import {
  capturedReconciler,
  resetPopupCapturedSend,
  trackPopupCapturedSend,
} from '@/background/capturedImports/importRunner';
import {
  findOperation,
  getContextOperations,
  hasLiveOperation,
  markOperationLive,
  resetLiveOperations,
  saveOperation,
  type CapturedImportOperation,
} from '@/background/capturedImports/importOperations';
import { acknowledgementFor } from '@/schemas/capturedWorkout.schema';
import { TRAINING_PEAKS_PROVIDER_CODE } from '@/schemas/planMyPeakApi.schema';
import type { CaptureContext } from '@/services/planMyPeakIdentityService';
import type {
  SiteControlCapturedWorkoutImportStatusResult,
  SiteControlCapturedWorkoutSummaryResult,
  SiteControlImportMissingWorkoutsResult,
  SiteControlResponse,
} from '@/types/siteControl.types';
import {
  COACH_ID,
  DESTINATION,
  OWNER,
  capturedRecord,
  defaultLibrary,
  fakeUploadLoop,
  remoteWorkout,
  seedRecords,
  storedRecord,
} from './fixtures';

vi.mock('@/background/api/planMyPeak', async (importOriginal) => {
  const actual = await importOriginal<typeof planMyPeakApi>();
  return {
    ...actual,
    fetchPlanMyPeakLibraries: vi.fn(),
    fetchPlanMyPeakWorkoutByProviderId: vi.fn(),
    fetchPlanMyPeakCoach: vi.fn(),
    exportWorkoutsToPlanMyPeakLibrary: vi.fn(),
  };
});

vi.mock('@/background/api/trainingPeaks', async (importOriginal) => {
  const actual = await importOriginal<typeof trainingPeaksApi>();
  return { ...actual, fetchUser: vi.fn() };
});

const api = vi.mocked(planMyPeakApi);
const tpApi = vi.mocked(trainingPeaksApi);

const CONTEXT_ID = 'ctx-a';
const context: CaptureContext = {
  ...OWNER,
  environment: 'production',
  contextId: CONTEXT_ID,
};

function data<T>(response: SiteControlResponse): T {
  if (!response.ok) {
    throw new Error(`expected ok, got ${response.error.code}`);
  }
  return response.data as T;
}

async function waitForIdle(): Promise<void> {
  for (let i = 0; i < 200 && hasLiveOperation(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  expect(hasLiveOperation()).toBe(false);
}

function finishedOperation(
  overrides: Partial<CapturedImportOperation> = {}
): CapturedImportOperation {
  return {
    operationId: 'op-1',
    contextId: CONTEXT_ID,
    coachId: COACH_ID,
    destination: DESTINATION,
    state: 'completed',
    startedAt: 1,
    updatedAt: 2,
    totalCount: 1,
    processedCount: 1,
    importedCount: 1,
    alreadyPresentCount: 0,
    failedCount: 0,
    errors: [],
    recordKeys: ['production:1:1'],
    ...overrides,
  };
}

describe('captured-import site-control handlers', () => {
  let resolveRequestContext: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await chrome.storage.local.clear();
    resetLiveOperations();
    resetPopupCapturedSend();
    capturedReconciler.invalidate();

    vi.spyOn(badgeService, 'refreshBadge').mockResolvedValue(undefined);
    resolveRequestContext = vi
      .spyOn(contextGuard, 'resolveRequestContext')
      .mockResolvedValue({ ok: true, context });
    vi.spyOn(contextGuard, 'verifyOperationContext').mockResolvedValue({
      ok: true,
    });

    api.fetchPlanMyPeakLibraries.mockResolvedValue({
      success: true,
      data: [defaultLibrary],
    });
    api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
      success: true,
      data: null,
    });
    api.exportWorkoutsToPlanMyPeakLibrary.mockImplementation(fakeUploadLoop());
    api.fetchPlanMyPeakCoach.mockResolvedValue({
      success: true,
      data: {
        id: COACH_ID,
        externalIds: [
          { providerCode: TRAINING_PEAKS_PROVIDER_CODE, externalId: '100' },
        ],
      } as never,
    });
    tpApi.fetchUser.mockResolvedValue({
      success: true,
      data: { userId: 100 } as never,
    });
  });

  afterEach(async () => {
    await waitForIdle();
    vi.useRealTimers();
  });

  describe('GET_CAPTURED_WORKOUT_SUMMARY', () => {
    it.each([
      'connection_disabled',
      'signed_out',
      'account_unknown',
      'destination_mismatch',
    ] as const)(
      'should answer blocked (%s) with no context and no count',
      async (reason) => {
        await seedRecords([capturedRecord(1)]);
        resolveRequestContext.mockResolvedValue({
          ok: false,
          reason,
          coachId: reason === 'destination_mismatch' ? COACH_ID : null,
        });

        const summary = data<SiteControlCapturedWorkoutSummaryResult>(
          await handleCapturedWorkoutSummary('r1', DESTINATION)
        );

        expect(summary).toMatchObject({
          state: 'blocked',
          blockedReason: reason,
          contextId: null,
          missingCount: null,
          activeOperation: null,
          latestOperation: null,
        });
        expect(api.fetchPlanMyPeakWorkoutByProviderId).not.toHaveBeenCalled();
      }
    );

    it('should pass the verified sender origin to the guard', async () => {
      await handleCapturedWorkoutSummary('r1', 'https://example.test');

      expect(resolveRequestContext).toHaveBeenCalledWith(
        'https://example.test'
      );
    });

    it('should answer ready with zero and no lookups when there are no candidates', async () => {
      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary).toMatchObject({
        contextId: CONTEXT_ID,
        coachId: COACH_ID,
        state: 'ready',
        missingCount: 0,
        unlinkedCount: 0,
      });
      expect(api.fetchPlanMyPeakWorkoutByProviderId).not.toHaveBeenCalled();
    });

    it('should count only undismissed captures owned by this coach and unacknowledged here', async () => {
      await seedRecords([
        capturedRecord(1),
        capturedRecord(2, {
          status: 'sent',
          acknowledgements: {
            [`${DESTINATION}::${COACH_ID}`]: {
              ...OWNER,
              reason: 'imported',
              at: 1,
            },
          },
        }),
        capturedRecord(3, { status: 'dismissed' }),
        capturedRecord(4, { owner: { ...OWNER, coachId: 'coach-2' } }),
        capturedRecord(5, {
          owner: {
            ...OWNER,
            destination: 'https://staging.app.planmypeak.com',
          },
        }),
        capturedRecord(6, { owner: undefined }),
      ]);

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary.missingCount).toBe(1);
      expect(summary.unlinkedCount).toBe(1);
      expect(api.fetchPlanMyPeakWorkoutByProviderId).toHaveBeenCalledTimes(1);
      expect(api.fetchPlanMyPeakWorkoutByProviderId).toHaveBeenCalledWith(
        'cal:1'
      );
    });

    it('should carry counts and handles only, never a capture', async () => {
      await seedRecords([capturedRecord(1)]);

      const response = await handleCapturedWorkoutSummary('r1', DESTINATION);

      expect(Object.keys(data<object>(response)).sort()).toEqual(
        [
          'activeOperation',
          'coachId',
          'contextId',
          'latestOperation',
          'missingCount',
          'revision',
          'state',
          'unlinkedCount',
        ].sort()
      );
      const serialized = JSON.stringify(response);
      expect(serialized).not.toContain('Intervals 1');
      expect(serialized).not.toContain('production:1:1');
    });

    it('should acknowledge an identity found there so it leaves the count for good', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockImplementation(async (id) => ({
        success: true,
        data: id === 'cal:1' ? remoteWorkout('cal:1') : null,
      }));

      const first = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(first.missingCount).toBe(1);
      const present = await storedRecord('production:1:1');
      expect(present?.status).toBe('sent');
      expect(present && acknowledgementFor(present, OWNER)?.reason).toBe(
        'already_present'
      );

      const second = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r2', DESTINATION)
      );
      expect(second.missingCount).toBe(1);
      expect(second.revision).toBeGreaterThan(first.revision - 1);
    });

    it('should answer blocked and acknowledge nothing when the session changed during the scan', async () => {
      await seedRecords([capturedRecord(1)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockImplementation(async () => {
        // Coach 2 signs in while the lookup is in flight; it answers from
        // coach 2's library.
        resolveRequestContext.mockResolvedValue({
          ok: true,
          context: { ...context, coachId: 'coach-2', contextId: 'ctx-b' },
        });
        return { success: true, data: remoteWorkout('cal:1') };
      });

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary).toMatchObject({
        state: 'blocked',
        blockedReason: 'account_changed',
        missingCount: null,
      });
      const record = await storedRecord('production:1:1');
      expect(record?.status).toBe('pending');
      expect(record?.acknowledgements).toBeUndefined();
    });

    it('should count a capture sent to another destination as missing here', async () => {
      await seedRecords([
        capturedRecord(1, {
          status: 'sent',
          acknowledgements: {
            'https://staging.app.planmypeak.com::coach-1': {
              coachId: COACH_ID,
              destination: 'https://staging.app.planmypeak.com',
              reason: 'imported',
              at: 1,
            },
          },
        }),
      ]);

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary).toMatchObject({ state: 'ready', missingCount: 1 });
    });

    it('should report the revision after its own acknowledgement writes', async () => {
      await seedRecords([capturedRecord(1)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
        success: true,
        data: remoteWorkout('cal:1'),
      });

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary.missingCount).toBe(0);
      expect(summary.revision).toBe(1);
    });

    it('should answer an error, never zero, when a lookup fails', async () => {
      await seedRecords([capturedRecord(1)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
        success: false,
        error: { message: 'HTTP 503' },
      });

      const response = await handleCapturedWorkoutSummary('r1', DESTINATION);

      expect(response.ok).toBe(false);
      expect(response).toMatchObject({
        error: { code: 'API_ERROR' },
      });
    });

    it('should bound a lookup failure before it reaches the page', async () => {
      await seedRecords([capturedRecord(1)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
        success: false,
        error: { message: 'x'.repeat(5000) },
      });

      const response = await handleCapturedWorkoutSummary('r1', DESTINATION);

      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.message.length).toBeLessThan(400);
      }
    });

    it('should answer checking when reconciliation outlasts the budget, then ready from its cache', async () => {
      vi.useFakeTimers();
      await seedRecords([capturedRecord(1)]);
      let finishLookup: () => void = () => undefined;
      api.fetchPlanMyPeakWorkoutByProviderId.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishLookup = () => resolve({ success: true, data: null });
          })
      );

      const pending = handleCapturedWorkoutSummary('r1', DESTINATION);
      await vi.advanceTimersByTimeAsync(SUMMARY_RECONCILE_BUDGET_MS);
      const checking = data<SiteControlCapturedWorkoutSummaryResult>(
        await pending
      );

      expect(checking).toMatchObject({ state: 'checking', missingCount: null });

      finishLookup();
      await vi.advanceTimersByTimeAsync(0);
      const ready = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r2', DESTINATION)
      );

      expect(ready).toMatchObject({ state: 'ready', missingCount: 1 });
      expect(api.fetchPlanMyPeakWorkoutByProviderId).toHaveBeenCalledTimes(1);
    });

    it('should name the latest finished operation for the context', async () => {
      await saveOperation(finishedOperation());

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary.activeOperation).toBeNull();
      expect(summary.latestOperation).toEqual({
        operationId: 'op-1',
        state: 'completed',
      });
    });

    it('should report a run that died with a previous worker as interrupted, not active', async () => {
      await saveOperation(finishedOperation({ state: 'running' }));

      const summary = data<SiteControlCapturedWorkoutSummaryResult>(
        await handleCapturedWorkoutSummary('r1', DESTINATION)
      );

      expect(summary.activeOperation).toBeNull();
      expect(summary.latestOperation).toEqual({
        operationId: 'op-1',
        state: 'interrupted',
      });
    });
  });

  describe('IMPORT_MISSING_WORKOUTS', () => {
    const payload = { contextId: CONTEXT_ID, operationId: 'op-1' };

    it('should acknowledge at once and import in the background', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack).toEqual({ operationId: 'op-1', state: 'running' });
      await waitForIdle();
      expect(await findOperation(CONTEXT_ID, 'op-1')).toMatchObject({
        state: 'completed',
        totalCount: 2,
        importedCount: 2,
      });
    });

    it('should complete immediately when there is nothing to import', async () => {
      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack).toEqual({ operationId: 'op-1', state: 'completed' });
      expect(hasLiveOperation()).toBe(false);
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it.each([
      'connection_disabled',
      'signed_out',
      'account_unknown',
      'destination_mismatch',
    ] as const)('should refuse as blocked (%s)', async (reason) => {
      await seedRecords([capturedRecord(1)]);
      resolveRequestContext.mockResolvedValue({
        ok: false,
        reason,
        coachId: null,
      });

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack).toEqual({
        operationId: 'op-1',
        state: 'blocked',
        blockedReason: reason,
      });
      expect(await findOperation(CONTEXT_ID, 'op-1')).toBeNull();
    });

    it('should refuse a context id the extension no longer resolves to', async () => {
      await seedRecords([capturedRecord(1)]);

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts(
          'r1',
          { contextId: 'ctx-previous-coach', operationId: 'op-1' },
          DESTINATION
        )
      );

      expect(ack).toMatchObject({
        state: 'blocked',
        blockedReason: 'stale_context',
      });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should refuse on production when the linked TrainingPeaks account differs', async () => {
      await seedRecords([capturedRecord(1)]);
      tpApi.fetchUser.mockResolvedValue({
        success: true,
        data: { userId: 999 } as never,
      });

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack).toMatchObject({
        state: 'blocked',
        blockedReason: 'account_mismatch',
      });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should not block when the TrainingPeaks side is unknown', async () => {
      await seedRecords([capturedRecord(1)]);
      tpApi.fetchUser.mockResolvedValue({
        success: false,
        error: { message: 'no token' },
      });

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack.state).toBe('running');
    });

    it('should not compare accounts outside production', async () => {
      await seedRecords([capturedRecord(1)]);
      resolveRequestContext.mockResolvedValue({
        ok: true,
        context: { ...context, environment: 'staging' },
      });
      tpApi.fetchUser.mockResolvedValue({
        success: true,
        data: { userId: 999 } as never,
      });

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack.state).toBe('running');
      expect(tpApi.fetchUser).not.toHaveBeenCalled();
    });

    it('should name the same finished run when its id is repeated', async () => {
      await seedRecords([capturedRecord(1)]);
      await handleImportMissingWorkouts('r1', payload, DESTINATION);
      await waitForIdle();
      await seedRecords([capturedRecord(1), capturedRecord(2)]);

      const again = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r2', payload, DESTINATION)
      );

      expect(again).toEqual({ operationId: 'op-1', state: 'completed' });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).toHaveBeenCalledTimes(1);
    });

    it('should attach a second start to the run that is already live', async () => {
      await seedRecords([capturedRecord(1)]);
      await saveOperation(finishedOperation({ state: 'running' }));
      markOperationLive('op-1');

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts(
          'r1',
          { contextId: CONTEXT_ID, operationId: 'op-2' },
          DESTINATION
        )
      );

      expect(ack).toEqual({ operationId: 'op-1', state: 'running' });
      expect(await findOperation(CONTEXT_ID, 'op-2')).toBeNull();
      resetLiveOperations();
    });

    it('should run one import when two starts arrive together', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);

      const [a, b] = await Promise.all([
        handleImportMissingWorkouts(
          'r1',
          { contextId: CONTEXT_ID, operationId: 'op-a' },
          DESTINATION
        ),
        handleImportMissingWorkouts(
          'r2',
          { contextId: CONTEXT_ID, operationId: 'op-b' },
          DESTINATION
        ),
      ]);
      await waitForIdle();

      const acks = [a, b].map((response) =>
        data<SiteControlImportMissingWorkoutsResult>(response)
      );
      expect(new Set(acks.map((ack) => ack.operationId)).size).toBe(1);
      expect(api.exportWorkoutsToPlanMyPeakLibrary).toHaveBeenCalledTimes(1);
      const { active, latest } = await getContextOperations(CONTEXT_ID);
      expect(active).toBeNull();
      expect(latest?.state).toBe('completed');
    });

    it('should retry an interrupted run under its own id', async () => {
      await seedRecords([capturedRecord(1)]);
      await saveOperation(finishedOperation({ state: 'interrupted' }));

      const ack = data<SiteControlImportMissingWorkoutsResult>(
        await handleImportMissingWorkouts('r1', payload, DESTINATION)
      );

      expect(ack).toEqual({ operationId: 'op-1', state: 'running' });
      await waitForIdle();
      expect((await findOperation(CONTEXT_ID, 'op-1'))?.state).toBe(
        'completed'
      );
    });
  });

  describe('GET_CAPTURED_WORKOUT_IMPORT_STATUS', () => {
    const payload = { contextId: CONTEXT_ID, operationId: 'op-1' };

    it('should report the persisted progress of a known operation', async () => {
      await saveOperation(
        finishedOperation({
          failedCount: 1,
          errors: [{ title: 'Intervals 1', message: 'HTTP 422' }],
        })
      );

      const status = data<SiteControlCapturedWorkoutImportStatusResult>(
        await handleCapturedWorkoutImportStatus('r1', payload, DESTINATION)
      );

      expect(status).toMatchObject({
        operationId: 'op-1',
        contextId: CONTEXT_ID,
        state: 'completed',
        importedCount: 1,
        failedCount: 1,
        errors: [{ title: 'Intervals 1', message: 'HTTP 422' }],
      });
      expect(status).not.toHaveProperty('recordKeys');
      expect(status).not.toHaveProperty('coachId');
    });

    it('should report a run with no live loop as interrupted', async () => {
      await saveOperation(finishedOperation({ state: 'running' }));

      const status = data<SiteControlCapturedWorkoutImportStatusResult>(
        await handleCapturedWorkoutImportStatus('r1', payload, DESTINATION)
      );

      expect(status.state).toBe('interrupted');
    });

    it('should answer AUTH_REQUIRED when signed out', async () => {
      resolveRequestContext.mockResolvedValue({
        ok: false,
        reason: 'signed_out',
        coachId: null,
      });

      const response = await handleCapturedWorkoutImportStatus(
        'r1',
        payload,
        DESTINATION
      );

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('should refuse to describe another context to this one', async () => {
      await saveOperation(finishedOperation({ contextId: 'ctx-other' }));

      const response = await handleCapturedWorkoutImportStatus(
        'r1',
        { contextId: 'ctx-other', operationId: 'op-1' },
        DESTINATION
      );

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'INVALID_REQUEST' },
      });
    });

    it('should answer INVALID_REQUEST for an unknown operation', async () => {
      const response = await handleCapturedWorkoutImportStatus(
        'r1',
        payload,
        DESTINATION
      );

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unknown import operation.',
        },
      });
    });
  });

  describe('isSiteControlCapturedImportActive', () => {
    it('should be true while a page import or a popup send is running', async () => {
      expect(await isSiteControlCapturedImportActive()).toBe(false);

      markOperationLive('op-1');
      expect(await isSiteControlCapturedImportActive()).toBe(true);
      resetLiveOperations();

      let finish: () => void = () => undefined;
      void trackPopupCapturedSend(
        new Promise<void>((resolve) => {
          finish = resolve;
        })
      );
      expect(await isSiteControlCapturedImportActive()).toBe(true);
      finish();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as planMyPeakApi from '@/background/api/planMyPeak';
import * as contextGuard from '@/background/capturedImports/contextGuard';
import * as badgeService from '@/services/badgeService';
import {
  MAX_ERROR_MESSAGE_LENGTH,
  isPopupCapturedSendInFlight,
  resetPopupCapturedSend,
  runCapturedImport,
  safeErrorMessage,
  toReconcileCandidate,
  trackPopupCapturedSend,
} from '@/background/capturedImports/importRunner';
import {
  findOperation,
  isOperationLive,
  resetLiveOperations,
  type CapturedImportOperation,
} from '@/background/capturedImports/importOperations';
import { CapturedWorkoutReconciler } from '@/background/capturedImports/reconciler';
import { acknowledgementFor } from '@/schemas/capturedWorkout.schema';
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
    exportWorkoutsToPlanMyPeakLibrary: vi.fn(),
  };
});

const api = vi.mocked(planMyPeakApi);

function operation(
  recordKeys: string[],
  overrides: Partial<CapturedImportOperation> = {}
): CapturedImportOperation {
  return {
    operationId: 'op-1',
    contextId: 'ctx-a',
    coachId: COACH_ID,
    destination: DESTINATION,
    state: 'running',
    startedAt: 1000,
    updatedAt: 1000,
    totalCount: recordKeys.length,
    processedCount: 0,
    importedCount: 0,
    alreadyPresentCount: 0,
    failedCount: 0,
    errors: [],
    recordKeys,
    ...overrides,
  };
}

/** A reconciler of its own per test, so no answer leaks between them. */
function reconciler(): CapturedWorkoutReconciler {
  return new CapturedWorkoutReconciler({
    lookup: planMyPeakApi.fetchPlanMyPeakWorkoutByProviderId,
  });
}

function expectCountsToAddUp(result: CapturedImportOperation): void {
  expect(
    result.importedCount + result.alreadyPresentCount + result.failedCount
  ).toBe(result.processedCount);
  expect(result.processedCount).toBeLessThanOrEqual(result.totalCount);
}

describe('importRunner', () => {
  let verifyOperationContext: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await chrome.storage.local.clear();
    resetLiveOperations();
    resetPopupCapturedSend();

    vi.spyOn(badgeService, 'refreshBadge').mockResolvedValue(undefined);
    verifyOperationContext = vi
      .spyOn(contextGuard, 'verifyOperationContext')
      .mockResolvedValue({ ok: true });

    api.fetchPlanMyPeakLibraries.mockResolvedValue({
      success: true,
      data: [defaultLibrary],
    });
    api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
      success: true,
      data: null,
    });
    api.exportWorkoutsToPlanMyPeakLibrary.mockImplementation(fakeUploadLoop());
  });

  describe('safeErrorMessage', () => {
    it('should pass a short message through trimmed', () => {
      expect(safeErrorMessage('  HTTP 422  ')).toBe('HTTP 422');
    });

    it('should cap a long message at the bound', () => {
      const capped = safeErrorMessage('x'.repeat(1000));

      expect(capped).toHaveLength(MAX_ERROR_MESSAGE_LENGTH);
      expect(capped.endsWith('…')).toBe(true);
    });

    it.each([undefined, '', '   '])(
      'should fall back to generic text for %j',
      (message) => {
        expect(safeErrorMessage(message)).toBe(
          'Could not import this workout.'
        );
      }
    );
  });

  describe('toReconcileCandidate', () => {
    it('should name the identity the transformer will mint, per environment', () => {
      expect(toReconcileCandidate(capturedRecord(7))).toEqual({
        key: 'production:1:7',
        providerWorkoutId: 'cal:7',
        updatedAt: 7,
      });
      expect(
        toReconcileCandidate(capturedRecord(7, { environment: 'sandbox' }))
          .providerWorkoutId
      ).toBe('cal-sandbox:7');
    });
  });

  describe('runCapturedImport', () => {
    it('should upload the missing workouts and complete', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        processedCount: 2,
        importedCount: 2,
        alreadyPresentCount: 0,
        failedCount: 0,
        errors: [],
      });
      const [workouts, libraryId, options] =
        api.exportWorkoutsToPlanMyPeakLibrary.mock.calls[0];
      expect(workouts.map((w) => w.provider_workout_id)).toEqual([
        'cal:1',
        'cal:2',
      ]);
      expect(libraryId).toBe(defaultLibrary.id);
      expect(options?.capturedKeys).toEqual({
        'cal:1': 'production:1:1',
        'cal:2': 'production:1:2',
      });
    });

    it('should not touch the popup export progress slot', async () => {
      await seedRecords([capturedRecord(1)]);

      await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(
        api.exportWorkoutsToPlanMyPeakLibrary.mock.calls[0][2]?.trackProgress
      ).toBe(false);
    });

    it('should acknowledge an identity already there and never upload it', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockImplementation(async (id) => ({
        success: true,
        data: id === 'cal:1' ? remoteWorkout('cal:1') : null,
      }));

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        importedCount: 1,
        alreadyPresentCount: 1,
        failedCount: 0,
      });
      const uploaded = api.exportWorkoutsToPlanMyPeakLibrary.mock.calls[0][0];
      expect(uploaded.map((w) => w.provider_workout_id)).toEqual(['cal:2']);

      const present = await storedRecord('production:1:1');
      expect(present?.status).toBe('sent');
      expect(present?.planMyPeakWorkoutId).toBe('pmp-cal:1');
      expect(present && acknowledgementFor(present, OWNER)).toMatchObject({
        reason: 'already_present',
        planMyPeakWorkoutId: 'pmp-cal:1',
        libraryName: 'My Library',
      });
    });

    it('should not upload at all when everything is already there', async () => {
      await seedRecords([capturedRecord(1)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
        success: true,
        data: remoteWorkout('cal:1'),
      });

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(result).toMatchObject({
        state: 'completed',
        alreadyPresentCount: 1,
      });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should fail a workout whose existence could not be checked, without uploading it', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);
      api.fetchPlanMyPeakWorkoutByProviderId.mockImplementation(async (id) =>
        id === 'cal:1'
          ? { success: false, error: { message: 'HTTP 503' } }
          : { success: true, data: null }
      );

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        importedCount: 1,
        failedCount: 1,
      });
      expect(result.errors).toEqual([
        {
          title: 'Intervals 1',
          message:
            'Could not check whether this workout already exists: HTTP 503',
        },
      ]);
      const uploaded = api.exportWorkoutsToPlanMyPeakLibrary.mock.calls[0][0];
      expect(uploaded.map((w) => w.provider_workout_id)).toEqual(['cal:2']);
    });

    it('should report a failed POST against its workout and carry on', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);
      api.exportWorkoutsToPlanMyPeakLibrary.mockImplementation(
        fakeUploadLoop({ 'cal:1': 'Validation failed: name too long' })
      );

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        importedCount: 1,
        failedCount: 1,
      });
      expect(result.errors).toEqual([
        { title: 'Intervals 1', message: 'Validation failed: name too long' },
      ]);
      expectCountsToAddUp(result);
    });

    it('should cap an API error before it is kept for the page', async () => {
      await seedRecords([capturedRecord(1)]);
      api.exportWorkoutsToPlanMyPeakLibrary.mockImplementation(
        fakeUploadLoop({ 'cal:1': 'e'.repeat(5000) })
      );

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(result.errors[0].message).toHaveLength(MAX_ERROR_MESSAGE_LENGTH);
    });

    it('should count records that changed since the page asked, without uploading them', async () => {
      await seedRecords([
        capturedRecord(2, { status: 'dismissed' }),
        capturedRecord(3, {
          acknowledgements: {
            [`${DESTINATION}::${COACH_ID}`]: {
              ...OWNER,
              reason: 'imported',
              at: 1,
            },
          },
        }),
      ]);

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2', 'production:1:3']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        processedCount: 3,
        alreadyPresentCount: 1,
        failedCount: 2,
      });
      expect(result.errors.map((error) => error.message)).toEqual([
        'This workout is no longer in the extension.',
        'This workout is no longer pending in the extension (dismissed).',
      ]);
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should stop as blocked before any upload when the account changed after reconciling', async () => {
      await seedRecords([capturedRecord(1)]);
      verifyOperationContext.mockResolvedValue({
        ok: false,
        reason: 'account_changed',
      });

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(result).toMatchObject({
        state: 'blocked',
        blockedReason: 'account_changed',
        processedCount: 0,
      });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should stop mid-batch when the account changes, keeping what already landed', async () => {
      await seedRecords([
        capturedRecord(1),
        capturedRecord(2),
        capturedRecord(3),
      ]);
      verifyOperationContext
        .mockResolvedValueOnce({ ok: true }) // after reconciling
        .mockResolvedValueOnce({ ok: true }) // before the first POST
        .mockResolvedValue({ ok: false, reason: 'account_changed' });

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2', 'production:1:3']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'blocked',
        blockedReason: 'account_changed',
        importedCount: 1,
        failedCount: 2,
        processedCount: 3,
      });
      expectCountsToAddUp(result);
    });

    it('should fail every workout when the library cannot be resolved', async () => {
      await seedRecords([capturedRecord(1), capturedRecord(2)]);
      api.fetchPlanMyPeakLibraries.mockResolvedValue({
        success: false,
        error: { message: 'HTTP 500' },
      });

      const result = await runCapturedImport(
        operation(['production:1:1', 'production:1:2']),
        { reconciler: reconciler() }
      );

      expect(result).toMatchObject({
        state: 'completed',
        importedCount: 0,
        failedCount: 2,
        processedCount: 2,
      });
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });

    it('should report a thrown error as interrupted with generic text only', async () => {
      await seedRecords([capturedRecord(1)]);
      const broken = new CapturedWorkoutReconciler({ lookup: vi.fn() });
      vi.spyOn(broken, 'reconcile').mockRejectedValue(
        new Error('secret internals: Bearer abc')
      );

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: broken,
      });

      expect(result.state).toBe('interrupted');
      expect(result.errors).toEqual([
        { title: '', message: 'The import stopped unexpectedly. Try again.' },
      ]);
      expect(JSON.stringify(result)).not.toContain('Bearer');
    });

    it('should persist the operation as it goes and at the end', async () => {
      await seedRecords([capturedRecord(1)]);

      await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
        now: () => 9000,
      });

      expect(await findOperation('ctx-a', 'op-1')).toMatchObject({
        state: 'completed',
        importedCount: 1,
        updatedAt: 9000,
      });
    });

    it('should be live while it runs and not afterwards, whatever the outcome', async () => {
      await seedRecords([capturedRecord(1)]);
      let liveDuringUpload = false;
      api.exportWorkoutsToPlanMyPeakLibrary.mockImplementation(
        async (...args) => {
          liveDuringUpload = isOperationLive('op-1');
          return fakeUploadLoop()(...args);
        }
      );

      await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(liveDuringUpload).toBe(true);
      expect(isOperationLive('op-1')).toBe(false);
      expect(badgeService.refreshBadge).toHaveBeenCalled();
    });

    it('should re-check the destination rather than trust an answer cached before the run', async () => {
      await seedRecords([capturedRecord(1)]);
      const shared = reconciler();
      await shared.reconcile('ctx-a', [
        toReconcileCandidate(capturedRecord(1)),
      ]);
      // Another importer lands it between the summary and the import.
      api.fetchPlanMyPeakWorkoutByProviderId.mockResolvedValue({
        success: true,
        data: remoteWorkout('cal:1'),
      });

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: shared,
      });

      expect(result.alreadyPresentCount).toBe(1);
      expect(api.exportWorkoutsToPlanMyPeakLibrary).not.toHaveBeenCalled();
    });
  });

  describe('popup send coordination', () => {
    it('should report a popup send only while it is in flight', async () => {
      let finish: () => void = () => undefined;
      const send = new Promise<void>((resolve) => {
        finish = resolve;
      });

      const tracked = trackPopupCapturedSend(send);
      expect(isPopupCapturedSendInFlight()).toBe(true);

      finish();
      await tracked;
      await Promise.resolve();
      expect(isPopupCapturedSendInFlight()).toBe(false);
    });

    it('should wait for a popup send before reading the records', async () => {
      await seedRecords([capturedRecord(1)]);
      let finish: () => void = () => undefined;
      void trackPopupCapturedSend(
        new Promise<void>((resolve) => {
          finish = resolve;
        })
      );

      const run = runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(api.fetchPlanMyPeakWorkoutByProviderId).not.toHaveBeenCalled();

      finish();
      expect((await run).state).toBe('completed');
    });

    it('should carry on when the popup send it waited for fails', async () => {
      await seedRecords([capturedRecord(1)]);
      trackPopupCapturedSend(Promise.reject(new Error('popup failed'))).catch(
        () => undefined
      );

      const result = await runCapturedImport(operation(['production:1:1']), {
        reconciler: reconciler(),
      });

      expect(result.state).toBe('completed');
    });
  });
});

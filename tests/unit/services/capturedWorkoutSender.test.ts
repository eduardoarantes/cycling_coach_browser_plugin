/**
 * The UI-free sender, driven with a fake adapter. The popup path through the
 * runtime-message adapter is covered in `useSendCapturedWorkouts.test.ts`;
 * these cover the rules the background import relies on directly.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  capturedProviderWorkoutId,
  emptySendSummary,
  mergeSendSummary,
  sendCapturedRecords,
  type CapturedSendDeps,
} from '@/services/capturedWorkoutSender';
import type { ExportResult, ValidationResult } from '@/export/adapters/base';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type { LibraryItem } from '@/types';
import { capturedRecord } from '../background/capturedImports/fixtures';

const valid: ValidationResult = { isValid: true, errors: [], warnings: [] };

function transformed(
  items: LibraryItem[],
  config: PlanMyPeakExportConfig
): PlanMyPeakWorkout[] {
  return items.map(
    (item) =>
      ({
        name: item.itemName,
        provider_workout_id: `${config.providerIdNamespace}:${item.exerciseLibraryItemId}`,
      }) as PlanMyPeakWorkout
  );
}

function exported(
  workouts: PlanMyPeakWorkout[],
  failing: Record<string, string> = {}
): ExportResult {
  return {
    success: true,
    fileName: 'My Library',
    format: 'api',
    itemsExported: workouts.length,
    warnings: [],
    itemResults: workouts.map((workout) => {
      const id = workout.provider_workout_id ?? '';
      return failing[id]
        ? { providerWorkoutId: id, success: false, error: failing[id] }
        : {
            providerWorkoutId: id,
            success: true,
            remoteId: `pmp-${id}`,
            libraryName: 'My Library',
          };
    }),
  } as ExportResult;
}

function deps(overrides: Partial<CapturedSendDeps['adapter']> = {}): {
  deps: CapturedSendDeps;
  recordSkip: ReturnType<typeof vi.fn>;
} {
  const recordSkip = vi.fn(async () => undefined);
  return {
    recordSkip,
    deps: {
      recordSkip,
      adapter: {
        transform: vi.fn(async (items, config) => transformed(items, config)),
        validate: vi.fn(async () => valid),
        export: vi.fn(async (workouts) => exported(workouts)),
        ...overrides,
      } as CapturedSendDeps['adapter'],
    },
  };
}

describe('capturedWorkoutSender', () => {
  describe('capturedProviderWorkoutId', () => {
    it('should namespace the identity by TrainingPeaks environment', () => {
      expect(capturedProviderWorkoutId(capturedRecord(7))).toBe('cal:7');
      expect(
        capturedProviderWorkoutId(capturedRecord(7, { environment: 'sandbox' }))
      ).toBe('cal-sandbox:7');
    });
  });

  describe('sendCapturedRecords', () => {
    it('should send to the default library with captured keys and key outcomes by record', async () => {
      const { deps: sendDeps } = deps();

      const summary = await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2)],
        sendDeps
      );

      expect(sendDeps.adapter.export).toHaveBeenCalledWith(expect.anything(), {
        createFolder: false,
        providerIdNamespace: 'cal',
        capturedKeys: { 'cal:1': 'production:1:1', 'cal:2': 'production:1:2' },
      });
      expect(summary).toMatchObject({ sent: 2, failed: 0, skipped: 0 });
      expect(summary.outcomes['production:1:1']).toMatchObject({
        status: 'sent',
        remoteId: 'pmp-cal:1',
        libraryName: 'My Library',
      });
    });

    it('should record a workout the transform dropped as a skip and send the rest', async () => {
      const { deps: sendDeps, recordSkip } = deps({
        transform: vi.fn(async (items, config) =>
          transformed(items, config).filter(
            (workout) => workout.provider_workout_id !== 'cal:1'
          )
        ),
        validate: vi.fn(async () => ({
          ...valid,
          warnings: [
            {
              field: 'structure:1',
              message: 'No structure to convert',
              severity: 'warning' as const,
            },
          ],
        })),
      });

      const summary = await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2)],
        sendDeps
      );

      expect(recordSkip).toHaveBeenCalledWith(
        'production:1:1',
        'No structure to convert'
      );
      expect(summary).toMatchObject({ sent: 1, skipped: 1 });
      expect(summary.outcomes['production:1:1'].status).toBe('skipped');
    });

    it('should skip everything and export nothing when validation fails', async () => {
      const { deps: sendDeps, recordSkip } = deps({
        validate: vi.fn(async () => ({
          isValid: false,
          errors: [
            {
              field: 'workouts[0].name',
              message: 'Name is required',
              severity: 'error' as const,
            },
          ],
          warnings: [],
        })),
      });

      const summary = await sendCapturedRecords([capturedRecord(1)], sendDeps);

      expect(sendDeps.adapter.export).not.toHaveBeenCalled();
      expect(recordSkip).toHaveBeenCalledWith(
        'production:1:1',
        'Name is required'
      );
      expect(summary).toMatchObject({ sent: 0, skipped: 1 });
    });

    it('should report a per-item failure against its own record', async () => {
      const { deps: sendDeps } = deps({
        export: vi.fn(async (workouts) =>
          exported(workouts, { 'cal:2': 'HTTP 422' })
        ),
      });

      const summary = await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2)],
        sendDeps
      );

      expect(summary).toMatchObject({ sent: 1, failed: 1, errors: [] });
      expect(summary.outcomes['production:1:2']).toMatchObject({
        status: 'failed',
        error: 'HTTP 422',
      });
    });

    it('should fail every record with the run error when nothing was attempted', async () => {
      const { deps: sendDeps } = deps({
        export: vi.fn(
          async () =>
            ({
              success: false,
              fileName: '',
              format: 'api',
              itemsExported: 0,
              warnings: [],
              errors: ['Could not load libraries'],
            }) as ExportResult
        ),
      });

      const summary = await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2)],
        sendDeps
      );

      expect(summary).toMatchObject({
        sent: 0,
        failed: 2,
        errors: ['Could not load libraries'],
      });
      expect(summary.outcomes['production:1:1'].error).toBe(
        'Could not load libraries'
      );
    });

    it('should run one export per environment, each under its own namespace', async () => {
      const { deps: sendDeps } = deps();

      await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2, { environment: 'sandbox' })],
        sendDeps
      );

      const namespaces = vi
        .mocked(sendDeps.adapter.export)
        .mock.calls.map(([, config]) => config.providerIdNamespace);
      expect(namespaces).toEqual(['cal', 'cal-sandbox']);
    });

    it('should fail a group that throws without aborting the other groups', async () => {
      const { deps: sendDeps } = deps({
        export: vi.fn(async (workouts, config) => {
          if (config.providerIdNamespace === 'cal') {
            throw new Error('boom');
          }
          return exported(workouts);
        }),
      });

      const summary = await sendCapturedRecords(
        [capturedRecord(1), capturedRecord(2, { environment: 'sandbox' })],
        sendDeps
      );

      expect(summary).toMatchObject({ sent: 1, failed: 1, errors: ['boom'] });
      expect(summary.outcomes['production:1:1']).toMatchObject({
        status: 'failed',
        error: 'boom',
      });
      expect(summary.outcomes['sandbox:1:2'].status).toBe('sent');
    });

    it('should do nothing for no records', async () => {
      const { deps: sendDeps } = deps();

      expect(await sendCapturedRecords([], sendDeps)).toEqual(
        emptySendSummary()
      );
      expect(sendDeps.adapter.transform).not.toHaveBeenCalled();
    });
  });

  describe('mergeSendSummary', () => {
    it('should add counts and keep every outcome and error', () => {
      const merged = mergeSendSummary(
        {
          sent: 1,
          failed: 0,
          skipped: 1,
          outcomes: { a: { key: 'a', status: 'sent' } },
          errors: ['one'],
        },
        {
          sent: 0,
          failed: 2,
          skipped: 0,
          outcomes: { b: { key: 'b', status: 'failed' } },
          errors: ['two'],
        }
      );

      expect(merged).toMatchObject({
        sent: 1,
        failed: 2,
        skipped: 1,
        errors: ['one', 'two'],
      });
      expect(Object.keys(merged.outcomes)).toEqual(['a', 'b']);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useMultiLibraryExport,
  type MultiLibraryExportConfig,
} from '@/hooks/useMultiLibraryExport';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import type { ExportResult } from '@/export/adapters/base';
import type { Library } from '@/types/api.types';
import { PLANMYPEAK_AUTH_MESSAGES } from '@/utils/uiStrings';

vi.mock('@/export/adapters/planMyPeak', () => ({
  planMyPeakAdapter: {
    transform: vi.fn(async () => [{ provider_workout_id: 'w' }]),
    validate: vi.fn(async () => ({ isValid: true, errors: [], warnings: [] })),
    export: vi.fn(),
  },
}));

function library(id: number, name: string): Library {
  return {
    exerciseLibraryId: id,
    libraryName: name,
    ownerId: 1,
    ownerName: 'Coach',
    imageUrl: null,
    isDownloadable: true,
  } as unknown as Library;
}

function success(name: string, count: number): ExportResult {
  return {
    success: true,
    fileName: name,
    format: 'api',
    itemsExported: count,
    warnings: [],
  };
}

const LIBRARIES = [
  library(1, 'Base'),
  library(2, 'Build'),
  library(3, 'Peak'),
  library(4, 'Race'),
];

const CONFIG: MultiLibraryExportConfig = {
  strategy: 'separate',
  createFolder: true,
  authRunId: 'run-1',
};

describe('useMultiLibraryExport', () => {
  beforeEach(() => {
    vi.mocked(planMyPeakAdapter.export).mockReset();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: true,
      data: [{ exerciseLibraryItemId: 1, itemName: 'Workout' }],
    });
  });

  it('should stop the batch on the first terminal auth failure and keep earlier successes', async () => {
    vi.mocked(planMyPeakAdapter.export)
      .mockResolvedValueOnce(success('Base', 12))
      .mockResolvedValueOnce(success('Build', 9))
      .mockResolvedValueOnce({
        success: true,
        fileName: 'Peak',
        format: 'api',
        itemsExported: 5,
        warnings: [],
        authFailure: { reason: 'sign_in_required' },
      });

    const { result } = renderHook(() => useMultiLibraryExport());
    await act(async () => {
      await result.current.executeExport(
        [1, 2, 3, 4],
        LIBRARIES,
        CONFIG,
        'planmypeak'
      );
    });

    expect(planMyPeakAdapter.export).toHaveBeenCalledTimes(3);
    const results = result.current.exportResults;
    expect(results.map((r) => r.fileName)).toEqual([
      'Base',
      'Build',
      'Peak',
      'Race',
    ]);
    expect(results[0].itemsExported).toBe(12);
    expect(results[1].itemsExported).toBe(9);
    expect(results[2].itemsExported).toBe(5);
    expect(results[3]).toMatchObject({
      success: false,
      itemsExported: 0,
      errors: [PLANMYPEAK_AUTH_MESSAGES.STOPPED_AFTER_AUTH_FAILURE],
      authFailure: { reason: 'sign_in_required' },
    });
  });

  it('should report the libraries it did not reach with one shared reason', async () => {
    vi.mocked(planMyPeakAdapter.export).mockResolvedValueOnce({
      success: false,
      fileName: 'Base',
      format: 'api',
      itemsExported: 0,
      warnings: [],
      errors: ['PlanMyPeak sign-in required.'],
      authFailure: { reason: 'sign_in_required' },
    });

    const { result } = renderHook(() => useMultiLibraryExport());
    await act(async () => {
      await result.current.executeExport(
        [1, 2, 3, 4],
        LIBRARIES,
        CONFIG,
        'planmypeak'
      );
    });

    expect(planMyPeakAdapter.export).toHaveBeenCalledTimes(1);
    const stopped = result.current.exportResults.slice(1);
    expect(stopped).toHaveLength(3);
    expect(new Set(stopped.flatMap((r) => r.errors))).toEqual(
      new Set([PLANMYPEAK_AUTH_MESSAGES.STOPPED_AFTER_AUTH_FAILURE])
    );
  });

  it('should pass the run id to every library export', async () => {
    vi.mocked(planMyPeakAdapter.export).mockImplementation(
      async (_workouts, config) => success(config.targetLibraryName ?? '', 1)
    );

    const { result } = renderHook(() => useMultiLibraryExport());
    await act(async () => {
      await result.current.executeExport(
        [1, 2],
        LIBRARIES,
        CONFIG,
        'planmypeak'
      );
    });

    for (const call of vi.mocked(planMyPeakAdapter.export).mock.calls) {
      expect(call[1].authRunId).toBe('run-1');
    }
  });

  it('should continue past a failure that is not an auth failure', async () => {
    vi.mocked(planMyPeakAdapter.export)
      .mockResolvedValueOnce({
        success: false,
        fileName: 'Base',
        format: 'api',
        itemsExported: 0,
        warnings: [],
        errors: ['Internal Server Error'],
      })
      .mockResolvedValue(success('next', 1));

    const { result } = renderHook(() => useMultiLibraryExport());
    await act(async () => {
      await result.current.executeExport(
        [1, 2, 3, 4],
        LIBRARIES,
        CONFIG,
        'planmypeak'
      );
    });

    expect(planMyPeakAdapter.export).toHaveBeenCalledTimes(4);
  });
});

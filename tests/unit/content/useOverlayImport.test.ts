/**
 * Import execution: duplicate handling, outcome reporting, and what is allowed
 * to reach the page when an import finishes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOverlayImport } from '@/content/overlay/useOverlayImport';
import {
  EMPTY_SELECTION,
  toggleLibrary,
  type OverlaySelection,
} from '@/content/overlay/selection';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import type { LibraryItem } from '@/schemas/library.schema';
import type { PlanMyPeakLibrary } from '@/schemas/planMyPeakApi.schema';

function item(id: number): LibraryItem {
  return {
    exerciseLibraryId: 1,
    exerciseLibraryItemId: id,
    exerciseLibraryItemType: 'workout',
    itemName: `Workout ${id}`,
    workoutTypeId: 2,
    distancePlanned: null,
    totalTimePlanned: 1,
    caloriesPlanned: null,
    tssPlanned: null,
    ifPlanned: null,
    velocityPlanned: null,
    energyPlanned: null,
    elevationGainPlanned: null,
    description: null,
    coachComments: null,
  };
}

const ITEMS = [item(10), item(11)];

function existingLibrary(name: string): PlanMyPeakLibrary {
  return {
    id: 'lib-1',
    name,
    is_system: false,
  } as PlanMyPeakLibrary;
}

function selectionWithLibrary(name = 'Base Training'): OverlaySelection {
  return toggleLibrary(EMPTY_SELECTION, { libraryId: 1, libraryName: name });
}

function loaded(): ReadonlyMap<number, ReadonlyArray<LibraryItem>> {
  return new Map([[1, ITEMS]]);
}

/** Answers the GET_PLANMYPEAK_LIBRARIES preflight lookup. */
function mockLibrariesResponse(libraries: PlanMyPeakLibrary[]): void {
  vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(
    (message: unknown) => {
      const typed = message as { type: string };
      if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
        return Promise.resolve({ success: true, data: libraries });
      }
      return Promise.resolve({ success: true, data: [] });
    }
  );
}

describe('useOverlayImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(planMyPeakAdapter, 'transform').mockResolvedValue([]);
    vi.spyOn(planMyPeakAdapter, 'validate').mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });
    vi.spyOn(planMyPeakAdapter, 'export').mockResolvedValue({
      success: true,
      fileName: 'Base Training',
      format: 'api',
      itemsExported: 2,
      warnings: [],
    });
  });

  it('should import directly when no duplicate exists', async () => {
    mockLibrariesResponse([]);
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useOverlayImport(onCompleted));

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.outcome?.ok).toBe(true);
    expect(result.current.outcome?.importedCount).toBe(2);
    expect(planMyPeakAdapter.export).toHaveBeenCalledTimes(1);
  });

  it('should pause on a duplicate instead of uploading', async () => {
    mockLibrariesResponse([existingLibrary('Base Training')]);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    expect(result.current.phase).toBe('duplicates');
    expect(result.current.conflicts).toHaveLength(1);
    expect(planMyPeakAdapter.export).not.toHaveBeenCalled();
  });

  it('should upload with replace when the coach chooses Replace', async () => {
    mockLibrariesResponse([existingLibrary('Base Training')]);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });
    await act(async () => {
      await result.current.resolveDuplicates('replace');
    });

    expect(planMyPeakAdapter.export).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ existingLibraryAction: 'replace' })
    );
  });

  it('should upload with append when the coach chooses Append', async () => {
    mockLibrariesResponse([existingLibrary('Base Training')]);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });
    await act(async () => {
      await result.current.resolveDuplicates('append');
    });

    expect(planMyPeakAdapter.export).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ existingLibraryAction: 'append' })
    );
  });

  it('should upload nothing when the coach chooses Ignore Upload', async () => {
    mockLibrariesResponse([existingLibrary('Base Training')]);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });
    await act(async () => {
      await result.current.resolveDuplicates('ignore');
    });

    expect(planMyPeakAdapter.export).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(result.current.conflicts).toHaveLength(0);
  });

  it('should surface a preflight failure without importing', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      success: false,
      error: { message: 'PlanMyPeak unreachable' },
    } as never);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    expect(result.current.preflightError).toBe('PlanMyPeak unreachable');
    expect(result.current.phase).toBe('idle');
    expect(planMyPeakAdapter.export).not.toHaveBeenCalled();
  });

  it('should report a failed upload as a failure, not a success', async () => {
    mockLibrariesResponse([]);
    vi.spyOn(planMyPeakAdapter, 'export').mockResolvedValue({
      success: false,
      fileName: 'Base Training',
      format: 'api',
      itemsExported: 0,
      warnings: [],
      errors: ['Upload rejected'],
    });
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.outcome?.ok).toBe(false);
    expect(result.current.outcome?.failedCount).toBe(1);
    expect(result.current.outcome?.items[0].message).toContain(
      'Upload rejected'
    );
  });

  it('should report a partial failure as partial', async () => {
    mockLibrariesResponse([]);
    vi.spyOn(planMyPeakAdapter, 'export')
      .mockResolvedValueOnce({
        success: true,
        fileName: 'Base Training',
        format: 'api',
        itemsExported: 2,
        warnings: [],
      })
      .mockResolvedValueOnce({
        success: false,
        fileName: 'Build Phase',
        format: 'api',
        itemsExported: 0,
        warnings: [],
        errors: ['Upload rejected'],
      });

    let selection = selectionWithLibrary('Base Training');
    selection = toggleLibrary(selection, {
      libraryId: 2,
      libraryName: 'Build Phase',
    });

    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection,
        loadedItems: new Map([
          [1, ITEMS],
          [2, ITEMS],
        ]),
      });
    });

    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.outcome).toMatchObject({
      ok: false,
      importedCount: 2,
      failedCount: 1,
    });
  });

  it('should fail an item whose workouts do not validate', async () => {
    mockLibrariesResponse([]);
    vi.spyOn(planMyPeakAdapter, 'validate').mockResolvedValue({
      isValid: false,
      errors: [
        {
          field: 'workouts[0]',
          message: 'Structure required',
          severity: 'error',
        },
      ],
      warnings: [],
    });
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    await waitFor(() => expect(result.current.phase).toBe('result'));
    expect(result.current.outcome?.ok).toBe(false);
    expect(planMyPeakAdapter.export).not.toHaveBeenCalled();
  });

  it('should notify the page with counts only', async () => {
    mockLibrariesResponse([]);
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useOverlayImport(onCompleted));

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    const payload = onCompleted.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'failedCount',
      'importedCount',
      'ok',
    ]);
  });

  it('should reset back to a clean state', async () => {
    mockLibrariesResponse([]);
    const { result } = renderHook(() => useOverlayImport());

    await act(async () => {
      await result.current.startImport({
        selection: selectionWithLibrary(),
        loadedItems: loaded(),
      });
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.outcome).toBeNull();
    expect(result.current.progress).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCapturedWorkouts } from '@/hooks/useCapturedWorkouts';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';
import { STORAGE_KEYS } from '@/utils/constants';

function record(
  workoutId: number,
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  return {
    key: `production:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment: 'production',
    capturedAt: workoutId * 100,
    updatedAt: workoutId * 100,
    status: 'pending',
    workout: {
      title: `Workout ${workoutId}`,
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure: null,
      totalTimePlanned: null,
      tssPlanned: null,
      ifPlanned: null,
      distancePlanned: null,
      caloriesPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
      userTags: null,
      lastModifiedDate: null,
    },
    ...overrides,
  };
}

type Listener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void;

function storageListeners(): Listener[] {
  return vi
    .mocked(chrome.storage.onChanged.addListener)
    .mock.calls.map((call) => call[0] as Listener);
}

describe('useCapturedWorkouts', () => {
  let sent: Array<Record<string, unknown>>;
  let listResponse: { records: CapturedWorkoutRecord[]; pendingCount: number };

  beforeEach(() => {
    sent = [];
    listResponse = {
      records: [record(2), record(1, { status: 'sent' })],
      pendingCount: 1,
    };
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        const typed = message as Record<string, unknown>;
        sent.push(typed);
        if (typed.type === 'GET_CAPTURED_WORKOUTS') {
          return { success: true, data: listResponse };
        }
        if (typed.type === 'UPDATE_CAPTURED_WORKOUT') {
          return { success: true, data: null };
        }
        if (typed.type === 'REMOVE_CAPTURED_WORKOUTS') {
          return { success: true, data: { removed: 1 } };
        }
        return { success: false, error: { message: 'unhandled' } };
      }
    );
  });

  it('loads the list through the background and derives the pending count', async () => {
    const { result } = renderHook(() => useCapturedWorkouts());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.records.map((r) => r.workoutId)).toEqual([2, 1]);
    expect(result.current.pendingCount).toBe(1);
    expect(sent).toEqual([{ type: 'GET_CAPTURED_WORKOUTS' }]);
  });

  it('updates live when the storage key changes', async () => {
    const { result } = renderHook(() => useCapturedWorkouts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newer = record(3);
    act(() => {
      for (const listener of storageListeners()) {
        listener(
          {
            [STORAGE_KEYS.CAPTURED_WORKOUTS]: {
              newValue: {
                [newer.key]: newer,
                'production:1:2': record(2),
                junk: { key: 'junk' },
              },
            },
          },
          'local'
        );
      }
    });

    expect(result.current.records.map((r) => r.workoutId)).toEqual([3, 2]);
    expect(result.current.pendingCount).toBe(2);
  });

  it('ignores changes to other keys and other areas', async () => {
    const { result } = renderHook(() => useCapturedWorkouts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      for (const listener of storageListeners()) {
        listener({ export_progress: { newValue: {} } }, 'local');
        listener(
          { [STORAGE_KEYS.CAPTURED_WORKOUTS]: { newValue: {} } },
          'sync'
        );
      }
    });

    expect(result.current.records).toHaveLength(2);
  });

  it('dismisses through a runtime message and never writes storage itself', async () => {
    const { result } = renderHook(() => useCapturedWorkouts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.dismiss('production:1:2');
    });

    expect(sent).toContainEqual({
      type: 'UPDATE_CAPTURED_WORKOUT',
      key: 'production:1:2',
      status: 'dismissed',
    });
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('clears finished records through a runtime message', async () => {
    const { result } = renderHook(() => useCapturedWorkouts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.clearFinished();
    });

    expect(sent).toContainEqual({
      type: 'REMOVE_CAPTURED_WORKOUTS',
      statuses: ['sent', 'dismissed'],
    });
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('surfaces a background error', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: false,
      error: { message: 'boom' },
    });

    const { result } = renderHook(() => useCapturedWorkouts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('boom');
  });

  describe('unlinked captures', () => {
    const owner = {
      coachId: 'coach-1',
      destination: 'https://portal.planmypeak.com',
    };

    it('should count pending records that have no owner', async () => {
      listResponse = {
        records: [
          record(3),
          record(2, { owner }),
          record(1, { status: 'sent' }),
        ],
        pendingCount: 2,
      };

      const { result } = renderHook(() => useCapturedWorkouts());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unlinkedCount).toBe(1);
    });

    it('should claim through a runtime message that names no account, then reload', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as Record<string, unknown>;
          sent.push(typed);
          return typed.type === 'CLAIM_CAPTURED_WORKOUTS'
            ? { success: true, data: { claimed: 1 } }
            : { success: true, data: listResponse };
        }
      );
      const { result } = renderHook(() => useCapturedWorkouts());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let outcome: string | null = 'unset';
      await act(async () => {
        outcome = await result.current.claim();
      });

      expect(outcome).toBeNull();
      expect(sent).toEqual([
        { type: 'GET_CAPTURED_WORKOUTS' },
        { type: 'CLAIM_CAPTURED_WORKOUTS' },
        { type: 'GET_CAPTURED_WORKOUTS' },
      ]);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should resolve to the background error when the claim is refused', async () => {
      const { result } = renderHook(() => useCapturedWorkouts());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let outcome: string | null = null;
      await act(async () => {
        outcome = await result.current.claim();
      });

      expect(outcome).toBe('unhandled');
    });

    it('should resolve to a message when the background cannot be reached', async () => {
      const { result } = renderHook(() => useCapturedWorkouts());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
        new Error('worker gone')
      );

      let outcome: string | null = null;
      await act(async () => {
        outcome = await result.current.claim();
      });

      expect(outcome).toBe('worker gone');
    });
  });
});

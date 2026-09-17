/**
 * The export-progress service paints its own badge states and hands the idle
 * case to the badge owner, which knows what else should show.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EXPORT_BADGE_LINGER_MS,
  clearBadgeAfterDelay,
  completeExport,
  startExport,
  updateBadge,
} from '@/services/exportProgressService';
import * as badgeService from '@/services/badgeService';
import { STORAGE_KEYS } from '@/utils/constants';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';

function pending(workoutId: number): CapturedWorkoutRecord {
  return {
    key: `production:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment: 'production',
    capturedAt: workoutId,
    updatedAt: workoutId,
    status: 'pending',
    workout: {
      title: 'W',
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
  };
}

function lastBadgeText(): string | undefined {
  const calls = vi.mocked(chrome.action.setBadgeText).mock.calls;
  return (calls[calls.length - 1]?.[0] as { text: string } | undefined)?.text;
}

describe('exportProgressService badge delegation', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('delegates the idle case to the badge owner', async () => {
    const refresh = vi.spyOn(badgeService, 'refreshBadge').mockResolvedValue();

    await updateBadge(null);
    await updateBadge({
      exportId: 'x',
      status: 'idle',
      destination: 'planmypeak',
      sourceName: 's',
      targetName: 't',
      totalItems: 0,
      completedItems: 0,
      successCount: 0,
      failedCount: 0,
      startedAt: 0,
    });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
  });

  it('shows the pending capture count when idle', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_WORKOUTS]: { 'production:1:1': pending(1) },
    });

    await updateBadge(null);

    expect(lastBadgeText()).toBe('1');
  });

  it('paints in-progress state itself', async () => {
    const refresh = vi.spyOn(badgeService, 'refreshBadge').mockResolvedValue();

    await startExport({
      destination: 'planmypeak',
      sourceName: 'Lib',
      targetName: 'Lib',
      totalItems: 3,
    });

    expect(lastBadgeText()).toBe('0/3');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recomputes the badge through the owner once the linger window elapses', async () => {
    vi.useFakeTimers();
    const refresh = vi.spyOn(badgeService, 'refreshBadge').mockResolvedValue();

    await clearBadgeAfterDelay();
    expect(refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(EXPORT_BADGE_LINGER_MS);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows the pending count after an export completes and its window elapses', async () => {
    vi.useFakeTimers();
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_WORKOUTS]: {
        'production:1:1': pending(1),
        'production:1:2': pending(2),
      },
    });

    const state = await startExport({
      destination: 'planmypeak',
      sourceName: 'Lib',
      targetName: 'Lib',
      totalItems: 1,
    });
    await completeExport({ exportId: state.exportId, success: true });
    expect(lastBadgeText()).toBe('✓');

    await vi.advanceTimersByTimeAsync(EXPORT_BADGE_LINGER_MS + 1);

    expect(lastBadgeText()).toBe('2');
  });
});

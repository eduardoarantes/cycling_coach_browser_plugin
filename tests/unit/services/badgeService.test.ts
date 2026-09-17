import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatPendingBadgeText,
  isExportBadgeActive,
  refreshBadge,
  BADGE_COLORS,
} from '@/services/badgeService';
import {
  EXPORT_BADGE_LINGER_MS,
  type ExportProgressState,
} from '@/services/exportProgressService';
import { STORAGE_KEYS } from '@/utils/constants';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';

function record(
  workoutId: number,
  status: CapturedWorkoutRecord['status'] = 'pending'
): CapturedWorkoutRecord {
  return {
    key: `production:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment: 'production',
    capturedAt: workoutId,
    updatedAt: workoutId,
    status,
    workout: {
      title: `W${workoutId}`,
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

async function seedPending(count: number): Promise<void> {
  const map: Record<string, CapturedWorkoutRecord> = {};
  for (let i = 1; i <= count; i++) {
    map[`production:1:${i}`] = record(i);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURED_WORKOUTS]: map });
}

function exportState(
  overrides: Partial<ExportProgressState>
): ExportProgressState {
  return {
    exportId: 'export_1',
    status: 'in_progress',
    destination: 'planmypeak',
    sourceName: 'Lib',
    targetName: 'Lib',
    totalItems: 5,
    completedItems: 0,
    successCount: 0,
    failedCount: 0,
    startedAt: 1000,
    ...overrides,
  };
}

async function seedExport(state: ExportProgressState | null): Promise<void> {
  if (state) {
    await chrome.storage.local.set({ export_progress: state });
  } else {
    await chrome.storage.local.remove('export_progress');
  }
}

function badgeText(): string | undefined {
  const calls = vi.mocked(chrome.action.setBadgeText).mock.calls;
  return (calls[calls.length - 1]?.[0] as { text: string } | undefined)?.text;
}

function badgeColor(): string | undefined {
  const calls = vi.mocked(chrome.action.setBadgeBackgroundColor).mock.calls;
  return (calls[calls.length - 1]?.[0] as { color: string } | undefined)?.color;
}

describe('badgeService', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await chrome.storage.local.clear();
    vi.clearAllMocks();
  });

  it('formats the pending count with a 99+ cap', () => {
    expect(formatPendingBadgeText(0)).toBe('');
    expect(formatPendingBadgeText(1)).toBe('1');
    expect(formatPendingBadgeText(99)).toBe('99');
    expect(formatPendingBadgeText(100)).toBe('99+');
  });

  it('shows the pending count in amber when no export is reported', async () => {
    await seedPending(2);

    await refreshBadge();

    expect(badgeText()).toBe('2');
    expect(badgeColor()).toBe(BADGE_COLORS.pendingCaptures);
  });

  it('lets an in-progress export win over the count', async () => {
    await seedPending(2);
    await seedExport(exportState({ completedItems: 1, totalItems: 5 }));

    await refreshBadge();

    expect(badgeText()).toBe('1/5');
    expect(badgeColor()).toBe(BADGE_COLORS.exportInProgress);
  });

  it('keeps a freshly completed export on the badge', async () => {
    await seedPending(2);
    await seedExport(
      exportState({ status: 'completed', completedAt: Date.now() - 100 })
    );

    await refreshBadge();

    expect(badgeText()).toBe('✓');
    expect(badgeColor()).toBe(BADGE_COLORS.exportCompleted);
  });

  it('keeps a freshly failed export on the badge', async () => {
    await seedExport(
      exportState({ status: 'failed', completedAt: Date.now() - 100 })
    );

    await refreshBadge();

    expect(badgeText()).toBe('!');
    expect(badgeColor()).toBe(BADGE_COLORS.exportFailed);
  });

  it('lets a completed export older than the linger window fall through to the count', async () => {
    await seedPending(2);
    await seedExport(
      exportState({
        status: 'completed',
        completedAt: Date.now() - EXPORT_BADGE_LINGER_MS - 1,
      })
    );

    await refreshBadge();

    expect(badgeText()).toBe('2');
  });

  it('shows the count after a restart with a stale completed state in storage', async () => {
    // A browser restart: old export state persisted, badge text lost.
    await seedPending(1);
    await seedExport(
      exportState({
        status: 'completed',
        completedAt: Date.now() - 60 * 60 * 1000,
      })
    );

    await refreshBadge();

    expect(badgeText()).toBe('1');
    expect(badgeColor()).toBe(BADGE_COLORS.pendingCaptures);
  });

  it('does not let a completed state with no completedAt hold the badge', async () => {
    await seedPending(3);
    await seedExport(exportState({ status: 'completed' }));

    await refreshBadge();

    expect(badgeText()).toBe('3');
  });

  it('caps the count at 99+', async () => {
    await seedPending(120);

    await refreshBadge();

    expect(badgeText()).toBe('99+');
  });

  it('clears the badge when nothing is pending and no export is shown', async () => {
    await refreshBadge();

    expect(badgeText()).toBe('');
    expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it('ignores dismissed and sent records in the count', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CAPTURED_WORKOUTS]: {
        'production:1:1': record(1, 'sent'),
        'production:1:2': record(2, 'dismissed'),
        'production:1:3': record(3),
      },
    });

    await refreshBadge();

    expect(badgeText()).toBe('1');
  });

  it('is a no-op without chrome.action', async () => {
    const action = chrome.action;
    // @ts-expect-error simulate a context without the action API
    chrome.action = undefined;
    try {
      await seedPending(1);
      await expect(refreshBadge()).resolves.toBeUndefined();
      expect(action.setBadgeText).not.toHaveBeenCalled();
    } finally {
      chrome.action = action;
    }
  });

  it('reports export badge activity from state and time', () => {
    expect(isExportBadgeActive(null)).toBe(false);
    expect(isExportBadgeActive(exportState({ status: 'idle' }))).toBe(false);
    expect(isExportBadgeActive(exportState({}))).toBe(true);
    expect(
      isExportBadgeActive(
        exportState({ status: 'completed', completedAt: 1000 }),
        1000 + EXPORT_BADGE_LINGER_MS - 1
      )
    ).toBe(true);
    expect(
      isExportBadgeActive(
        exportState({ status: 'completed', completedAt: 1000 }),
        1000 + EXPORT_BADGE_LINGER_MS
      )
    ).toBe(false);
  });
});

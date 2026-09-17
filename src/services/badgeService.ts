/**
 * Badge service — the single owner of the extension action badge.
 *
 * Two things want the badge: export progress (transient, time-critical) and
 * the count of captured workouts awaiting action (durable). Two independent
 * writers of `chrome.action.setBadgeText` would race and one would erase the
 * other, so everything goes through `refreshBadge()`, which applies a fixed
 * priority:
 *
 *   1. an export `in_progress`                  → `completed/total` (blue)
 *   2. an export `completed`/`failed` finished
 *      less than `EXPORT_BADGE_LINGER_MS` ago   → `✓` (green) / `!` (red)
 *   3. pending captured workouts                → the count, `99+` cap (amber)
 *   4. nothing                                  → empty
 *
 * The linger window matters: a completed or failed export state stays in
 * storage until the popup dismisses it, and only the badge text used to be
 * cleared by a timer. A refresh that trusted persisted state would redraw `✓`
 * forever, including after a browser restart. Expiring on `completedAt` makes
 * the badge correct regardless of who calls `refreshBadge()` or when.
 */

import {
  EXPORT_BADGE_LINGER_MS,
  getExportProgress,
  type ExportProgressState,
} from './exportProgressService';
import { getPendingCapturedCount } from './capturedWorkoutService';

export const BADGE_COLORS = {
  exportInProgress: '#3B82F6', // blue
  exportCompleted: '#10B981', // green
  exportFailed: '#EF4444', // red
  pendingCaptures: '#F59E0B', // amber
} as const;

function hasActionApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.action?.setBadgeText === 'function' &&
    typeof chrome.action?.setBadgeBackgroundColor === 'function'
  );
}

/** Badge text for a pending count: empty at zero, capped at `99+`. */
export function formatPendingBadgeText(count: number): string {
  if (count <= 0) {
    return '';
  }
  return count > 99 ? '99+' : String(count);
}

/**
 * Whether an export state should still own the badge: running, or finished
 * recently enough that its `✓`/`!` has not lingered for its full window.
 */
export function isExportBadgeActive(
  state: ExportProgressState | null,
  now: number = Date.now()
): boolean {
  if (!state) {
    return false;
  }
  if (state.status === 'in_progress') {
    return true;
  }
  if (state.status === 'completed' || state.status === 'failed') {
    return (
      typeof state.completedAt === 'number' &&
      now - state.completedAt < EXPORT_BADGE_LINGER_MS
    );
  }
  return false;
}

async function paint(text: string, color?: string): Promise<void> {
  await chrome.action.setBadgeText({ text });
  if (color) {
    await chrome.action.setBadgeBackgroundColor({ color });
  }
}

/**
 * Recompute the badge from stored state and apply it.
 */
export async function refreshBadge(): Promise<void> {
  if (!hasActionApi()) {
    return;
  }

  const state = await getExportProgress();

  if (isExportBadgeActive(state) && state) {
    if (state.status === 'in_progress') {
      await paint(
        `${state.completedItems}/${state.totalItems}`,
        BADGE_COLORS.exportInProgress
      );
      return;
    }
    if (state.status === 'completed') {
      await paint('✓', BADGE_COLORS.exportCompleted);
      return;
    }
    await paint('!', BADGE_COLORS.exportFailed);
    return;
  }

  const pending = await getPendingCapturedCount();
  if (pending > 0) {
    await paint(formatPendingBadgeText(pending), BADGE_COLORS.pendingCaptures);
    return;
  }

  await paint('');
}

/**
 * Export Progress Service
 *
 * Manages export state persistence and badge updates.
 * Allows exports to continue in background and provides status recovery
 * when the popup is reopened.
 *
 * The badge itself is owned by `badgeService`: this module paints the
 * in-progress / completed / failed states directly because they are its own,
 * but the idle case is delegated to `refreshBadge()`, which knows what else
 * (the pending captured-workout count) should show once an export is over.
 */

import { BADGE_COLORS, refreshBadge } from './badgeService';

/**
 * Export destination types
 */
export type ExportDestination = 'planmypeak' | 'intervalsicu';

/**
 * Export status states
 */
export type ExportStatus = 'idle' | 'in_progress' | 'completed' | 'failed';

/**
 * Individual export item progress
 */
export interface ExportItemProgress {
  name: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

/**
 * Export progress state persisted in chrome.storage
 */
export interface ExportProgressState {
  /** Unique export session ID */
  exportId: string;
  /** Current status of the export */
  status: ExportStatus;
  /** Export destination */
  destination: ExportDestination;
  /** Source name (library or plan name) */
  sourceName: string;
  /** Target name (destination library/folder name) */
  targetName: string;
  /** Total items to export */
  totalItems: number;
  /** Number of items completed (success or fail) */
  completedItems: number;
  /** Number of successful exports */
  successCount: number;
  /** Number of failed exports */
  failedCount: number;
  /** Individual item progress (optional, for detailed tracking) */
  items?: ExportItemProgress[];
  /** Timestamp when export started */
  startedAt: number;
  /** Timestamp when export completed (if finished) */
  completedAt?: number;
  /** Error message if export failed */
  error?: string;
}

/**
 * Storage key for export progress
 */
const EXPORT_PROGRESS_KEY = 'export_progress';

/**
 * How long a completed/failed export keeps the badge before it is
 * recomputed. Also the window `badgeService` uses to decide whether a
 * persisted completed/failed state still owns the badge.
 */
export const EXPORT_BADGE_LINGER_MS = 5000;

function hasActionApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.action?.setBadgeText === 'function' &&
    typeof chrome.action?.setBadgeBackgroundColor === 'function'
  );
}

/**
 * Generate a unique export ID
 */
export function generateExportId(): string {
  return `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current export progress from storage
 */
export async function getExportProgress(): Promise<ExportProgressState | null> {
  const data = await chrome.storage.local.get(EXPORT_PROGRESS_KEY);
  return (data[EXPORT_PROGRESS_KEY] as ExportProgressState | undefined) ?? null;
}

/**
 * Save export progress to storage
 */
export async function saveExportProgress(
  state: ExportProgressState
): Promise<void> {
  await chrome.storage.local.set({ [EXPORT_PROGRESS_KEY]: state });
}

/**
 * Clear export progress from storage
 */
export async function clearExportProgress(): Promise<void> {
  await chrome.storage.local.remove(EXPORT_PROGRESS_KEY);
}

/**
 * Start a new export session
 */
export async function startExport(params: {
  destination: ExportDestination;
  sourceName: string;
  targetName: string;
  totalItems: number;
  items?: string[];
}): Promise<ExportProgressState> {
  const state: ExportProgressState = {
    exportId: generateExportId(),
    status: 'in_progress',
    destination: params.destination,
    sourceName: params.sourceName,
    targetName: params.targetName,
    totalItems: params.totalItems,
    completedItems: 0,
    successCount: 0,
    failedCount: 0,
    items: params.items?.map((name) => ({ name, status: 'pending' })),
    startedAt: Date.now(),
  };

  await saveExportProgress(state);
  await updateBadge(state);

  return state;
}

/**
 * Update export progress for an item
 */
export async function updateExportItem(params: {
  exportId: string;
  itemIndex: number;
  itemName: string;
  success: boolean;
  error?: string;
}): Promise<ExportProgressState | null> {
  const state = await getExportProgress();

  if (!state || state.exportId !== params.exportId) {
    return null;
  }

  state.completedItems += 1;

  if (params.success) {
    state.successCount += 1;
  } else {
    state.failedCount += 1;
  }

  if (state.items && state.items[params.itemIndex]) {
    state.items[params.itemIndex] = {
      name: params.itemName,
      status: params.success ? 'completed' : 'failed',
      error: params.error,
    };
  }

  await saveExportProgress(state);
  await updateBadge(state);

  return state;
}

/**
 * Complete an export session
 */
export async function completeExport(params: {
  exportId: string;
  success: boolean;
  error?: string;
}): Promise<ExportProgressState | null> {
  const state = await getExportProgress();

  if (!state || state.exportId !== params.exportId) {
    return null;
  }

  state.status = params.success ? 'completed' : 'failed';
  state.completedAt = Date.now();
  state.error = params.error;

  await saveExportProgress(state);
  await updateBadge(state);
  // Clearing the badge was previously a side effect of showing the completion
  // notification. It belongs to finishing an export, not to announcing one.
  await clearBadgeAfterDelay();

  return state;
}

/**
 * Update the extension badge based on export state
 */
export async function updateBadge(
  state: ExportProgressState | null
): Promise<void> {
  if (!hasActionApi()) {
    return;
  }

  if (!state || state.status === 'idle') {
    // Not ours to paint: let the badge owner show whatever else is pending.
    await refreshBadge();
    return;
  }

  if (state.status === 'in_progress') {
    // Show progress count
    const progress = `${state.completedItems}/${state.totalItems}`;
    await chrome.action.setBadgeText({ text: progress });
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS.exportInProgress,
    });
    return;
  }

  if (state.status === 'completed') {
    // Show success indicator
    await chrome.action.setBadgeText({ text: '✓' });
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS.exportCompleted,
    });
    return;
  }

  if (state.status === 'failed') {
    // Show failure indicator
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_COLORS.exportFailed,
    });
    return;
  }
}

/**
 * Recompute the badge after a delay, once a completed/failed export has had
 * its linger window. The owner decides what shows next (the pending
 * captured-workout count, or nothing).
 */
export async function clearBadgeAfterDelay(
  delayMs: number = EXPORT_BADGE_LINGER_MS
): Promise<void> {
  setTimeout(() => {
    void refreshBadge();
  }, delayMs);
}

/**
 * Check if there's an active export in progress
 */
export async function isExportInProgress(): Promise<boolean> {
  const state = await getExportProgress();
  return state?.status === 'in_progress';
}

/**
 * Get export progress percentage
 */
export function getProgressPercentage(state: ExportProgressState): number {
  if (state.totalItems === 0) return 0;
  return Math.round((state.completedItems / state.totalItems) * 100);
}

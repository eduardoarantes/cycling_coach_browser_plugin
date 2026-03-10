/**
 * Export Progress Service
 *
 * Manages export state persistence, notifications, and badge updates.
 * Allows exports to continue in background and provides status recovery
 * when the popup is reopened.
 */

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

function hasActionApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.action?.setBadgeText === 'function' &&
    typeof chrome.action?.setBadgeBackgroundColor === 'function'
  );
}

function hasNotificationsApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.notifications?.create === 'function'
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
  await showExportStartNotification(state);

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
  await showExportCompleteNotification(state);

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
    // Clear badge
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (state.status === 'in_progress') {
    // Show progress count
    const progress = `${state.completedItems}/${state.totalItems}`;
    await chrome.action.setBadgeText({ text: progress });
    await chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' }); // Blue
    return;
  }

  if (state.status === 'completed') {
    // Show success indicator
    await chrome.action.setBadgeText({ text: '✓' });
    await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
    return;
  }

  if (state.status === 'failed') {
    // Show failure indicator
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red
    return;
  }
}

/**
 * Clear the badge after a delay (for completed/failed states)
 */
export async function clearBadgeAfterDelay(
  delayMs: number = 5000
): Promise<void> {
  setTimeout(async () => {
    const state = await getExportProgress();
    if (
      hasActionApi() &&
      state &&
      (state.status === 'completed' || state.status === 'failed')
    ) {
      await chrome.action.setBadgeText({ text: '' });
    }
  }, delayMs);
}

/**
 * Show notification when export starts
 */
export async function showExportStartNotification(
  state: ExportProgressState
): Promise<void> {
  if (!hasNotificationsApi()) {
    return;
  }

  const destinationLabel =
    state.destination === 'planmypeak' ? 'PlanMyPeak' : 'Intervals.icu';

  await chrome.notifications.create(state.exportId, {
    type: 'progress',
    iconUrl: '/icons/icon128.png',
    title: 'Export Started',
    message: `Exporting ${state.totalItems} workouts to ${destinationLabel}`,
    progress: 0,
  });
}

/**
 * Update notification progress
 */
export async function updateExportNotification(
  state: ExportProgressState
): Promise<void> {
  if (typeof chrome.notifications?.update !== 'function') {
    return;
  }

  const progress = Math.round((state.completedItems / state.totalItems) * 100);

  try {
    await chrome.notifications.update(state.exportId, {
      progress,
    });
  } catch {
    // Notification may have been dismissed by user
  }
}

/**
 * Show notification when export completes
 */
export async function showExportCompleteNotification(
  state: ExportProgressState
): Promise<void> {
  if (!hasNotificationsApi()) {
    await clearBadgeAfterDelay();
    return;
  }

  const destinationLabel =
    state.destination === 'planmypeak' ? 'PlanMyPeak' : 'Intervals.icu';

  // Clear progress notification
  try {
    await chrome.notifications.clear(state.exportId);
  } catch {
    // Notification may already be cleared
  }

  if (state.status === 'completed') {
    const duration = state.completedAt
      ? Math.round((state.completedAt - state.startedAt) / 1000)
      : 0;

    await chrome.notifications.create(`${state.exportId}_complete`, {
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: 'Export Complete',
      message: `Successfully exported ${state.successCount} workouts to ${destinationLabel} in ${duration}s`,
    });
  } else {
    await chrome.notifications.create(`${state.exportId}_failed`, {
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: 'Export Failed',
      message: state.error || `Failed to export to ${destinationLabel}`,
    });
  }

  // Clear badge after delay
  await clearBadgeAfterDelay();
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

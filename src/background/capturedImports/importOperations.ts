/**
 * Captured-workout import operations: the durable record of a page-driven
 * import.
 *
 * A PlanMyPeak page asks for an import and gets an acknowledgement at once;
 * the work runs here, in the background worker, and the page polls for
 * progress. Everything the page can be told is persisted after every change,
 * so a page that navigates away, a popup that closes, or a worker that is
 * killed mid-run loses nothing that already happened.
 *
 * Per context — one (destination, coach) pair — at most one operation is
 * active, and only the latest finished one is kept. That is the whole
 * history: enough to attach to a running import from a second tab, to recover
 * a run whose acknowledgement was lost, and to show what the last run did,
 * without an unbounded log.
 *
 * Writes go through the captured-workouts lock and bump the shared revision,
 * so a page sees an operation change the same way it sees a capture change.
 */

import { STORAGE_KEYS } from '@/utils/constants';
import {
  bumpCapturedRevision,
  withCapturedWorkoutsLock,
} from '@/services/capturedWorkoutService';
import type {
  CapturedImportBlockedReason,
  CapturedImportState,
  SiteControlCapturedImportError,
  SiteControlCapturedImportRef,
  SiteControlCapturedWorkoutImportStatusResult,
} from '@/types/siteControl.types';
import { logger } from '@/utils/logger';

/** How many per-workout errors an operation keeps. Enough to act on. */
export const MAX_OPERATION_ERRORS = 20;

export interface CapturedImportOperation {
  operationId: string;
  contextId: string;
  coachId: string;
  destination: string;
  state: CapturedImportState;
  blockedReason?: CapturedImportBlockedReason;
  startedAt: number;
  updatedAt: number;
  totalCount: number;
  processedCount: number;
  importedCount: number;
  alreadyPresentCount: number;
  failedCount: number;
  errors: SiteControlCapturedImportError[];
  /** The candidates this run set out to import; captures after it wait. */
  recordKeys: string[];
}

interface ContextOperations {
  active: CapturedImportOperation | null;
  latest: CapturedImportOperation | null;
}

type OperationsStorage = Record<string, ContextOperations>;

// ---------------------------------------------------------------------------
// In-memory liveness
// ---------------------------------------------------------------------------

/**
 * Operations whose run loop is executing in *this* worker instance.
 *
 * Storage says an operation is running; only this set says it actually is.
 * After a worker restart storage still says `running` for a run whose loop
 * died with the old worker, and the difference is what lets the next request
 * mark it interrupted instead of waiting forever for progress.
 */
const liveOperations = new Set<string>();

export function markOperationLive(operationId: string): void {
  liveOperations.add(operationId);
}

export function markOperationDone(operationId: string): void {
  liveOperations.delete(operationId);
}

export function isOperationLive(operationId: string): boolean {
  return liveOperations.has(operationId);
}

export function hasLiveOperation(): boolean {
  return liveOperations.size > 0;
}

/** Test seam. */
export function resetLiveOperations(): void {
  liveOperations.clear();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readAll(): Promise<OperationsStorage> {
  const data = await chrome.storage.local.get(
    STORAGE_KEYS.CAPTURED_IMPORT_OPERATIONS
  );
  const raw = data[STORAGE_KEYS.CAPTURED_IMPORT_OPERATIONS];
  return isRecord(raw) ? (raw as OperationsStorage) : {};
}

async function writeAll(all: OperationsStorage): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CAPTURED_IMPORT_OPERATIONS]: all,
  });
  await bumpCapturedRevision();
}

export async function getContextOperations(
  contextId: string
): Promise<ContextOperations> {
  const all = await readAll();
  return all[contextId] ?? { active: null, latest: null };
}

/** The active or latest operation with this id in this context, or null. */
export async function findOperation(
  contextId: string,
  operationId: string
): Promise<CapturedImportOperation | null> {
  const { active, latest } = await getContextOperations(contextId);
  if (active?.operationId === operationId) return active;
  if (latest?.operationId === operationId) return latest;
  return null;
}

/**
 * Persist an operation. A running one becomes the context's active operation;
 * a finished one becomes its latest and clears the active slot if it held the
 * same id.
 */
export async function saveOperation(
  operation: CapturedImportOperation
): Promise<void> {
  await withCapturedWorkoutsLock(async () => {
    const all = await readAll();
    const current = all[operation.contextId] ?? { active: null, latest: null };

    if (operation.state === 'running') {
      all[operation.contextId] = { ...current, active: operation };
    } else {
      all[operation.contextId] = {
        active:
          current.active?.operationId === operation.operationId
            ? null
            : current.active,
        latest: operation,
      };
    }

    await writeAll(all);
  });
}

/**
 * Mark every operation that storage says is running but no live loop owns as
 * interrupted. Called when the worker starts — a run cannot survive the worker
 * it ran in — and again whenever an active operation turns out to be a ghost.
 */
export async function recoverInterruptedOperations(
  now: number = Date.now()
): Promise<number> {
  return withCapturedWorkoutsLock(async () => {
    const all = await readAll();
    let recovered = 0;

    for (const [contextId, entry] of Object.entries(all)) {
      const active = entry.active;
      if (!active || active.state !== 'running') continue;
      if (isOperationLive(active.operationId)) continue;

      all[contextId] = {
        active: null,
        latest: { ...active, state: 'interrupted', updatedAt: now },
      };
      recovered += 1;
    }

    if (recovered > 0) {
      await writeAll(all);
      logger.warn('Marked interrupted captured-workout imports:', recovered);
    }
    return recovered;
  });
}

// ---------------------------------------------------------------------------
// Shapes for the page
// ---------------------------------------------------------------------------

export function toOperationRef(
  operation: CapturedImportOperation | null
): SiteControlCapturedImportRef | null {
  return operation
    ? { operationId: operation.operationId, state: operation.state }
    : null;
}

export function toOperationStatus(
  operation: CapturedImportOperation
): SiteControlCapturedWorkoutImportStatusResult {
  return {
    operationId: operation.operationId,
    contextId: operation.contextId,
    state: operation.state,
    totalCount: operation.totalCount,
    processedCount: operation.processedCount,
    importedCount: operation.importedCount,
    alreadyPresentCount: operation.alreadyPresentCount,
    failedCount: operation.failedCount,
    ...(operation.blockedReason
      ? { blockedReason: operation.blockedReason }
      : {}),
    errors: operation.errors,
    startedAt: operation.startedAt,
    updatedAt: operation.updatedAt,
  };
}

/** Append an error, keeping the list bounded. */
export function recordOperationError(
  operation: CapturedImportOperation,
  error: SiteControlCapturedImportError
): void {
  if (operation.errors.length < MAX_OPERATION_ERRORS) {
    operation.errors.push(error);
  }
}

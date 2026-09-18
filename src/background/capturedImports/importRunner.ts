/**
 * Run one captured-workout import in the background worker.
 *
 * The page that asked for it has already been answered; from here on the only
 * thing it can do is poll. So every step persists before the next begins, the
 * account is re-verified before every write, and nothing is ever counted
 * twice: an outcome is attributed to a record key exactly once, whichever
 * path reported it.
 *
 * Order of work for one operation:
 *
 *   1. wait for any popup send that is already uploading captures — one import
 *      per account at a time, whichever surface started it;
 *   2. reconcile the snapshot against the destination: an identity already
 *      there is acknowledged as present, never re-uploaded;
 *   3. re-verify the account and destination — a change stops the run;
 *   4. send the missing ones through the shared sender on the direct transport,
 *      which persists each record's outcome right after its POST;
 *   5. finish, or stop as blocked if the account changed mid-batch.
 */

import { PlanMyPeakAdapter } from '@/export/adapters/planMyPeak/PlanMyPeakAdapter';
import {
  createPlanMyPeakLibrary,
  deletePlanMyPeakLibrary,
  deletePlanMyPeakWorkout,
  exportWorkoutsToPlanMyPeakLibrary,
  fetchPlanMyPeakLibraries,
  fetchPlanMyPeakWorkouts,
  fetchPlanMyPeakWorkoutByProviderId,
} from '@/background/api/planMyPeak';
import type { PlanMyPeakTransport } from '@/export/adapters/planMyPeak/transport';
import {
  getCapturedWorkout,
  updateCapturedWorkout,
} from '@/services/capturedWorkoutService';
import {
  acknowledgementFor,
  isImportCandidateFor,
  type CapturedWorkoutRecord,
} from '@/schemas/capturedWorkout.schema';
import {
  capturedProviderWorkoutId,
  sendCapturedRecords,
} from '@/services/capturedWorkoutSender';
import { refreshBadge } from '@/services/badgeService';
import { logger } from '@/utils/logger';
import {
  CapturedWorkoutReconciler,
  type ReconcileCandidate,
} from './reconciler';
import {
  markOperationDone,
  markOperationLive,
  recordOperationError,
  saveOperation,
  type CapturedImportOperation,
} from './importOperations';
import { verifyOperationContext } from './contextGuard';

/**
 * Longest per-workout error the page is told. Messages come from the
 * transformer's skip reasons and PlanMyPeak's own error bodies, both bounded
 * in practice; the cap keeps an unexpected body from arriving verbatim.
 */
export const MAX_ERROR_MESSAGE_LENGTH = 300;

const GENERIC_FAILURE = 'Could not import this workout.';

/** A message safe to hand to the page: non-empty, trimmed, bounded. */
export function safeErrorMessage(message: string | undefined): string {
  const trimmed = message?.trim() ?? '';
  if (trimmed.length === 0) return GENERIC_FAILURE;
  return trimmed.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${trimmed.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`
    : trimmed;
}

/** The one reconciler every request shares, so answers are cached across them. */
export const capturedReconciler = new CapturedWorkoutReconciler({
  lookup: fetchPlanMyPeakWorkoutByProviderId,
});

export function toReconcileCandidate(
  record: CapturedWorkoutRecord
): ReconcileCandidate {
  return {
    key: record.key,
    providerWorkoutId: capturedProviderWorkoutId(record),
    updatedAt: record.updatedAt,
  };
}

/**
 * A popup send that is uploading captures right now, if any.
 *
 * Registered by the message handler around the popup's export so a page-driven
 * run waits for it rather than uploading the same captures alongside it.
 */
let popupSendInFlight: Promise<unknown> | null = null;

export function trackPopupCapturedSend<T>(send: Promise<T>): Promise<T> {
  const tracked = send.finally(() => {
    if (popupSendInFlight === tracked) {
      popupSendInFlight = null;
    }
  });
  popupSendInFlight = tracked;
  return send;
}

export function isPopupCapturedSendInFlight(): boolean {
  return popupSendInFlight !== null;
}

/** Test seam. */
export function resetPopupCapturedSend(): void {
  popupSendInFlight = null;
}

async function waitForPopupSend(): Promise<void> {
  while (popupSendInFlight) {
    try {
      await popupSendInFlight;
    } catch {
      // The popup's own failure is the popup's to report.
    }
  }
}

/**
 * The adapter's transport for a background run: the API client directly,
 * with the upload loop told to re-verify the account before every POST and
 * to report each outcome as it lands.
 */
function directTransport(
  operation: CapturedImportOperation,
  onItemResult: (result: {
    providerWorkoutId: string;
    name: string;
    success: boolean;
    error?: string;
  }) => Promise<void>
): PlanMyPeakTransport {
  return {
    getLibraries: fetchPlanMyPeakLibraries,
    createLibrary: (name) => createPlanMyPeakLibrary(name),
    deleteLibrary: deletePlanMyPeakLibrary,
    getWorkouts: fetchPlanMyPeakWorkouts,
    deleteWorkout: deletePlanMyPeakWorkout,
    uploadWorkouts: (workouts, libraryId, capturedKeys) =>
      exportWorkoutsToPlanMyPeakLibrary(workouts, libraryId, {
        capturedKeys,
        // The popup's export progress badge is one slot; a page-driven run
        // must not clobber a popup export that may be running alongside.
        trackProgress: false,
        onItemResult,
        shouldContinue: async () => {
          const verdict = await verifyOperationContext(operation);
          return verdict.ok
            ? { ok: true }
            : {
                ok: false,
                reason:
                  'Import stopped before this workout: the PlanMyPeak account or destination changed.',
              };
        },
      }),
  };
}

function withTouched(
  operation: CapturedImportOperation,
  now: () => number
): CapturedImportOperation {
  operation.updatedAt = now();
  return operation;
}

/**
 * Run the operation to completion. Never throws: every failure is recorded on
 * the operation, which is what the page reads.
 */
export async function runCapturedImport(
  operation: CapturedImportOperation,
  deps: { now?: () => number; reconciler?: CapturedWorkoutReconciler } = {}
): Promise<CapturedImportOperation> {
  const now = deps.now ?? (() => Date.now());
  const reconciler = deps.reconciler ?? capturedReconciler;
  markOperationLive(operation.operationId);

  // Every record key is attributed to exactly one outcome.
  const processed = new Set<string>();
  const persist = async (): Promise<void> => {
    await saveOperation(withTouched(operation, now));
  };
  const countOutcome = (
    key: string,
    outcome: 'imported' | 'already_present' | 'failed',
    error?: { title: string; message: string }
  ): void => {
    if (processed.has(key)) return;
    processed.add(key);
    operation.processedCount += 1;
    if (outcome === 'imported') operation.importedCount += 1;
    else if (outcome === 'already_present') operation.alreadyPresentCount += 1;
    else {
      operation.failedCount += 1;
      if (error) {
        recordOperationError(operation, {
          title: error.title,
          message: safeErrorMessage(error.message),
        });
      }
    }
  };

  try {
    await waitForPopupSend();

    // Load the snapshot afresh: a record may have been dismissed, removed or
    // sent from the popup since the page asked.
    const records: CapturedWorkoutRecord[] = [];
    for (const key of operation.recordKeys) {
      const record = await getCapturedWorkout(key);
      const owner = {
        coachId: operation.coachId,
        destination: operation.destination,
      };
      if (!record) {
        countOutcome(key, 'failed', {
          title: '',
          message: 'This workout is no longer in the extension.',
        });
        continue;
      }
      if (acknowledgementFor(record, owner) !== undefined) {
        countOutcome(key, 'already_present');
        continue;
      }
      if (!isImportCandidateFor(record, owner)) {
        countOutcome(key, 'failed', {
          title: record.workout.title,
          message:
            record.status === 'dismissed'
              ? 'This workout was dismissed in the extension.'
              : 'This workout is no longer importable from the extension.',
        });
        continue;
      }
      records.push(record);
    }
    await persist();

    // Reconcile before writing: a race with another importer, or a run that
    // was interrupted after its POST landed, leaves identities already there.
    reconciler.invalidate(operation.contextId);
    const outcome = await reconciler.reconcile(
      operation.contextId,
      records.map(toReconcileCandidate)
    );

    // The lookups ran under whatever session the extension holds *now*. Before
    // any answer is written against this operation's account, confirm that is
    // still the session: a positive answer from another coach's library, or
    // another destination, must not mark a capture present here.
    const contextAfterScan = await verifyOperationContext(operation);
    if (!contextAfterScan.ok) {
      reconciler.invalidate(operation.contextId);
      operation.state = 'blocked';
      operation.blockedReason = contextAfterScan.reason;
      await persist();
      return operation;
    }

    const missing: CapturedWorkoutRecord[] = [];
    for (const record of records) {
      const failure = outcome.failures.get(record.key);
      if (failure !== undefined) {
        countOutcome(record.key, 'failed', {
          title: record.workout.title,
          message: `Could not check whether this workout already exists: ${failure}`,
        });
        continue;
      }
      const answer = outcome.answers.get(record.key);
      if (answer?.present) {
        await updateCapturedWorkout(record.key, {
          status: 'sent',
          planMyPeakWorkoutId: answer.workout.id,
          planMyPeakLibraryName: answer.workout.library.name,
          acknowledge: {
            coachId: operation.coachId,
            destination: operation.destination,
            reason: 'already_present',
            planMyPeakWorkoutId: answer.workout.id,
            libraryName: answer.workout.library.name,
          },
        });
        countOutcome(record.key, 'already_present');
        continue;
      }
      missing.push(record);
    }
    await persist();

    const verdict = await verifyOperationContext(operation);
    if (!verdict.ok) {
      operation.state = 'blocked';
      operation.blockedReason = verdict.reason;
      await persist();
      return operation;
    }

    if (missing.length > 0) {
      const keyByProviderId = new Map(
        missing.map((record) => [capturedProviderWorkoutId(record), record])
      );
      let stopped = false;

      const summary = await sendCapturedRecords(missing, {
        adapter: new PlanMyPeakAdapter(
          directTransport(operation, async (result) => {
            const record = keyByProviderId.get(result.providerWorkoutId);
            if (!record) return;
            if (result.success) {
              countOutcome(record.key, 'imported');
            } else {
              stopped ||= result.error?.startsWith('Import stopped') ?? false;
              countOutcome(record.key, 'failed', {
                title: record.workout.title,
                message: result.error ?? 'Upload failed',
              });
            }
            await persist();
          })
        ),
        recordSkip: async (key, reason) => {
          await updateCapturedWorkout(key, { lastSendError: reason });
        },
      });

      // Outcomes the upload loop did not report item by item: transform-time
      // skips, and run-level failures where nothing was attempted.
      for (const record of missing) {
        const item = summary.outcomes[record.key];
        if (!item || processed.has(record.key)) continue;
        if (item.status === 'sent') {
          countOutcome(record.key, 'imported');
        } else {
          countOutcome(record.key, 'failed', {
            title: record.workout.title,
            message: item.error ?? 'Could not import this workout.',
          });
        }
      }

      if (stopped) {
        operation.state = 'blocked';
        operation.blockedReason = 'account_changed';
        await persist();
        return operation;
      }
    }

    operation.state = 'completed';
    await persist();
    return operation;
  } catch (error) {
    // A thrown error is a bug in this loop, not an outcome for the coach; the
    // run is reported as interrupted so it can be retried.
    logger.error('Captured-workout import failed unexpectedly:', error);
    operation.state = 'interrupted';
    // Whatever was thrown is for the log, not the page: a raw exception string
    // is not a coach-facing reason.
    recordOperationError(operation, {
      title: '',
      message: 'The import stopped unexpectedly. Try again.',
    });
    await persist();
    return operation;
  } finally {
    markOperationDone(operation.operationId);
    reconciler.invalidate(operation.contextId);
    await refreshBadge();
  }
}

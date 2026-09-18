/**
 * The three captured-workout requests a PlanMyPeak page may make.
 *
 * Each one resolves the account from the extension's own stored state and
 * refuses anything the page asserts that does not match. A page gets counts,
 * handles and progress — never a capture, an athlete id, a credential, or a
 * way to act as a different coach.
 */

import { getPlanMyPeakAppUrl } from '@/services/planMyPeakConfigService';
import { isPlanMyPeakControlOrigin } from '@/utils/constants';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/schemas/siteControl.schema';
import type {
  SiteControlCapturedWorkoutSummaryResult,
  SiteControlGetCapturedWorkoutImportStatusPayload,
  SiteControlImportMissingWorkoutsPayload,
  SiteControlImportMissingWorkoutsResult,
  SiteControlResponse,
} from '@/types/siteControl.types';
import {
  getCapturedRevision,
  getPendingCapturedCount,
  getUnlinkedCapturedCount,
  listImportCandidates,
  updateCapturedWorkout,
} from '@/services/capturedWorkoutService';
import type { CaptureContext } from '@/services/planMyPeakIdentityService';
import { fetchUser } from '@/background/api/trainingPeaks';
import { fetchPlanMyPeakCoach } from '@/background/api/planMyPeak';
import { getCoachTrainingPeaksExternalId } from '@/schemas/planMyPeakApi.schema';
import {
  accountMatchBlocksImport,
  resolveAccountMatch,
} from '@/utils/accountMatch';
import { logger } from '@/utils/logger';
import { resolveRequestContext } from './contextGuard';
import {
  findOperation,
  getContextOperations,
  hasLiveOperation,
  isOperationLive,
  markOperationDone,
  markOperationLive,
  recoverInterruptedOperations,
  saveOperation,
  toOperationRef,
  toOperationStatus,
  type CapturedImportOperation,
} from './importOperations';
import {
  capturedReconciler,
  isPopupCapturedSendInFlight,
  runCapturedImport,
  toReconcileCandidate,
} from './importRunner';

/**
 * How long a summary waits for reconciliation before answering `checking`.
 *
 * The page gives the request 5 seconds; answering inside that with an honest
 * "still checking" beats a timeout the page can only read as a broken
 * extension. The scan keeps running and the next poll reads its cache.
 */
export const SUMMARY_RECONCILE_BUDGET_MS = 2500;

/** Whether any captured-workout import is running, from either surface. */
export async function isSiteControlCapturedImportActive(): Promise<boolean> {
  return hasLiveOperation() || isPopupCapturedSendInFlight();
}

async function contextRefs(
  contextId: string
): Promise<
  Pick<
    SiteControlCapturedWorkoutSummaryResult,
    'activeOperation' | 'latestOperation'
  >
> {
  // A run that storage still calls active but no live loop owns died with a
  // previous worker; say so before the page waits on it.
  await recoverInterruptedOperations();
  const { active, latest } = await getContextOperations(contextId);
  return {
    activeOperation: toOperationRef(active),
    latestOperation: toOperationRef(latest ?? active),
  };
}

function blockedSummary(
  reason: SiteControlCapturedWorkoutSummaryResult['blockedReason'],
  coachId: string | null,
  revision: number,
  unlinkedCount: number,
  pendingCount: number
): SiteControlCapturedWorkoutSummaryResult {
  return {
    pendingCount,
    contextId: null,
    coachId,
    revision,
    state: 'blocked',
    missingCount: null,
    unlinkedCount,
    blockedReason: reason,
    activeOperation: null,
    latestOperation: null,
  };
}

/**
 * GET_CAPTURED_WORKOUT_SUMMARY.
 *
 * Reconciles the page's candidates against the destination within a bounded
 * budget. An identity found there is acknowledged and marked sent, so it
 * leaves the count for good; an identity not found is missing; a lookup that
 * fails is an error, never a zero.
 */
export async function handleCapturedWorkoutSummary(
  requestId: string,
  origin: string | null | undefined
): Promise<SiteControlResponse> {
  // Local availability may outlive auth, but never the configured origin gate.
  if (
    !origin ||
    !isPlanMyPeakControlOrigin(origin) ||
    origin !== (await getPlanMyPeakAppUrl())
  ) {
    return createErrorResponse(requestId, {
      code: 'FORBIDDEN_ORIGIN',
      message: 'Captured workouts are unavailable for this destination.',
    });
  }
  const [revision, unlinkedCount, pendingCount] = await Promise.all([
    getCapturedRevision(),
    getUnlinkedCapturedCount(),
    getPendingCapturedCount(),
  ]);

  const resolution = await resolveRequestContext(origin);
  if (!resolution.ok) {
    return createSuccessResponse(
      requestId,
      blockedSummary(
        resolution.reason,
        resolution.coachId,
        revision,
        unlinkedCount,
        pendingCount
      )
    );
  }

  const context = resolution.context;
  const owner = { coachId: context.coachId, destination: context.destination };
  const candidates = await listImportCandidates(owner);
  const refs = await contextRefs(context.contextId);

  const base = {
    contextId: context.contextId,
    coachId: context.coachId,
    pendingCount,
    revision,
    unlinkedCount,
    ...refs,
  };

  if (candidates.length === 0) {
    return createSuccessResponse(requestId, {
      ...base,
      state: 'ready',
      missingCount: 0,
    } satisfies SiteControlCapturedWorkoutSummaryResult);
  }

  const reconciliation = capturedReconciler.reconcile(
    context.contextId,
    candidates.map(toReconcileCandidate)
  );
  const outcome = await Promise.race([
    reconciliation,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SUMMARY_RECONCILE_BUDGET_MS)
    ),
  ]);

  if (outcome === null) {
    // Still scanning: the run continues and fills the cache for the next poll.
    void reconciliation.catch((error) => {
      logger.warn('Background reconciliation failed:', error);
    });
    return createSuccessResponse(requestId, {
      ...base,
      state: 'checking',
      missingCount: null,
    } satisfies SiteControlCapturedWorkoutSummaryResult);
  }

  if (!outcome.complete) {
    return createSuccessResponse(requestId, {
      ...base,
      state: 'blocked',
      blockedReason: 'lookup_failed',
      missingCount: null,
    } satisfies SiteControlCapturedWorkoutSummaryResult);
  }

  // The lookups ran under whatever session the extension holds *now*. Before
  // their answers are written against `context`, confirm the session is still
  // that one; otherwise a workout found in another coach's library, or on
  // another destination, would be acknowledged as present here.
  const recheck = await resolveRequestContext(origin);
  if (
    !recheck.ok ||
    recheck.context.coachId !== context.coachId ||
    recheck.context.destination !== context.destination
  ) {
    capturedReconciler.invalidate(context.contextId);
    return createSuccessResponse(
      requestId,
      blockedSummary(
        'account_changed',
        null,
        revision,
        unlinkedCount,
        pendingCount
      )
    );
  }

  let missingCount = 0;
  for (const record of candidates) {
    const answer = outcome.answers.get(record.key);
    if (!answer) continue;
    if (!answer.present) {
      missingCount += 1;
      continue;
    }
    await updateCapturedWorkout(record.key, {
      status: 'sent',
      planMyPeakWorkoutId: answer.workout.id,
      planMyPeakLibraryName: answer.workout.library.name,
      acknowledge: {
        ...owner,
        reason: 'already_present',
        planMyPeakWorkoutId: answer.workout.id,
        libraryName: answer.workout.library.name,
      },
    });
  }

  return createSuccessResponse(requestId, {
    ...base,
    // Acknowledging present ones is a write, so the revision moved.
    revision: await getCapturedRevision(),
    pendingCount: await getPendingCapturedCount(),
    state: 'ready',
    missingCount,
  } satisfies SiteControlCapturedWorkoutSummaryResult);
}

/**
 * The production TrainingPeaks/PlanMyPeak account rule, as the popup and the
 * overlay apply it. A lookup that fails leaves the status unknown, which does
 * not block: the destination account is protected by the coach gate.
 */
async function accountMismatchBlocks(
  context: CaptureContext
): Promise<boolean> {
  if (context.environment !== 'production') {
    return false;
  }
  const [user, coach] = await Promise.all([
    fetchUser(),
    fetchPlanMyPeakCoach(),
  ]);
  const status = resolveAccountMatch({
    environment: context.environment,
    tpUserId: user.success ? String(user.data.userId) : null,
    linkedTpId: coach.success
      ? getCoachTrainingPeaksExternalId(coach.data)
      : null,
    coachKnown: coach.success,
  });
  return accountMatchBlocksImport(status);
}

function ackFor(
  operation: CapturedImportOperation
): SiteControlImportMissingWorkoutsResult {
  switch (operation.state) {
    case 'running':
      return { operationId: operation.operationId, state: 'running' };
    case 'completed':
      return { operationId: operation.operationId, state: 'completed' };
    case 'blocked':
      return {
        operationId: operation.operationId,
        state: 'blocked',
        blockedReason: operation.blockedReason ?? 'account_changed',
      };
    case 'interrupted':
      // Only reachable for a ref the caller decided not to retry.
      return {
        operationId: operation.operationId,
        state: 'blocked',
        blockedReason: 'account_changed',
      };
  }
}

/**
 * Starts are decided one at a time. "Is a run already live?" and "make this
 * one live" are separated by storage awaits, so two starts arriving together
 * — a second tab, a double click — would both see no live run and both begin.
 * Queued, the second finds the first live and attaches to it.
 */
let importStartQueue: Promise<unknown> = Promise.resolve();

function serializeImportStart<T>(fn: () => Promise<T>): Promise<T> {
  const run = importStartQueue.then(fn, fn);
  importStartQueue = run.catch(() => undefined);
  return run;
}

/**
 * IMPORT_MISSING_WORKOUTS.
 *
 * Idempotent by operation id, serialized per context: a repeated id names the
 * same run, a second start while one is active attaches to it, and an
 * interrupted run asked for again by its own id is retried under that id.
 */
export async function handleImportMissingWorkouts(
  requestId: string,
  payload: SiteControlImportMissingWorkoutsPayload,
  origin: string | null | undefined
): Promise<SiteControlResponse> {
  const blocked = (
    reason: SiteControlImportMissingWorkoutsResult['blockedReason']
  ): SiteControlResponse =>
    createSuccessResponse(requestId, {
      operationId: payload.operationId,
      state: 'blocked',
      blockedReason: reason,
    } satisfies SiteControlImportMissingWorkoutsResult);

  const resolution = await resolveRequestContext(origin);
  if (!resolution.ok) {
    return blocked(resolution.reason);
  }
  const context = resolution.context;
  if (context.contextId !== payload.contextId) {
    return blocked('stale_context');
  }
  if (await accountMismatchBlocks(context)) {
    return blocked('account_mismatch');
  }

  return serializeImportStart(async () => {
    await recoverInterruptedOperations();
    const { active, latest } = await getContextOperations(context.contextId);

    if (active && isOperationLive(active.operationId)) {
      return createSuccessResponse(requestId, ackFor(active));
    }

    if (latest?.operationId === payload.operationId) {
      if (latest.state !== 'interrupted') {
        return createSuccessResponse(requestId, ackFor(latest));
      }
      // A retry of an interrupted run, under its own id: what already landed is
      // acknowledged on the records, so the new run re-reconciles and only
      // uploads what is still missing.
    }

    const owner = {
      coachId: context.coachId,
      destination: context.destination,
    };
    const candidates = await listImportCandidates(owner);
    const now = Date.now();
    const operation: CapturedImportOperation = {
      operationId: payload.operationId,
      contextId: context.contextId,
      coachId: context.coachId,
      destination: context.destination,
      state: candidates.length === 0 ? 'completed' : 'running',
      startedAt: now,
      updatedAt: now,
      totalCount: candidates.length,
      processedCount: 0,
      importedCount: 0,
      alreadyPresentCount: 0,
      failedCount: 0,
      errors: [],
      recordKeys: candidates.map((record) => record.key),
    };
    if (operation.state === 'running') {
      // Live before it is stored as running: a recovery pass from a concurrent
      // summary or status request must never find it running and unowned.
      markOperationLive(operation.operationId);
    }
    try {
      await saveOperation(operation);
    } catch (error) {
      markOperationDone(operation.operationId);
      throw error;
    }

    if (operation.state === 'running') {
      // Detached on purpose: the page is answered now and polls for the rest.
      void runCapturedImport(operation);
    }

    return createSuccessResponse(requestId, ackFor(operation));
  });
}

/** GET_CAPTURED_WORKOUT_IMPORT_STATUS. */
export async function handleCapturedWorkoutImportStatus(
  requestId: string,
  payload: SiteControlGetCapturedWorkoutImportStatusPayload,
  origin: string | null | undefined
): Promise<SiteControlResponse> {
  const resolution = await resolveRequestContext(origin);
  if (!resolution.ok) {
    return createErrorResponse(requestId, {
      code: resolution.reason === 'signed_out' ? 'AUTH_REQUIRED' : 'API_ERROR',
      message: `Cannot read the import status: ${describeReason(resolution.reason)}`,
    });
  }
  if (resolution.context.contextId !== payload.contextId) {
    return createErrorResponse(requestId, {
      code: 'INVALID_REQUEST',
      message:
        'The import belongs to a different PlanMyPeak account or destination than the extension is using now.',
    });
  }

  await recoverInterruptedOperations();
  const operation = await findOperation(payload.contextId, payload.operationId);
  if (!operation) {
    return createErrorResponse(requestId, {
      code: 'INVALID_REQUEST',
      message: 'Unknown import operation.',
    });
  }

  return createSuccessResponse(requestId, toOperationStatus(operation));
}

function describeReason(
  reason: NonNullable<SiteControlCapturedWorkoutSummaryResult['blockedReason']>
): string {
  switch (reason) {
    case 'lookup_failed':
      return 'the destination library could not be checked.';
    case 'connection_disabled':
      return 'the PlanMyPeak connection is switched off in the extension.';
    case 'signed_out':
      return 'the extension is not signed in to PlanMyPeak.';
    case 'account_unknown':
      return 'the extension could not confirm its PlanMyPeak account.';
    case 'destination_mismatch':
      return 'this page is not the PlanMyPeak site the extension is configured for.';
    case 'account_mismatch':
      return 'the TrainingPeaks and PlanMyPeak accounts do not match.';
    case 'stale_context':
    case 'account_changed':
      return 'the PlanMyPeak account or destination changed.';
  }
}

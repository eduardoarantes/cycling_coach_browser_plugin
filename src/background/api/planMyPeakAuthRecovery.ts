/**
 * PlanMyPeak credential resolution and recovery (background only).
 *
 * Two operations, deliberately separate:
 *
 * - **Passive** ({@link resolveCredential}) answers from stored state alone. It
 *   never refreshes and never opens a tab, so it is safe behind the
 *   site-control handshake, the captured-import summary and status requests,
 *   and anything a page can trigger.
 * - **Active** ({@link recoverForRun}) may obtain a replacement by refreshing
 *   in a background tab. It requires a run handle, which only explicit work
 *   the coach started can hold — in this change, the popup export.
 *
 * A run bounds recovery for one piece of work. Once recovery fails inside a
 * run, the run is latched: every later request in it fails at once, attempts
 * nothing and opens no tab. Other runs are unaffected, and a retry begins a
 * new run with a clean state. Runs are minted here, so a caller cannot invent
 * one, and they expire when idle, so a surface that disappears cannot leave a
 * latched run behind to refuse the coach's next attempt.
 *
 * Recovery counts as successful only when the API accepts the credential.
 * A refresh that merely wrote a token to storage is capture, not acceptance;
 * the request policy in `planMyPeak.ts` latches the run when the retried
 * request is rejected too.
 */

import {
  isConfirmedEnvironmentMismatch,
  isStoredCredentialStale,
  readPlanMyPeakCredential,
  removePlanMyPeakCredentialIf,
} from '@/background/api/planMyPeakCredential';
import { refreshProviderAuth } from '@/services/authRefreshService';
import { getPlanMyPeakEnvironment } from '@/services/planMyPeakConfigService';
import { logger } from '@/utils/logger';

export type PlanMyPeakAuthFailureReason =
  | 'sign_in_required'
  | 'environment_mismatch';

export interface PassiveCredential {
  usable: boolean;
  token: string | null;
}

export type RecoveryResult =
  | { ok: true; token: string }
  | {
      ok: false;
      terminal: true;
      reason: PlanMyPeakAuthFailureReason;
      /** Whether this attempt opened a sign-in tab. False when latched or cooling down. */
      tabOpened: boolean;
    };

export interface AuthRun {
  readonly id: string;
}

/** A run unused for this long is forgotten, latched or not. */
export const AUTH_RUN_IDLE_TTL_MS = 15 * 60 * 1000;

/**
 * After a failed recovery, other runs do not open another tab for this long.
 * A secondary guard against unrelated bursts only: the per-run latch is what
 * bounds a batch. A coach who signs in meanwhile is not held back by it,
 * because a usable stored credential is returned before any refresh.
 */
export const AUTH_RECOVERY_COOLDOWN_MS = 10_000;

interface RunState {
  latched: PlanMyPeakAuthFailureReason | null;
  /**
   * A run gets one refresh. Whether it was used before the first request (the
   * stored credential was already expired) or after a rejection, a credential
   * it produced that is then rejected ends the run rather than earning it a
   * second tab.
   */
  refreshUsed: boolean;
  lastUsedAt: number;
}

const runs = new Map<string, RunState>();
let lastFailedRecoveryAt: number | null = null;
let inFlightRecovery: Promise<RecoveryResult> | null = null;

function newRunId(): string {
  return crypto.randomUUID();
}

function sweepExpiredRuns(now: number): void {
  for (const [id, state] of runs) {
    if (now - state.lastUsedAt > AUTH_RUN_IDLE_TTL_MS) {
      runs.delete(id);
    }
  }
}

/** Begin a run for explicit work. The id is minted here. */
export function beginAuthRun(): AuthRun {
  const now = Date.now();
  sweepExpiredRuns(now);
  const id = newRunId();
  runs.set(id, { latched: null, refreshUsed: false, lastUsedAt: now });
  return { id };
}

/**
 * The live run for an id a request carried, or null for an unknown or expired
 * one — which the caller then resolves passively.
 */
export function getAuthRun(id: string | null | undefined): AuthRun | null {
  if (!id) {
    return null;
  }

  const now = Date.now();
  sweepExpiredRuns(now);
  const state = runs.get(id);
  if (!state) {
    return null;
  }

  state.lastUsedAt = now;
  return { id };
}

/**
 * Why a run is terminal, or null while it may still make requests. An ended
 * or expired run counts as terminal: nothing may be sent under it any more.
 *
 * Checked before any credential is used, so a credential captured elsewhere
 * after the run failed does not quietly resume it; an explicit retry starts a
 * new run, which may use it.
 */
export function authRunTerminalReason(
  run: AuthRun
): PlanMyPeakAuthFailureReason | null {
  const state = runs.get(run.id);
  if (!state) {
    return 'sign_in_required';
  }
  return state.latched;
}

/** End a run. Idempotent. */
export function endAuthRun(run: AuthRun): void {
  runs.delete(run.id);
}

/** Latch a run as terminally unauthenticated. */
export function latchAuthRun(
  run: AuthRun,
  reason: PlanMyPeakAuthFailureReason
): void {
  const state = runs.get(run.id);
  if (state && state.latched === null) {
    state.latched = reason;
  }
  lastFailedRecoveryAt = Date.now();
}

/** Test seam: forget every run and all recovery state. */
export function resetPlanMyPeakAuthRecovery(): void {
  runs.clear();
  lastFailedRecoveryAt = null;
  inFlightRecovery = null;
}

/**
 * Passive resolution: is the stored credential usable right now?
 *
 * Answers from storage only. Never refreshes, never opens a tab, and never
 * waits on a recovery that is in flight.
 */
export async function resolveCredential(): Promise<PassiveCredential> {
  const [stored, activeEnvironment] = await Promise.all([
    readPlanMyPeakCredential(),
    getPlanMyPeakEnvironment(),
  ]);

  if (stored.token === null) {
    return { usable: false, token: null };
  }

  // A confirmed mismatch is treated as absent: that credential belongs to a
  // deployment the extension is not talking to.
  if (isConfirmedEnvironmentMismatch(stored.environment, activeEnvironment)) {
    return { usable: false, token: null };
  }

  return {
    usable: !isStoredCredentialStale(stored),
    token: stored.token,
  };
}

/**
 * The server rejected `token`. Hand the removal to the credential owner, which
 * leaves a newer credential in place.
 */
export async function reportCredentialRejected(token: string): Promise<void> {
  await removePlanMyPeakCredentialIf(token, 'rejected by PlanMyPeak');
}

async function attemptRecovery(): Promise<RecoveryResult> {
  const refresh = await refreshProviderAuth('planmypeak');

  if (refresh.outcome !== 'refreshed') {
    logger.warn(
      `[PlanMyPeak auth] Recovery did not capture a credential (${refresh.outcome})`
    );
    return {
      ok: false,
      terminal: true,
      reason: 'sign_in_required',
      tabOpened: true,
    };
  }

  // Captured is not accepted: the new credential must still pass the same
  // freshness and environment checks every other credential does.
  const [stored, activeEnvironment] = await Promise.all([
    readPlanMyPeakCredential(),
    getPlanMyPeakEnvironment(),
  ]);

  if (
    stored.token !== null &&
    isConfirmedEnvironmentMismatch(stored.environment, activeEnvironment)
  ) {
    return {
      ok: false,
      terminal: true,
      reason: 'environment_mismatch',
      tabOpened: true,
    };
  }

  if (stored.token === null || isStoredCredentialStale(stored)) {
    return {
      ok: false,
      terminal: true,
      reason: 'sign_in_required',
      tabOpened: true,
    };
  }

  return { ok: true, token: stored.token };
}

/**
 * Active recovery for `run`: return a usable credential, obtaining one if
 * needed.
 *
 * Single-flight: concurrent callers share one attempt, one tab and one result.
 *
 * @param options.rejectedToken the credential a request just had rejected;
 *   a stored credential equal to it is not usable even if it looks fresh.
 */
export async function recoverForRun(
  run: AuthRun,
  options: { rejectedToken?: string } = {}
): Promise<RecoveryResult> {
  const state = runs.get(run.id);
  if (!state) {
    // Ended or expired: nothing may recover under it any more.
    return {
      ok: false,
      terminal: true,
      reason: 'sign_in_required',
      tabOpened: false,
    };
  }
  state.lastUsedAt = Date.now();

  if (state.latched !== null) {
    return {
      ok: false,
      terminal: true,
      reason: state.latched,
      tabOpened: false,
    };
  }

  // A usable credential may already be here: captured by another run's
  // recovery, or by the coach signing in.
  const current = await resolveCredential();
  if (
    current.usable &&
    current.token !== null &&
    current.token !== options.rejectedToken
  ) {
    return { ok: true, token: current.token };
  }

  // Joining an attempt already in flight is sharing it, not a second one.
  if (!inFlightRecovery) {
    const cooling =
      lastFailedRecoveryAt !== null &&
      Date.now() - lastFailedRecoveryAt < AUTH_RECOVERY_COOLDOWN_MS;

    if (state.refreshUsed || cooling) {
      latchAuthRun(run, 'sign_in_required');
      return {
        ok: false,
        terminal: true,
        reason: 'sign_in_required',
        tabOpened: false,
      };
    }

    inFlightRecovery = attemptRecovery().finally(() => {
      inFlightRecovery = null;
    });
  }

  state.refreshUsed = true;
  const result = await inFlightRecovery;

  if (!result.ok) {
    latchAuthRun(run, result.reason);
  }

  return result;
}

/**
 * Which PlanMyPeak coach the extension is acting as, and where.
 *
 * Every captured-workout decision that touches a PlanMyPeak account — who a
 * capture belongs to, which destination it was sent to, whether a page may
 * count it — resolves the account here, from the stored credential, and never
 * from an id supplied by a page or the popup.
 *
 * `null` from any of these means *unknown*. Callers fail closed on it: an
 * unresolved coach is not "probably the same coach".
 */

import { getAuthToken as getPlanMyPeakAuthToken } from '@/services/myPeakAuthService';
import { fetchPlanMyPeakCoach } from '@/background/api/planMyPeak';
import {
  getPlanMyPeakAppUrl,
  getPlanMyPeakEnvironment,
} from '@/services/planMyPeakConfigService';
import type { CapturedWorkoutOwner } from '@/schemas/capturedWorkout.schema';
import type { PlanMyPeakEnvironment } from '@/utils/constants';
import { logger } from '@/utils/logger';

/**
 * How long a coach lookup may take.
 *
 * `PING` is how a page decides whether the extension exists at all, and a page
 * that gets no reply concludes it is not installed. The identity lookup must
 * never be what makes that happen, so it is bounded well inside a page's
 * detection timeout and degrades to `null` rather than delaying the answer.
 */
export const COACH_LOOKUP_TIMEOUT_MS = 1200;

/**
 * Cached coach id, so repeat lookups on the same session do not each hit the
 * network.
 *
 * Keyed by the token it was resolved from, which is what makes it safe: a new
 * or cleared token simply misses, so the cache can never report a coach the
 * extension has stopped acting as. It lives in the service worker only and
 * dies with it.
 */
let cachedCoachId: { token: string; coachId: string } | null = null;

/** Test seam: forget the cached identity. */
export function resetPlanMyPeakIdentityCache(): void {
  cachedCoachId = null;
}

/**
 * Remember a coach id another code path has just resolved for `token`, so a
 * later cache-only read can answer without a network call.
 */
export function primePlanMyPeakIdentity(token: string, coachId: string): void {
  cachedCoachId = { token, coachId };
}

/**
 * The coach id for the current token, from cache only. `null` when nothing
 * has resolved it in this worker's lifetime — unknown, not "no coach".
 */
export async function peekPlanMyPeakCoachId(): Promise<string | null> {
  const token = await getPlanMyPeakAuthToken();
  if (!token || cachedCoachId?.token !== token) {
    return null;
  }
  return cachedCoachId.coachId;
}

/**
 * Resolve which PlanMyPeak coach the extension is currently acting as.
 *
 * Returns `null` whenever the answer is not known for certain — no token, an
 * unreachable API, a timeout, an invalid token.
 */
export async function resolvePlanMyPeakCoachId(
  options: { timeoutMs?: number } = {}
): Promise<string | null> {
  try {
    const token = await getPlanMyPeakAuthToken();
    if (!token) {
      return null;
    }

    if (cachedCoachId?.token === token) {
      return cachedCoachId.coachId;
    }

    const coach = await fetchPlanMyPeakCoach({
      signal: AbortSignal.timeout(options.timeoutMs ?? COACH_LOOKUP_TIMEOUT_MS),
    });

    if (!coach.success) {
      return null;
    }

    cachedCoachId = { token, coachId: coach.data.id };
    return coach.data.id;
  } catch (error) {
    logger.warn('Could not resolve the PlanMyPeak coach id:', error);
    return null;
  }
}

/** The verified account and configured destination, together. */
export interface CaptureContext extends CapturedWorkoutOwner {
  /** Opaque handle for this (destination, coach) pair. See {@link buildContextId}. */
  contextId: string;
  environment: PlanMyPeakEnvironment;
}

/**
 * The account and destination a capture is owned by, or sent to, right now.
 *
 * `null` when the coach cannot be resolved: a capture stored then has no
 * owner, and an import asked for then is refused.
 */
export async function resolveCaptureContext(
  options: { timeoutMs?: number } = {}
): Promise<CaptureContext | null> {
  const coachId = await resolvePlanMyPeakCoachId(options);
  if (coachId === null) {
    return null;
  }

  const [destination, environment] = await Promise.all([
    getPlanMyPeakAppUrl(),
    getPlanMyPeakEnvironment(),
  ]);

  return {
    coachId,
    destination,
    environment,
    contextId: buildContextId({ coachId, destination }),
  };
}

/**
 * Like {@link resolveCaptureContext}, without a network call: the account is
 * taken from the identity cache or reported unknown.
 *
 * For code that runs inside an upload and must not add a request per batch —
 * the popup's send acknowledges captures for the destination when the coach
 * is already known, and otherwise leaves them for the next reconciliation to
 * acknowledge as already present.
 */
export async function peekCaptureContext(): Promise<CaptureContext | null> {
  const coachId = await peekPlanMyPeakCoachId();
  if (coachId === null) {
    return null;
  }

  const [destination, environment] = await Promise.all([
    getPlanMyPeakAppUrl(),
    getPlanMyPeakEnvironment(),
  ]);

  return {
    coachId,
    destination,
    environment,
    contextId: buildContextId({ coachId, destination }),
  };
}

/**
 * Opaque, stable handle for a (destination, coach) pair.
 *
 * Stable so it survives a service-worker restart — operations persisted under
 * it stay addressable — and opaque so a page holds a token it can hand back
 * rather than an account detail it could read. It is *not* authorization: the
 * background re-resolves its own context on every request and compares.
 *
 * FNV-1a over the pair, in two lanes. Not cryptographic and not meant to be;
 * the page already knows its own coach id, so there is nothing to hide from
 * it, only nothing to give it.
 */
export function buildContextId(owner: CapturedWorkoutOwner): string {
  const input = `${owner.destination}\n${owner.coachId}`;
  return `ctx_${fnv1a(input, 0x811c9dc5)}${fnv1a(input, 0x01000193)}`;
}

function fnv1a(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

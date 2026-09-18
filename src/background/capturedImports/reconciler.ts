/**
 * Reconcile captured workouts against what the destination already holds.
 *
 * A capture is *missing* only when the exact provider identity the
 * transformer will write (`cal:{workoutId}` / `cal-sandbox:{workoutId}`) is
 * absent from every library of the coach. That is one lookup per candidate,
 * so this module bounds the cost rather than pretending it is free:
 *
 *   - at most `concurrency` lookups in flight at once;
 *   - one in-flight lookup per identity, shared by concurrent callers;
 *   - an answer is remembered for `ttlMs`, and forgotten as soon as the
 *     capture it was about changes (`updatedAt` moves) or the context it was
 *     resolved under is invalidated.
 *
 * What it never does is guess. A lookup that fails is reported as a failure,
 * and the outcome says the scan is incomplete; a caller that turned that into
 * "zero missing" would hide workouts that are really missing.
 */

import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakWorkoutLibraryItem } from '@/schemas/planMyPeakApi.schema';

export interface ReconcileCandidate {
  key: string;
  providerWorkoutId: string;
  /** The record's `updatedAt`; a change invalidates any cached answer. */
  updatedAt: number;
}

export type ReconcileAnswer =
  | { present: true; workout: PlanMyPeakWorkoutLibraryItem }
  | { present: false };

export interface ReconcileOutcome {
  /** True only when every candidate has an answer. */
  complete: boolean;
  answers: Map<string, ReconcileAnswer>;
  /** Candidates whose lookup failed, with the failure message. */
  failures: Map<string, string>;
}

export interface ReconcilerDeps {
  lookup: (
    providerWorkoutId: string
  ) => Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem | null>>;
  now?: () => number;
  concurrency?: number;
  ttlMs?: number;
}

export const RECONCILE_CONCURRENCY = 4;
export const RECONCILE_TTL_MS = 30_000;

interface CachedAnswer {
  updatedAt: number;
  checkedAt: number;
  answer: ReconcileAnswer;
}

export class CapturedWorkoutReconciler {
  private readonly lookup: ReconcilerDeps['lookup'];
  private readonly now: () => number;
  private readonly concurrency: number;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, Map<string, CachedAnswer>>();
  private readonly inFlight = new Map<
    string,
    Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem | null>>
  >();
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(deps: ReconcilerDeps) {
    this.lookup = deps.lookup;
    this.now = deps.now ?? (() => Date.now());
    this.concurrency = deps.concurrency ?? RECONCILE_CONCURRENCY;
    this.ttlMs = deps.ttlMs ?? RECONCILE_TTL_MS;
  }

  /** Forget every answer for one context, or for all of them. */
  invalidate(contextId?: string): void {
    if (contextId === undefined) {
      this.cache.clear();
      return;
    }
    this.cache.delete(contextId);
  }

  /** Forget the answer for one capture, in every context. */
  invalidateKey(key: string): void {
    for (const answers of this.cache.values()) {
      answers.delete(key);
    }
  }

  /**
   * Answer every candidate, from cache where fresh and from the destination
   * otherwise. Resolves once every candidate has been attempted; a failed
   * lookup is a failure, not an answer.
   */
  async reconcile(
    contextId: string,
    candidates: ReconcileCandidate[]
  ): Promise<ReconcileOutcome> {
    const answers = new Map<string, ReconcileAnswer>();
    const failures = new Map<string, string>();
    const contextCache = this.contextCache(contextId);

    const pending: Promise<void>[] = [];
    for (const candidate of candidates) {
      const cached = contextCache.get(candidate.key);
      if (cached && this.isFresh(cached, candidate)) {
        answers.set(candidate.key, cached.answer);
        continue;
      }

      pending.push(
        this.lookupShared(contextId, candidate.providerWorkoutId).then(
          (result) => {
            if (!result.success) {
              failures.set(candidate.key, result.error.message);
              return;
            }
            const answer: ReconcileAnswer =
              result.data === null
                ? { present: false }
                : { present: true, workout: result.data };
            contextCache.set(candidate.key, {
              updatedAt: candidate.updatedAt,
              checkedAt: this.now(),
              answer,
            });
            answers.set(candidate.key, answer);
          }
        )
      );
    }

    await Promise.all(pending);

    return { complete: failures.size === 0, answers, failures };
  }

  private contextCache(contextId: string): Map<string, CachedAnswer> {
    let answers = this.cache.get(contextId);
    if (!answers) {
      answers = new Map();
      this.cache.set(contextId, answers);
    }
    return answers;
  }

  private isFresh(
    cached: CachedAnswer,
    candidate: ReconcileCandidate
  ): boolean {
    return (
      cached.updatedAt === candidate.updatedAt &&
      this.now() - cached.checkedAt < this.ttlMs
    );
  }

  /** One in-flight lookup per identity per context, shared by every caller. */
  private lookupShared(
    contextId: string,
    providerWorkoutId: string
  ): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem | null>> {
    const inFlightKey = `${contextId}|${providerWorkoutId}`;
    const existing = this.inFlight.get(inFlightKey);
    if (existing) {
      return existing;
    }

    const run = this.withSlot(() => this.lookup(providerWorkoutId)).finally(
      () => {
        this.inFlight.delete(inFlightKey);
      }
    );
    this.inFlight.set(inFlightKey, run);
    return run;
  }

  /** Bounded concurrency: run `fn` once a slot is free. */
  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } catch (error) {
      // A lookup that throws is a failed lookup, not an unanswerable one.
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Lookup failed',
        },
      } as T;
    } finally {
      this.active -= 1;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}

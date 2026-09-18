/** Opportunistic metadata refresh. Never renews auth or opens a tab. */
import { z } from 'zod';
import { fetchPlanMyPeakCoach } from '@/background/api/planMyPeak';
import { backfillCachedCaptureCoach } from '@/services/capturedWorkoutService';
import { resolveCredential } from '@/background/api/planMyPeakAuthRecovery';
import { getPlanMyPeakAppUrl } from '@/services/planMyPeakConfigService';
import { STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';

export const CAPTURE_COACH_REFRESH_INTERVAL_MS = 60_000;
export const CAPTURE_COACH_REFRESH_TIMEOUT_MS = 1200;
const AttemptSchema = z.object({
  fingerprint: z.string(),
  attemptedAt: z.number().finite(),
});
const inFlight = new Map<string, Promise<void>>();

export async function refreshCaptureCoachIfDue(): Promise<void> {
  try {
    const credential = await resolveCredential();
    if (!credential.usable || !credential.token) return;
    const destination = await getPlanMyPeakAppUrl();
    // Persist only a digest for throttling across worker restarts, not a token.
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${destination}\n${credential.token}`)
    );
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    const existing = inFlight.get(fingerprint);
    if (existing) return await existing;

    const run = (async (): Promise<void> => {
      const stored = await chrome.storage.local.get(
        STORAGE_KEYS.CAPTURE_COACH_REFRESH
      );
      const attempt = AttemptSchema.safeParse(
        stored[STORAGE_KEYS.CAPTURE_COACH_REFRESH]
      );
      const now = Date.now();
      if (
        attempt.success &&
        attempt.data.fingerprint === fingerprint &&
        now >= attempt.data.attemptedAt &&
        now - attempt.data.attemptedAt < CAPTURE_COACH_REFRESH_INTERVAL_MS
      )
        return;

      await chrome.storage.local.set({
        [STORAGE_KEYS.CAPTURE_COACH_REFRESH]: { fingerprint, attemptedAt: now },
      });
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          fetchPlanMyPeakCoach({ signal: controller.signal }),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => {
              controller.abort();
              resolve();
            }, CAPTURE_COACH_REFRESH_TIMEOUT_MS);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inFlight.delete(fingerprint));
    inFlight.set(fingerprint, run);
    await run;
  } catch {
    // Identity metadata is best effort and must never fail capture or import.
    logger.warn('Could not refresh capture coach metadata');
  }
}

let workerEnrichment: Promise<void> | null = null;

/**
 * This worker's start-up enrichment: resume any backfill a previous worker
 * left unfinished, then refresh the coach if due. Started once per worker.
 *
 * A promise started at worker load belongs to no event, so the worker may be
 * stopped under it. Handlers that run later await it after their own writes,
 * which ties it to a tracked message lifetime. It never rejects.
 */
export function resumeCaptureCoachEnrichment(): Promise<void> {
  workerEnrichment ??= backfillCachedCaptureCoach().then(() =>
    refreshCaptureCoachIfDue()
  );
  return workerEnrichment;
}

/** Test seam: forget this worker's start-up enrichment. */
export function resetCaptureCoachEnrichment(): void {
  workerEnrichment = null;
}

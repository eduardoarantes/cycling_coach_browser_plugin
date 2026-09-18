/**
 * Owner of the stored PlanMyPeak credential (background only).
 *
 * The credential is observed, never issued to us: the site's own page makes an
 * authenticated request, the interceptor sees it, and the background stores
 * it. Three things write that one slot — a capture, an automatic removal after
 * a rejection, and an automatic removal after a freshness check — and
 * `chrome.storage.local` has no compare-and-swap. So every one of them runs
 * through the single queue here, and a removal only ever removes the credential
 * that was actually judged unusable. A replacement captured between the
 * decision and the removal is left in place.
 *
 * Explicit sign-outs chosen by the coach (switching environment in Settings)
 * are not automatic removals and do not need this queue.
 */

import {
  STORAGE_KEYS,
  isPlanMyPeakEnvironment,
  planMyPeakEnvironmentForAppOrigin,
  type PlanMyPeakEnvironment,
} from '@/utils/constants';
import { isAccessTokenExpired } from '@/utils/jwt';
import { getPlanMyPeakEnvironment } from '@/services/planMyPeakConfigService';
import { logger } from '@/utils/logger';

/** Environment recorded alongside a credential. */
export type RecordedPlanMyPeakEnvironment = PlanMyPeakEnvironment | 'unknown';

export interface StoredPlanMyPeakCredential {
  token: string | null;
  capturedAt: number | null;
  /** Null for a credential stored before environments were recorded. */
  environment: RecordedPlanMyPeakEnvironment | null;
}

const CREDENTIAL_KEYS = [
  STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
  STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
  STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT,
] as const;

let credentialQueue: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` after every previously queued credential write has settled. A
 * rejected `fn` rejects its own caller but does not block later writes.
 */
export function withPlanMyPeakCredentialLock<T>(
  fn: () => Promise<T>
): Promise<T> {
  const run = credentialQueue.then(fn, fn);
  credentialQueue = run.catch(() => undefined);
  return run;
}

/** Read the stored credential. Reads may bypass the queue. */
export async function readPlanMyPeakCredential(): Promise<StoredPlanMyPeakCredential> {
  const data = await chrome.storage.local.get([...CREDENTIAL_KEYS]);
  const token = data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN];
  const capturedAt = data[STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP];
  const environment = data[STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT];

  return {
    token: typeof token === 'string' && token.length > 0 ? token : null,
    capturedAt: typeof capturedAt === 'number' ? capturedAt : null,
    environment:
      environment === 'unknown' ||
      (typeof environment === 'string' && isPlanMyPeakEnvironment(environment))
        ? environment
        : null,
  };
}

/**
 * True only for a *confirmed* mismatch. Unknown or unrecorded environments
 * are usable, so nobody is signed out by the upgrade that started recording
 * them.
 */
export function isConfirmedEnvironmentMismatch(
  recorded: RecordedPlanMyPeakEnvironment | null,
  active: PlanMyPeakEnvironment
): boolean {
  return recorded !== null && recorded !== 'unknown' && recorded !== active;
}

/** Whether a stored credential is past its expiry, by the shared rule. */
export function isStoredCredentialStale(
  credential: StoredPlanMyPeakCredential,
  now: number = Date.now()
): boolean {
  return (
    credential.token === null ||
    isAccessTokenExpired(credential.token, credential.capturedAt, now)
  );
}

export type ObservedAuthOutcome = 'stored' | 'refused' | 'ignored';

/**
 * Store auth details observed on a PlanMyPeak page.
 *
 * The environment comes from the sender's origin, never from the message. A
 * capture from a confirmed *inactive* environment is refused outright rather
 * than stored and rejected later, because by then the single slot would
 * already hold the wrong credential and the coach would be signed out of the
 * one they are using.
 */
export function storeObservedPlanMyPeakAuth(observed: {
  token: string | null | undefined;
  apiKey: string | null | undefined;
  timestamp: number;
  senderOrigin: string | null | undefined;
}): Promise<ObservedAuthOutcome> {
  return withPlanMyPeakCredentialLock(async () => {
    const observedEnvironment = planMyPeakEnvironmentForAppOrigin(
      observed.senderOrigin
    );
    const activeEnvironment = await getPlanMyPeakEnvironment();

    if (
      observedEnvironment !== null &&
      observedEnvironment !== activeEnvironment
    ) {
      logger.info(
        `Ignored PlanMyPeak auth observed on ${observedEnvironment}; the active environment is ${activeEnvironment}`
      );
      return 'refused';
    }

    const payload: Record<string, string | number> = {};

    if (typeof observed.apiKey === 'string' && observed.apiKey.length > 0) {
      payload[STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY] = observed.apiKey;
    }

    if (typeof observed.token === 'string' && observed.token.length > 0) {
      payload[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] = observed.token;
      payload[STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP] = observed.timestamp;
      payload[STORAGE_KEYS.MYPEAK_TOKEN_ENVIRONMENT] =
        observedEnvironment ?? 'unknown';
    }

    if (Object.keys(payload).length === 0) {
      return 'ignored';
    }

    await chrome.storage.local.set(payload);
    return 'stored';
  });
}

async function removeCredentialKeys(reason: string): Promise<void> {
  await chrome.storage.local.remove([...CREDENTIAL_KEYS]);
  logger.warn(`Cleared the stored PlanMyPeak credential: ${reason}`);
}

/**
 * Remove the stored credential only if it is still `judgedToken`, the one a
 * request used and the server rejected. A newer credential is left alone.
 */
export function removePlanMyPeakCredentialIf(
  judgedToken: string,
  reason: string
): Promise<boolean> {
  return withPlanMyPeakCredentialLock(async () => {
    const stored = await readPlanMyPeakCredential();
    if (stored.token === null || stored.token !== judgedToken) {
      return false;
    }

    await removeCredentialKeys(reason);
    return true;
  });
}

/**
 * Remove the stored credential if it is stale. The freshness decision is made
 * inside the queue against whatever is stored at that moment, so a fresh
 * replacement that arrived after a caller judged the old one stale survives.
 */
export function removePlanMyPeakCredentialIfStale(): Promise<boolean> {
  return withPlanMyPeakCredentialLock(async () => {
    const stored = await readPlanMyPeakCredential();
    if (stored.token === null || !isStoredCredentialStale(stored)) {
      return false;
    }

    await removeCredentialKeys('expired');
    return true;
  });
}

/**
 * Whether the extension may act for a PlanMyPeak page right now, and as whom.
 *
 * Applied before a summary is counted, before an import is accepted, and
 * again before every upload inside a running import. The answer is always
 * resolved from the extension's own stored state — connection setting,
 * credential, configured destination — and compared with what the page is,
 * never taken from what the page says.
 */

import { STORAGE_KEYS } from '@/utils/constants';
import { parseConnectionSettings } from '@/schemas/storage.schema';
import { resolveCredential } from '@/background/api/planMyPeakAuthRecovery';
import {
  resolveCaptureContext,
  type CaptureContext,
} from '@/services/planMyPeakIdentityService';
import type { CapturedImportBlockedReason } from '@/types/siteControl.types';
import type { CapturedImportOperation } from './importOperations';

export type ContextResolution =
  | { ok: true; context: CaptureContext }
  | {
      ok: false;
      reason: CapturedImportBlockedReason;
      /** Known even when refused, so a summary can still say who it is about. */
      coachId: string | null;
    };

async function isPlanMyPeakConnectionEnabled(): Promise<boolean> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK,
    STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS,
  ]);
  return parseConnectionSettings(data).isPlanMyPeakEnabled;
}

/**
 * Resolve the account and destination for a request from `origin`.
 *
 * Refusals are ordered from least to most specific so the coach is told the
 * first thing to fix: switch the connection on, sign in, then — only if both
 * hold — that the page is not the configured destination.
 */
export async function resolveRequestContext(
  origin: string | null | undefined
): Promise<ContextResolution> {
  if (!(await isPlanMyPeakConnectionEnabled())) {
    return { ok: false, reason: 'connection_disabled', coachId: null };
  }

  // Passive: answered from stored state, never refreshed, never a tab. A page
  // can reach this, so it must not be able to trigger recovery.
  if (!(await resolveCredential()).usable) {
    return { ok: false, reason: 'signed_out', coachId: null };
  }

  const context = await resolveCaptureContext();
  if (!context) {
    return { ok: false, reason: 'account_unknown', coachId: null };
  }

  if (!origin || origin !== context.destination) {
    return {
      ok: false,
      reason: 'destination_mismatch',
      coachId: context.coachId,
    };
  }

  return { ok: true, context };
}

export type OperationVerdict =
  | { ok: true }
  | { ok: false; reason: CapturedImportBlockedReason };

/**
 * Whether a running operation may keep writing: the extension must still be
 * acting as the coach it started for, on the destination it started for.
 * Anything else — signed out, switched accounts, switched environments — is
 * `account_changed`, and the run stops.
 */
export async function verifyOperationContext(
  operation: Pick<CapturedImportOperation, 'coachId' | 'destination'>
): Promise<OperationVerdict> {
  const resolution = await resolveRequestContext(operation.destination);
  if (!resolution.ok) {
    return { ok: false, reason: 'account_changed' };
  }
  if (resolution.context.coachId !== operation.coachId) {
    return { ok: false, reason: 'account_changed' };
  }
  return { ok: true };
}

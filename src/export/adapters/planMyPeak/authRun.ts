/**
 * PlanMyPeak auth recovery runs, from the surface that starts explicit work.
 *
 * The background mints the run; this side only holds its id, carries it on
 * every request of the export, and ends it on every way out. A run that is
 * never ended (the popup closed mid-export) expires in the background, so an
 * abandoned run cannot refuse the coach's next attempt.
 */

import type {
  BeginPlanMyPeakAuthRunMessage,
  BeginPlanMyPeakAuthRunResult,
  EndPlanMyPeakAuthRunMessage,
} from '@/types';
import { logger } from '@/utils/logger';

/**
 * Ask the background for a run. Resolves to undefined when none could be
 * started, which leaves the export passive — the same behaviour as before runs
 * existed, never worse.
 */
export async function beginPlanMyPeakAuthRun(): Promise<string | undefined> {
  try {
    const result = await chrome.runtime.sendMessage<
      BeginPlanMyPeakAuthRunMessage,
      BeginPlanMyPeakAuthRunResult
    >({ type: 'BEGIN_PLANMYPEAK_AUTH_RUN' });
    return result?.authRunId ?? undefined;
  } catch (error) {
    logger.warn('[PlanMyPeak auth] Could not begin a recovery run:', error);
    return undefined;
  }
}

/** End a run. Safe to call with no id and more than once. */
export function endPlanMyPeakAuthRun(authRunId: string | undefined): void {
  if (!authRunId) {
    return;
  }

  void chrome.runtime
    .sendMessage<EndPlanMyPeakAuthRunMessage>({
      type: 'END_PLANMYPEAK_AUTH_RUN',
      authRunId,
    })
    .catch((error: unknown) => {
      logger.debug('[PlanMyPeak auth] Could not end a recovery run:', error);
    });
}

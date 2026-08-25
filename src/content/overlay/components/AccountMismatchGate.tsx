/**
 * Blocks the import when the signed-in TrainingPeaks account does not match the
 * TrainingPeaks account linked to the extension's PlanMyPeak coach profile.
 *
 * The popup shows the same warning (`AccountMismatchBanner`); the overlay needs
 * it too, because an import started from the page runs the same upload path and
 * would otherwise associate the wrong athletes with no warning at all.
 *
 * Only a confirmed mismatch blocks. A coach with no linked TrainingPeaks
 * account is not flagged, matching the popup: that is a setup state, not
 * evidence of the wrong account.
 */

import type { ReactElement } from 'react';
import type { AccountMatchResult } from '@/hooks/usePlanMyPeakAccountMatch';

export function AccountMismatchGate({
  match,
}: {
  match: AccountMatchResult;
}): ReactElement | null {
  if (match.status !== 'mismatch') {
    return null;
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      <p className="font-semibold">Account mismatch</p>
      <p className="mt-1 text-xs">
        The signed-in TrainingPeaks account
        {match.tpUserName ? ` (${match.tpUserName})` : ''}, ID {match.tpUserId},
        does not match the TrainingPeaks account linked to your PlanMyPeak coach
        profile
        {match.coachName ? ` (${match.coachName})` : ''}, ID {match.linkedTpId}.
        Importing could add workouts to the wrong account, so it is blocked
        until the accounts match.
      </p>
    </div>
  );
}

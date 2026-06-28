/**
 * AccountMismatchBanner
 *
 * Warns the coach when the signed-in TrainingPeaks account does not match the
 * TrainingPeaks account linked to their PlanMyPeak coach profile, since
 * importing in that state could associate the wrong athletes.
 *
 * Renders nothing unless a genuine account mismatch is detected. A coach with
 * no linked TrainingPeaks account is not flagged.
 */

import type { ReactElement } from 'react';
import { AlertTriangle as AlertIcon } from 'lucide-react';
import { usePlanMyPeakAccountMatch } from '@/hooks/usePlanMyPeakAccountMatch';

export function AccountMismatchBanner(): ReactElement | null {
  const { status, tpUserId, linkedTpId, tpUserName, coachName } =
    usePlanMyPeakAccountMatch();

  if (status !== 'mismatch') {
    return null;
  }

  return (
    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3">
      <div className="flex items-start gap-2">
        <AlertIcon
          className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
          aria-hidden="true"
        />
        <div className="min-w-0 text-xs text-red-800">
          <p className="font-semibold">Account mismatch</p>
          <p className="mt-1">
            The signed-in TrainingPeaks account
            {tpUserName ? ` (${tpUserName})` : ''}, ID {tpUserId}, does not
            match the TrainingPeaks account linked to your PlanMyPeak coach
            profile
            {coachName ? ` (${coachName})` : ''}, ID {linkedTpId}. Importing
            could target the wrong athletes.
          </p>
        </div>
      </div>
    </div>
  );
}

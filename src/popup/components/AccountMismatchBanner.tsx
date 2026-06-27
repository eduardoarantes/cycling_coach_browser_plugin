/**
 * AccountMismatchBanner
 *
 * Warns the coach when the signed-in TrainingPeaks account does not match the
 * TrainingPeaks account linked to their PlanMyPeak coach profile. Importing in
 * that state could associate the wrong athletes, so this is a prominent warning.
 *
 * Renders nothing unless both accounts are loaded and a genuine mismatch (or a
 * missing TrainingPeaks link) is detected.
 */

import type { ReactElement } from 'react';
import { AlertTriangle as AlertIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useUser } from '@/hooks/useUser';
import { usePlanMyPeakCoach } from '@/hooks/usePlanMyPeakCoach';
import { getCoachTrainingPeaksExternalId } from '@/schemas/planMyPeakApi.schema';

export function AccountMismatchBanner(): ReactElement | null {
  const { isAuthenticated: isTpAuthenticated } = useAuth();
  const { isAuthenticated: isPlanMyPeakAuthenticated } = useMyPeakAuth();

  const { data: tpUser } = useUser({ enabled: isTpAuthenticated });
  const { data: coach } = usePlanMyPeakCoach({
    enabled: isPlanMyPeakAuthenticated,
  });

  // Need both accounts resolved before we can compare.
  if (!tpUser || !coach) {
    return null;
  }

  const tpUserId = String(tpUser.userId);
  const linkedTpId = getCoachTrainingPeaksExternalId(coach);

  // Accounts match — nothing to warn about.
  if (linkedTpId !== null && linkedTpId === tpUserId) {
    return null;
  }

  const coachName = [coach.firstName, coach.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3">
      <div className="flex items-start gap-2">
        <AlertIcon
          className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
          aria-hidden="true"
        />
        <div className="min-w-0 text-xs text-red-800">
          <p className="font-semibold">Account mismatch</p>
          {linkedTpId === null ? (
            <p className="mt-1">
              Your PlanMyPeak coach account
              {coachName ? ` (${coachName})` : ''} is not linked to a
              TrainingPeaks account. Importing may not associate athletes
              correctly.
            </p>
          ) : (
            <p className="mt-1">
              The signed-in TrainingPeaks account ({tpUser.firstName}{' '}
              {tpUser.lastName}, ID {tpUserId}) does not match the TrainingPeaks
              account linked to your PlanMyPeak coach profile
              {coachName ? ` (${coachName})` : ''}, ID {linkedTpId}. Importing
              could target the wrong athletes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

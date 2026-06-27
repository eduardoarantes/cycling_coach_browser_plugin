/**
 * Compares the signed-in TrainingPeaks account against the TrainingPeaks
 * account linked to the authenticated PlanMyPeak coach profile.
 *
 * Shared by the warning banner and the Groups import button so imports can be
 * blocked when the accounts do not match.
 */

import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useUser } from '@/hooks/useUser';
import { usePlanMyPeakCoach } from '@/hooks/usePlanMyPeakCoach';
import { getCoachTrainingPeaksExternalId } from '@/schemas/planMyPeakApi.schema';

export type AccountMatchStatus =
  | 'matched'
  | 'mismatch'
  | 'not-linked'
  | 'unknown';

export interface AccountMatchResult {
  status: AccountMatchStatus;
  /** True when there is a confirmed problem (mismatch or missing TP link). */
  hasMismatch: boolean;
  tpUserId: string | null;
  linkedTpId: string | null;
  tpUserName: string | null;
  coachName: string | null;
}

function joinName(first?: string | null, last?: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
}

export function usePlanMyPeakAccountMatch(): AccountMatchResult {
  const { isAuthenticated: isTpAuthenticated } = useAuth();
  const { isAuthenticated: isPlanMyPeakAuthenticated } = useMyPeakAuth();

  const { data: tpUser } = useUser({ enabled: isTpAuthenticated });
  const { data: coach } = usePlanMyPeakCoach({
    enabled: isPlanMyPeakAuthenticated,
  });

  if (!tpUser || !coach) {
    return {
      status: 'unknown',
      hasMismatch: false,
      tpUserId: null,
      linkedTpId: null,
      tpUserName: null,
      coachName: null,
    };
  }

  const tpUserId = String(tpUser.userId);
  const linkedTpId = getCoachTrainingPeaksExternalId(coach);
  const tpUserName = joinName(tpUser.firstName, tpUser.lastName);
  const coachName = joinName(coach.firstName, coach.lastName);

  if (linkedTpId === null) {
    return {
      status: 'not-linked',
      hasMismatch: true,
      tpUserId,
      linkedTpId: null,
      tpUserName,
      coachName,
    };
  }

  if (linkedTpId === tpUserId) {
    return {
      status: 'matched',
      hasMismatch: false,
      tpUserId,
      linkedTpId,
      tpUserName,
      coachName,
    };
  }

  return {
    status: 'mismatch',
    hasMismatch: true,
    tpUserId,
    linkedTpId,
    tpUserName,
    coachName,
  };
}

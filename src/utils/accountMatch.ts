/**
 * The TrainingPeaks ↔ PlanMyPeak account-match rule, UI-free.
 *
 * One rule, used by the popup banner, the overlay gate, the New Workouts tab
 * (all through `usePlanMyPeakAccountMatch`) and by the background when a
 * PlanMyPeak page asks it to import captured workouts. A gate that exists on
 * only some surfaces is not a gate, and a rule implemented twice drifts.
 *
 * Enforced against the **production** PlanMyPeak deployment only: staging and
 * local coach accounts are routinely linked to a different (or no)
 * TrainingPeaks account, so there the rule reports `not-enforced` and nothing
 * is blocked.
 */

import type { PlanMyPeakEnvironment } from '@/utils/constants';

export type AccountMatchStatus =
  | 'matched'
  | 'mismatch'
  | 'not-linked'
  | 'unknown'
  /** Comparison skipped: the selected PlanMyPeak environment is not production. */
  | 'not-enforced';

export interface AccountMatchInput {
  environment: PlanMyPeakEnvironment;
  /** The signed-in TrainingPeaks user, or null when not known. */
  tpUserId: string | null;
  /** The TrainingPeaks id linked to the PlanMyPeak coach, or null when not linked. */
  linkedTpId: string | null;
  /** Whether the PlanMyPeak coach profile itself was available. */
  coachKnown: boolean;
}

export function resolveAccountMatch(
  input: AccountMatchInput
): AccountMatchStatus {
  if (input.tpUserId === null || !input.coachKnown) {
    return 'unknown';
  }
  if (input.environment !== 'production') {
    return 'not-enforced';
  }
  if (input.linkedTpId === null) {
    return 'not-linked';
  }
  return input.linkedTpId === input.tpUserId ? 'matched' : 'mismatch';
}

/**
 * Whether a status blocks an import.
 *
 * Only a confirmed mismatch does. `not-linked` is a setup state — a coach with
 * no linked TrainingPeaks account is not the wrong coach — and blocking it
 * would break legitimate first-time imports. `unknown` does not block either:
 * it is the TrainingPeaks side that is unknown here, and the PlanMyPeak coach
 * gate (`coachId`) is what protects the destination account.
 */
export function accountMatchBlocksImport(status: AccountMatchStatus): boolean {
  return status === 'mismatch';
}

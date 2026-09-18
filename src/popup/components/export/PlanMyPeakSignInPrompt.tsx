/**
 * The sign-in action for an export that PlanMyPeak refused for authentication.
 *
 * Rendered in the result modals rather than the export dialog: every export
 * surface closes its dialog once the export ends, so a failure found during
 * library resolution or upload is only ever seen here. Uses the same gate and
 * the same background refresh as the dialog, so the two cannot drift.
 */

import type { ReactElement } from 'react';
import { ConnectionGate } from '@/components/ConnectionGate';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useProviderAuthRefresh } from '@/hooks/useProviderAuthRefresh';
import type { PlanMyPeakAuthFailure } from '@/utils/planMyPeakAuthErrors';
import { PLANMYPEAK_AUTH_MESSAGES } from '@/utils/uiStrings';

export function PlanMyPeakSignInPrompt({
  authFailure,
}: {
  authFailure: PlanMyPeakAuthFailure;
}): ReactElement {
  const refresh = useProviderAuthRefresh('planmypeak');
  const { validateAuth } = useMyPeakAuth();

  const handleSignIn = async (): Promise<void> => {
    await refresh.refresh();
    await validateAuth();
  };

  const explanation =
    authFailure.reason === 'environment_mismatch'
      ? PLANMYPEAK_AUTH_MESSAGES.ENVIRONMENT_MISMATCH
      : PLANMYPEAK_AUTH_MESSAGES.SIGN_IN_REQUIRED;

  return (
    <div className="space-y-2">
      <ConnectionGate
        isTrainingPeaksAuthenticated
        isPlanMyPeakAuthenticated={false}
        isChecking={refresh.isRefreshing}
        onOpenTrainingPeaks={() => undefined}
        onRecheck={() => void handleSignIn()}
        recheckLabel={PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION}
        planMyPeakMessage={explanation}
      />
      {refresh.message && (
        <p role="status" className="text-xs text-gray-600">
          {refresh.message}
        </p>
      )}
    </div>
  );
}

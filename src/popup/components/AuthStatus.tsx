/**
 * AuthStatus component
 *
 * Displays compact authentication status rows for TrainingPeaks and PlanMyPeak.
 */

import type { ReactElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useUser } from '@/hooks/useUser';
import { openTrainingPeaksTab } from '@/utils/trainingPeaksTab';
import { openMyPeakTab } from '@/utils/myPeakTab';
import {
  formatTokenAge,
  buildProviderStatusLabel,
  AUTH_STATUS_STRINGS,
} from '@/utils/uiStrings';
import { AuthRow } from './shared/AuthRow';

export function AuthStatus(): ReactElement {
  const {
    isAuthenticated: isTpAuthenticated,
    isLoading: isTpLoading,
    error: tpError,
    tokenAge: tpTokenAge,
    refreshAuth: refreshTpAuth,
  } = useAuth();
  const { data: user } = useUser({ enabled: isTpAuthenticated });

  const {
    isAuthenticated: isMyPeakAuthenticated,
    isLoading: isMyPeakLoading,
    error: myPeakError,
    tokenAge: myPeakTokenAge,
    refreshAuth: refreshMyPeakAuth,
    validateAuth: validateMyPeakAuth,
  } = useMyPeakAuth();

  const handleTrainingPeaksRefresh = async (): Promise<void> => {
    await openTrainingPeaksTab();
    setTimeout(() => {
      void refreshTpAuth();
    }, 2000);
  };

  const handleMyPeakRefresh = async (): Promise<void> => {
    await openMyPeakTab();
    setTimeout(() => {
      void (async () => {
        await refreshMyPeakAuth();
        await validateMyPeakAuth();
      })();
    }, 2000);
  };

  // Build status labels using centralized string functions
  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : undefined;
  const tpLabel = buildProviderStatusLabel(
    'TrainingPeaks',
    isTpLoading,
    isTpAuthenticated,
    tpError,
    userName
  );

  const tpSubtitle = isTpAuthenticated
    ? `${AUTH_STATUS_STRINGS.TOKEN_AGE_PREFIX} ${formatTokenAge(tpTokenAge)}`
    : AUTH_STATUS_STRINGS.TRAINING_PEAKS.OPEN_TO_CAPTURE;

  const tpTooltip = user
    ? `${user.email}\nTrainingPeaks token obtained ${formatTokenAge(tpTokenAge)}`
    : `TrainingPeaks token obtained ${formatTokenAge(tpTokenAge)}`;

  const myPeakLabel = buildProviderStatusLabel(
    'PlanMyPeak',
    isMyPeakLoading,
    isMyPeakAuthenticated,
    myPeakError
  );

  const myPeakSubtitle = isMyPeakAuthenticated
    ? `${AUTH_STATUS_STRINGS.TOKEN_AGE_PREFIX} ${formatTokenAge(myPeakTokenAge)} ${AUTH_STATUS_STRINGS.PLANMYPEAK.SUPABASE_SUFFIX}`
    : AUTH_STATUS_STRINGS.PLANMYPEAK.OPEN_TO_SIGN_IN;

  const myPeakTooltip = isMyPeakAuthenticated
    ? `PlanMyPeak (localhost:3006) Supabase token obtained ${formatTokenAge(myPeakTokenAge)}`
    : 'PlanMyPeak local auth not detected';

  return (
    <div className="mb-3 space-y-2">
      <AuthRow
        label={tpLabel}
        isLoading={isTpLoading}
        isAuthenticated={isTpAuthenticated}
        error={tpError}
        subtitle={tpSubtitle}
        title={tpTooltip}
        onRefresh={handleTrainingPeaksRefresh}
      />

      <AuthRow
        label={myPeakLabel}
        isLoading={isMyPeakLoading}
        isAuthenticated={isMyPeakAuthenticated}
        error={myPeakError}
        subtitle={myPeakSubtitle}
        title={myPeakTooltip}
        onRefresh={handleMyPeakRefresh}
      />
    </div>
  );
}

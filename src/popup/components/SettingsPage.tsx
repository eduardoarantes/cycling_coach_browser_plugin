import type { ReactElement } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useIntervalsConnection } from '@/hooks/useIntervalsConnection';
import { openMyPeakTab } from '@/utils/myPeakTab';
import { openTrainingPeaksTab } from '@/utils/trainingPeaksTab';
import {
  formatTokenAge,
  buildProviderStatusLabel,
  SETTINGS_STRINGS,
  AUTH_STATUS_STRINGS,
} from '@/utils/uiStrings';
import { IntervalsApiKeyBanner } from './IntervalsApiKeyBanner';
import { AuthRow } from './shared/AuthRow';
import { ErrorBoundary } from './ErrorBoundary';

interface SettingsPageProps {
  isPlanMyPeakEnabled: boolean;
  isIntervalsEnabled: boolean;
  onPlanMyPeakEnabledChange: (enabled: boolean) => Promise<void>;
  onIntervalsEnabledChange: (enabled: boolean) => Promise<void>;
}

interface OptionalConnectionCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  children?: ReactElement;
}

function OptionalConnectionCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: OptionalConnectionCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              void onToggle(event.target.checked);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            {enabled ? SETTINGS_STRINGS.ENABLED : SETTINGS_STRINGS.DISABLED}
          </span>
        </label>
      </div>
      {enabled ? (
        <div className="mt-3">{children}</div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          {SETTINGS_STRINGS.CONNECTION_DISABLED}
        </p>
      )}
    </div>
  );
}

function SettingsPageContent({
  isPlanMyPeakEnabled,
  isIntervalsEnabled,
  onPlanMyPeakEnabledChange,
  onIntervalsEnabledChange,
}: SettingsPageProps): ReactElement {
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

  const {
    isAuthenticated: isIntervalsAuthenticated,
    isLoading: isIntervalsLoading,
    error: intervalsError,
    refresh: refreshIntervals,
  } = useIntervalsConnection();

  const handleTrainingPeaksRefresh = async (): Promise<void> => {
    await openTrainingPeaksTab();
    setTimeout(() => {
      void refreshTpAuth();
    }, 1500);
  };

  const handleMyPeakRefresh = async (): Promise<void> => {
    await openMyPeakTab();
    setTimeout(() => {
      void (async () => {
        await refreshMyPeakAuth();
        await validateMyPeakAuth();
      })();
    }, 1500);
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
    : `${AUTH_STATUS_STRINGS.TRAINING_PEAKS.REQUIRED_PREFIX}${AUTH_STATUS_STRINGS.TRAINING_PEAKS.OPEN_TO_CAPTURE}.`;

  const myPeakLabel = buildProviderStatusLabel(
    'PlanMyPeak',
    isMyPeakLoading,
    isMyPeakAuthenticated,
    myPeakError
  );

  const myPeakSubtitle = isMyPeakAuthenticated
    ? `${AUTH_STATUS_STRINGS.TOKEN_AGE_PREFIX} ${formatTokenAge(myPeakTokenAge)}`
    : `${AUTH_STATUS_STRINGS.PLANMYPEAK.OPEN_TO_SIGN_IN}.`;

  const intervalsLabel = buildProviderStatusLabel(
    'Intervals.icu',
    isIntervalsLoading,
    isIntervalsAuthenticated,
    intervalsError
  );

  const intervalsSubtitle = isIntervalsAuthenticated
    ? AUTH_STATUS_STRINGS.API_KEY_CONFIGURED
    : AUTH_STATUS_STRINGS.INTERVALS.ADD_API_KEY;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">
          {SETTINGS_STRINGS.TITLE}
        </h2>
        <p className="text-xs text-gray-600">{SETTINGS_STRINGS.SUBTITLE}</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-900">
          {SETTINGS_STRINGS.TRAINING_PEAKS_REQUIRED}
        </p>
        <p className="mb-2 text-xs text-blue-800">
          {SETTINGS_STRINGS.TRAINING_PEAKS_DESCRIPTION}
        </p>
        <AuthRow
          label={tpLabel}
          subtitle={tpSubtitle}
          isAuthenticated={isTpAuthenticated}
          isLoading={isTpLoading}
          error={tpError}
          onRefresh={handleTrainingPeaksRefresh}
        />
      </div>

      <OptionalConnectionCard
        title={SETTINGS_STRINGS.PLANMYPEAK_OPTIONAL}
        description={SETTINGS_STRINGS.PLANMYPEAK_DESCRIPTION}
        enabled={isPlanMyPeakEnabled}
        onToggle={onPlanMyPeakEnabledChange}
      >
        <AuthRow
          label={myPeakLabel}
          subtitle={myPeakSubtitle}
          isAuthenticated={isMyPeakAuthenticated}
          isLoading={isMyPeakLoading}
          error={myPeakError}
          onRefresh={handleMyPeakRefresh}
        />
      </OptionalConnectionCard>

      <OptionalConnectionCard
        title={SETTINGS_STRINGS.INTERVALS_OPTIONAL}
        description={SETTINGS_STRINGS.INTERVALS_DESCRIPTION}
        enabled={isIntervalsEnabled}
        onToggle={onIntervalsEnabledChange}
      >
        <div className="space-y-2">
          <AuthRow
            label={intervalsLabel}
            subtitle={intervalsSubtitle}
            isAuthenticated={isIntervalsAuthenticated}
            isLoading={isIntervalsLoading}
            error={intervalsError}
            onRefresh={refreshIntervals}
          />
          <IntervalsApiKeyBanner />
        </div>
      </OptionalConnectionCard>
    </div>
  );
}

/**
 * SettingsPage component wrapped with ErrorBoundary
 *
 * Provides error handling for the settings page to prevent crashes
 * from affecting the entire extension popup.
 */
export function SettingsPage(props: SettingsPageProps): ReactElement {
  return (
    <ErrorBoundary>
      <SettingsPageContent {...props} />
    </ErrorBoundary>
  );
}

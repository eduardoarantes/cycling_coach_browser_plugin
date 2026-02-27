import type { ReactElement } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useIntervalsConnection } from '@/hooks/useIntervalsConnection';
import { openMyPeakTab } from '@/utils/myPeakTab';
import { openTrainingPeaksTab } from '@/utils/trainingPeaksTab';
import { IntervalsApiKeyBanner } from './IntervalsApiKeyBanner';

interface SettingsPageProps {
  isPlanMyPeakEnabled: boolean;
  isIntervalsEnabled: boolean;
  onPlanMyPeakEnabledChange: (enabled: boolean) => Promise<void>;
  onIntervalsEnabledChange: (enabled: boolean) => Promise<void>;
}

interface AuthRowProps {
  label: string;
  subtitle: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => Promise<void>;
}

function formatTokenAge(age: number | null): string {
  if (age === null) return 'Unknown';
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
}

function RefreshIcon(): ReactElement {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function AuthRow({
  label,
  subtitle,
  isAuthenticated,
  isLoading,
  error,
  onRefresh,
}: AuthRowProps): ReactElement {
  const color = isLoading
    ? {
        container: 'bg-gray-50 border-gray-200',
        dot: 'bg-gray-400',
        text: 'text-gray-700',
        subtitle: 'text-gray-600',
        button: 'text-gray-600 hover:text-gray-800',
      }
    : error
      ? {
          container: 'bg-red-50 border-red-200',
          dot: 'bg-red-500',
          text: 'text-red-800',
          subtitle: 'text-red-700',
          button: 'text-red-600 hover:text-red-800',
        }
      : isAuthenticated
        ? {
            container: 'bg-green-50 border-green-200',
            dot: 'bg-green-500',
            text: 'text-green-800',
            subtitle: 'text-green-700',
            button: 'text-green-600 hover:text-green-800',
          }
        : {
            container: 'bg-yellow-50 border-yellow-200',
            dot: 'bg-yellow-500',
            text: 'text-yellow-900',
            subtitle: 'text-yellow-800',
            button: 'text-yellow-700 hover:text-yellow-900',
          };

  return (
    <div className={`rounded-lg border p-2 ${color.container}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {isLoading ? (
            <div className="mt-1 h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <span
              className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${color.dot}`}
            />
          )}
          <div className="min-w-0">
            <p className={`truncate text-xs font-semibold ${color.text}`}>
              {label}
            </p>
            <p className={`text-[11px] ${color.subtitle}`}>{subtitle}</p>
            {error ? (
              <p className="mt-1 text-[11px] text-red-700">{error}</p>
            ) : null}
          </div>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className={`shrink-0 ${color.button}`}
            title={`Refresh ${label}`}
            onClick={() => {
              void onRefresh();
            }}
          >
            <RefreshIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
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
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>
      {enabled ? (
        <div className="mt-3">{children}</div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          Connection disabled. Enable to configure authentication.
        </p>
      )}
    </div>
  );
}

export function SettingsPage({
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

  const tpLabel = isTpLoading
    ? 'TrainingPeaks: Checking...'
    : isTpAuthenticated
      ? `TrainingPeaks: ${(user ? `${user.firstName} ${user.lastName}`.trim() : 'Authenticated').trim()}`
      : 'TrainingPeaks: Not Authenticated';

  const tpSubtitle = isTpAuthenticated
    ? `Token ${formatTokenAge(tpTokenAge)}`
    : 'Required connection. Open TrainingPeaks to capture a token.';

  const myPeakLabel = isMyPeakLoading
    ? 'PlanMyPeak: Checking...'
    : isMyPeakAuthenticated
      ? 'PlanMyPeak: Authenticated'
      : 'PlanMyPeak: Not Authenticated';

  const myPeakSubtitle = isMyPeakAuthenticated
    ? `Token ${formatTokenAge(myPeakTokenAge)}`
    : 'Open localhost:3006 and sign in.';

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Settings</h2>
        <p className="text-xs text-gray-600">Manage provider connections</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-900">
          TrainingPeaks (Required)
        </p>
        <p className="mb-2 text-xs text-blue-800">
          This connection is mandatory for loading workouts and training plans.
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
        title="PlanMyPeak (Optional)"
        description="Enable if you want to export directly to PlanMyPeak."
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
        title="Intervals.icu (Optional)"
        description="Enable if you want Intervals.icu export options."
        enabled={isIntervalsEnabled}
        onToggle={onIntervalsEnabledChange}
      >
        <div className="space-y-2">
          <AuthRow
            label={
              isIntervalsLoading
                ? 'Intervals.icu: Checking...'
                : isIntervalsAuthenticated
                  ? 'Intervals.icu: Connected'
                  : 'Intervals.icu: Not Connected'
            }
            subtitle={
              isIntervalsAuthenticated
                ? 'API key configured'
                : 'Add your Intervals.icu API key below.'
            }
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

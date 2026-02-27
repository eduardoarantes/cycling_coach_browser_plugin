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

/**
 * Format token age for display
 */
const formatTokenAge = (age: number | null): string => {
  if (age === null) return 'Unknown';
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
};

function RefreshIcon(): ReactElement {
  return (
    <svg
      className="w-4 h-4"
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

interface AuthRowProps {
  label: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  subtitle?: string;
  title?: string;
  onRefresh: () => Promise<void>;
}

function AuthRow({
  label,
  isLoading,
  isAuthenticated,
  error,
  subtitle,
  title,
  onRefresh,
}: AuthRowProps): ReactElement {
  const color = isLoading
    ? {
        container: 'bg-gray-100 border-gray-200',
        dot: 'bg-gray-400',
        text: 'text-gray-700',
        button: 'text-gray-600 hover:text-gray-800',
      }
    : error
      ? {
          container: 'bg-red-50 border-red-200',
          dot: 'bg-red-500',
          text: 'text-red-800',
          button: 'text-red-600 hover:text-red-800',
        }
      : isAuthenticated
        ? {
            container: 'bg-green-50 border-green-200',
            dot: 'bg-green-500',
            text: 'text-green-800',
            button: 'text-green-600 hover:text-green-800',
          }
        : {
            container: 'bg-yellow-50 border-yellow-200',
            dot: 'bg-yellow-500',
            text: 'text-yellow-800',
            button: 'text-yellow-600 hover:text-yellow-800',
          };

  return (
    <div className={`p-2 rounded-lg border ${color.container}`} title={title}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          ) : (
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`}
            ></div>
          )}
          <div className="min-w-0">
            <p className={`text-xs font-medium truncate ${color.text}`}>
              {label}
            </p>
            {subtitle ? (
              <p className="text-[11px] text-gray-600 truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => {
            void onRefresh();
          }}
          className={`flex-shrink-0 ${color.button}`}
          title={`Refresh ${label} authentication`}
          aria-label={`Refresh ${label} authentication`}
          type="button"
        >
          <RefreshIcon />
        </button>
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}

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

  const tpLabel = isTpLoading
    ? 'TrainingPeaks: Checking...'
    : isTpAuthenticated
      ? `TrainingPeaks: ${(user ? `${user.firstName} ${user.lastName}`.trim() : 'Authenticated').trim()}`
      : tpError
        ? 'TrainingPeaks: Error'
        : 'TrainingPeaks: Not Authenticated';

  const tpSubtitle = isTpAuthenticated
    ? `Token ${formatTokenAge(tpTokenAge)}`
    : 'Open TrainingPeaks to capture a token';

  const tpTooltip = user
    ? `${user.email}\nTrainingPeaks token obtained ${formatTokenAge(tpTokenAge)}`
    : `TrainingPeaks token obtained ${formatTokenAge(tpTokenAge)}`;

  const myPeakLabel = isMyPeakLoading
    ? 'PlanMyPeak: Checking...'
    : myPeakError
      ? 'PlanMyPeak: Validation Needed'
      : isMyPeakAuthenticated
        ? 'PlanMyPeak: Authenticated'
        : 'PlanMyPeak: Not Authenticated';

  const myPeakSubtitle = isMyPeakAuthenticated
    ? `Token ${formatTokenAge(myPeakTokenAge)} (Supabase)`
    : 'Open localhost:3006 and sign in';

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

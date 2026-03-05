import type { ReactElement } from 'react';
import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useIntervalsConnection } from '@/hooks/useIntervalsConnection';
import { usePortConfig } from '@/hooks/usePortConfig';
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
import {
  IntegrationHelpModal,
  type IntegrationHelpTopic,
} from './IntegrationHelpModal';
import { DebugLogPanel } from './DebugLogPanel';

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
  onOpenHelp: () => void;
  children?: ReactElement;
}

function OptionalConnectionCard({
  title,
  description,
  enabled,
  onToggle,
  onOpenHelp,
  children,
}: OptionalConnectionCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-[11px] font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
              aria-label={`Open ${title} import guide`}
              title={`Open ${title} import guide`}
            >
              ?
            </button>
          </div>
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
  const [activeHelpTopic, setActiveHelpTopic] =
    useState<IntegrationHelpTopic | null>(null);
  const [pendingAppPort, setPendingAppPort] = useState<string | null>(null);
  const [pendingSupabasePort, setPendingSupabasePort] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

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

  const {
    isConfigurable: isPortConfigurable,
    appPort,
    supabasePort,
    setAppPort,
    setSupabasePort,
  } = usePortConfig();

  // Track pending vs saved port values
  const appPortDisplay = pendingAppPort ?? String(appPort);
  const supabasePortDisplay = pendingSupabasePort ?? String(supabasePort);

  // Check if there are unsaved changes
  const hasUnsavedPortChanges =
    pendingAppPort !== null || pendingSupabasePort !== null;

  // Validate port inputs
  const isValidPort = (value: string): boolean => {
    const port = parseInt(value, 10);
    return !isNaN(port) && port > 0 && port < 65536;
  };

  const canSavePorts =
    hasUnsavedPortChanges &&
    isValidPort(appPortDisplay) &&
    isValidPort(supabasePortDisplay);

  const handleSavePorts = async (): Promise<void> => {
    if (!canSavePorts) return;

    setIsSaving(true);
    try {
      const newAppPort = parseInt(appPortDisplay, 10);
      const newSupabasePort = parseInt(supabasePortDisplay, 10);

      await setAppPort(newAppPort);
      await setSupabasePort(newSupabasePort);

      // Clear pending state after successful save
      setPendingAppPort(null);
      setPendingSupabasePort(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Build dynamic host label based on saved port
  const planMyPeakHostLabel = isPortConfigurable
    ? `localhost:${appPort}`
    : 'planmypeak.com';

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
    : `${AUTH_STATUS_STRINGS.PLANMYPEAK.openToSignIn(planMyPeakHostLabel)}.`;

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
      <IntegrationHelpModal
        topic={activeHelpTopic}
        onClose={() => {
          setActiveHelpTopic(null);
        }}
      />

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
        onOpenHelp={() => {
          setActiveHelpTopic('planmypeak');
        }}
      >
        <div className="space-y-2">
          <AuthRow
            label={myPeakLabel}
            subtitle={myPeakSubtitle}
            isAuthenticated={isMyPeakAuthenticated}
            isLoading={isMyPeakLoading}
            error={myPeakError}
            onRefresh={handleMyPeakRefresh}
          />
          {isPortConfigurable && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
              <div className="mb-1.5 text-xs font-medium text-amber-800">
                Local Dev Ports
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label
                    htmlFor="app-port"
                    className="mb-0.5 block text-[10px] text-amber-700"
                  >
                    App Port
                  </label>
                  <input
                    id="app-port"
                    type="number"
                    value={appPortDisplay}
                    onChange={(e) => setPendingAppPort(e.target.value)}
                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="supabase-port"
                    className="mb-0.5 block text-[10px] text-amber-700"
                  >
                    Supabase Port
                  </label>
                  <input
                    id="supabase-port"
                    type="number"
                    value={supabasePortDisplay}
                    onChange={(e) => setPendingSupabasePort(e.target.value)}
                    className="w-full rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    min={1}
                    max={65535}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSavePorts()}
                  disabled={!canSavePorts || isSaving}
                  className="shrink-0 rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </OptionalConnectionCard>

      <OptionalConnectionCard
        title={SETTINGS_STRINGS.INTERVALS_OPTIONAL}
        description={SETTINGS_STRINGS.INTERVALS_DESCRIPTION}
        enabled={isIntervalsEnabled}
        onToggle={onIntervalsEnabledChange}
        onOpenHelp={() => {
          setActiveHelpTopic('intervalsicu');
        }}
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

      <DebugLogPanel />
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

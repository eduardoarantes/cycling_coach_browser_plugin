/**
 * AuthStatus component
 *
 * Displays compact authentication status rows for TrainingPeaks and PlanMyPeak.
 */

import type { ReactElement } from 'react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useUser } from '@/hooks/useUser';
import { usePortConfig } from '@/hooks/usePortConfig';
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

  const {
    isConfigurable: isPortConfigurable,
    appPort,
    supabasePort,
    setAppPort,
    setSupabasePort,
  } = usePortConfig();

  const [appPortInput, setAppPortInput] = useState<string>('');
  const [supabasePortInput, setSupabasePortInput] = useState<string>('');

  // Sync input fields when port config loads
  const appPortDisplay = appPortInput || String(appPort);
  const supabasePortDisplay = supabasePortInput || String(supabasePort);

  // Build dynamic host label based on configured port
  const planMyPeakHostLabel = isPortConfigurable
    ? `localhost:${appPort}`
    : 'planmypeak.com';

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
    ? `PlanMyPeak (${planMyPeakHostLabel}) Supabase token obtained ${formatTokenAge(myPeakTokenAge)}`
    : `PlanMyPeak auth not detected on ${planMyPeakHostLabel}`;

  const handleAppPortChange = async (value: string): Promise<void> => {
    setAppPortInput(value);
    const port = parseInt(value, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      await setAppPort(port);
    }
  };

  const handleSupabasePortChange = async (value: string): Promise<void> => {
    setSupabasePortInput(value);
    const port = parseInt(value, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      await setSupabasePort(port);
    }
  };

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

      {isPortConfigurable && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="mb-1.5 text-xs font-medium text-amber-800">
            Local Dev Ports
          </div>
          <div className="flex gap-2">
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
                onChange={(e) => void handleAppPortChange(e.target.value)}
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
                onChange={(e) => void handleSupabasePortChange(e.target.value)}
                className="w-full rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                min={1}
                max={65535}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

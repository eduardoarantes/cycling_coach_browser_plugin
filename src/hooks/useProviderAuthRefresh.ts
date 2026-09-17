/**
 * Popup-side state for a quiet auth refresh.
 *
 * Wraps the `REFRESH_PROVIDER_AUTH` request so every surface (status rows,
 * settings, the error cards) shows the same "Refreshing…" state and the same
 * terminal message, and none of them needs a timer to guess when the token
 * has arrived: the background answers when it has.
 */

import { useCallback, useState } from 'react';
import type { AuthRefreshProvider, AuthRefreshResult } from '@/types';
import { requestTrainingPeaksAuthRefresh } from '@/utils/trainingPeaksTab';
import { requestPlanMyPeakAuthRefresh } from '@/utils/myPeakTab';
import { AUTH_REFRESH_MESSAGES } from '@/utils/uiStrings';

export type AuthRefreshUiStatus =
  | 'idle'
  | 'refreshing'
  | AuthRefreshResult['outcome'];

export interface UseProviderAuthRefreshReturn {
  status: AuthRefreshUiStatus;
  isRefreshing: boolean;
  /** Human-readable line for the current status, or null when idle. */
  message: string | null;
  /** Run the refresh and resolve with the background's verdict. */
  refresh: () => Promise<AuthRefreshResult>;
  reset: () => void;
}

const REQUESTS: Record<AuthRefreshProvider, () => Promise<AuthRefreshResult>> =
  {
    trainingpeaks: requestTrainingPeaksAuthRefresh,
    planmypeak: requestPlanMyPeakAuthRefresh,
  };

export function useProviderAuthRefresh(
  provider: AuthRefreshProvider
): UseProviderAuthRefreshReturn {
  const [status, setStatus] = useState<AuthRefreshUiStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<AuthRefreshResult> => {
    setStatus('refreshing');
    setError(null);
    const result = await REQUESTS[provider]();
    setStatus(result.outcome);
    setError(result.error ?? null);
    return result;
  }, [provider]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const messages = AUTH_REFRESH_MESSAGES[provider];
  const message =
    status === 'idle'
      ? null
      : status === 'error'
        ? `${messages.error}${error ? ` (${error})` : ''}`
        : messages[status];

  return {
    status,
    isRefreshing: status === 'refreshing',
    message,
    refresh,
    reset,
  };
}

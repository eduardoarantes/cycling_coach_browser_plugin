/**
 * Custom hook for the PlanMyPeak environment selector
 * (production / staging / local).
 *
 * The selection is persisted in chrome.storage and read by the background API
 * client, so switching it changes which PlanMyPeak deployment the extension
 * talks to at runtime. The host label follows the selection, resolving the
 * configured dev port for the local environment.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AVAILABLE_PLANMYPEAK_ENVIRONMENTS,
  DEFAULT_PLANMYPEAK_ENVIRONMENT,
  PLANMYPEAK_ENVIRONMENTS,
  STORAGE_KEYS,
  isAvailablePlanMyPeakEnvironment,
  type PlanMyPeakEnvironment,
} from '@/utils/constants';
import {
  getPlanMyPeakEnvironment,
  setPlanMyPeakEnvironment as savePlanMyPeakEnvironment,
} from '@/services/planMyPeakConfigService';
import { usePortConfig } from '@/hooks/usePortConfig';

export interface UsePlanMyPeakEnvironmentReturn {
  environment: PlanMyPeakEnvironment;
  /** Environments this build can reach, in display order. */
  availableEnvironments: readonly PlanMyPeakEnvironment[];
  /** Host label for the active environment, e.g. `staging.app.planmypeak.com`. */
  hostLabel: string;
  /** Whether the local dev ports apply to the active environment. */
  isLocalEnvironment: boolean;
  isLoading: boolean;
  setEnvironment: (environment: PlanMyPeakEnvironment) => Promise<void>;
}

export function usePlanMyPeakEnvironment(): UsePlanMyPeakEnvironmentReturn {
  const [environment, setEnvironmentState] = useState<PlanMyPeakEnvironment>(
    DEFAULT_PLANMYPEAK_ENVIRONMENT
  );
  const [isLoading, setIsLoading] = useState(true);
  const { appPort } = usePortConfig();

  useEffect(() => {
    void (async () => {
      try {
        setEnvironmentState(await getPlanMyPeakEnvironment());
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setEnvironment = useCallback(async (next: PlanMyPeakEnvironment) => {
    await savePlanMyPeakEnvironment(next);
    setEnvironmentState(next);
  }, []);

  // Keep in sync if another surface changes the environment.
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const change = changes[STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT];
      if (!change) return;

      if (
        typeof change.newValue === 'string' &&
        isAvailablePlanMyPeakEnvironment(change.newValue)
      ) {
        setEnvironmentState(change.newValue);
      } else if (change.newValue === undefined) {
        setEnvironmentState(DEFAULT_PLANMYPEAK_ENVIRONMENT);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const isLocalEnvironment = environment === 'local';
  const hostLabel = isLocalEnvironment
    ? `localhost:${appPort}`
    : PLANMYPEAK_ENVIRONMENTS[environment].hostLabel;

  return {
    environment,
    availableEnvironments: AVAILABLE_PLANMYPEAK_ENVIRONMENTS,
    hostLabel,
    isLocalEnvironment,
    isLoading,
    setEnvironment,
  };
}

/**
 * Custom hook for PlanMyPeak port configuration (local development only)
 *
 * This hook manages the configurable ports for local PlanMyPeak development.
 * In production builds, it returns fixed defaults and setters are no-ops.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_PLANMYPEAK_APP_PORT,
  DEFAULT_PLANMYPEAK_SUPABASE_PORT,
  IS_LOCAL_PLANMYPEAK_TARGET,
  STORAGE_KEYS,
} from '@/utils/constants';
import {
  getPortConfig,
  setAppPort as saveAppPort,
  setSupabasePort as saveSupabasePort,
  type PortConfig,
} from '@/services/portConfigService';

export interface UsePortConfigReturn {
  /** Whether port configuration is available (local builds only) */
  isConfigurable: boolean;
  /** Current PlanMyPeak app port */
  appPort: number;
  /** Current Supabase auth port */
  supabasePort: number;
  /** Whether ports are being loaded */
  isLoading: boolean;
  /** Set the PlanMyPeak app port */
  setAppPort: (port: number) => Promise<void>;
  /** Set the Supabase auth port */
  setSupabasePort: (port: number) => Promise<void>;
  /** Reload ports from storage */
  refresh: () => Promise<void>;
}

export function usePortConfig(): UsePortConfigReturn {
  const [config, setConfig] = useState<PortConfig>({
    appPort: DEFAULT_PLANMYPEAK_APP_PORT,
    supabasePort: DEFAULT_PLANMYPEAK_SUPABASE_PORT,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!IS_LOCAL_PLANMYPEAK_TARGET) {
      setIsLoading(false);
      return;
    }

    try {
      const portConfig = await getPortConfig();
      setConfig(portConfig);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setAppPort = useCallback(async (port: number) => {
    if (!IS_LOCAL_PLANMYPEAK_TARGET) {
      return;
    }

    await saveAppPort(port);
    setConfig((prev) => ({ ...prev, appPort: port }));
  }, []);

  const setSupabasePort = useCallback(async (port: number) => {
    if (!IS_LOCAL_PLANMYPEAK_TARGET) {
      return;
    }

    await saveSupabasePort(port);
    setConfig((prev) => ({ ...prev, supabasePort: port }));
  }, []);

  // Load config on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Subscribe to storage changes
  useEffect(() => {
    if (!IS_LOCAL_PLANMYPEAK_TARGET) {
      return;
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const appPortChange = changes[STORAGE_KEYS.PLANMYPEAK_APP_PORT];
      const supabasePortChange = changes[STORAGE_KEYS.PLANMYPEAK_SUPABASE_PORT];

      if (!appPortChange && !supabasePortChange) return;

      setConfig((prev) => ({
        appPort:
          typeof appPortChange?.newValue === 'number'
            ? appPortChange.newValue
            : prev.appPort,
        supabasePort:
          typeof supabasePortChange?.newValue === 'number'
            ? supabasePortChange.newValue
            : prev.supabasePort,
      }));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return {
    isConfigurable: IS_LOCAL_PLANMYPEAK_TARGET,
    appPort: config.appPort,
    supabasePort: config.supabasePort,
    isLoading,
    setAppPort,
    setSupabasePort,
    refresh,
  };
}

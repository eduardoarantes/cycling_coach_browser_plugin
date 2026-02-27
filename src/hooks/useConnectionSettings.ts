import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/utils/constants';

interface ConnectionSettings {
  isPlanMyPeakEnabled: boolean;
  isIntervalsEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  setPlanMyPeakEnabled: (enabled: boolean) => Promise<void>;
  setIntervalsEnabled: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

interface ConnectionSettingsStorage {
  [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]?: boolean;
  [STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS]?: boolean;
}

export function useConnectionSettings(): ConnectionSettings {
  const [isPlanMyPeakEnabled, setIsPlanMyPeakEnabledState] = useState(false);
  const [isIntervalsEnabled, setIsIntervalsEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = (await chrome.storage.local.get([
        STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK,
        STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS,
      ])) as ConnectionSettingsStorage;

      setIsPlanMyPeakEnabledState(
        data[STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK] === true
      );
      setIsIntervalsEnabledState(
        data[STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS] === true
      );
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load connection settings'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setPlanMyPeakEnabled = useCallback(async (enabled: boolean) => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: enabled,
    });
    setIsPlanMyPeakEnabledState(enabled);
  }, []);

  const setIntervalsEnabled = useCallback(async (enabled: boolean) => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS]: enabled,
    });
    setIsIntervalsEnabledState(enabled);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      if (changes[STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]) {
        setIsPlanMyPeakEnabledState(
          changes[STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK].newValue === true
        );
      }

      if (changes[STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS]) {
        setIsIntervalsEnabledState(
          changes[STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS].newValue === true
        );
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return {
    isPlanMyPeakEnabled,
    isIntervalsEnabled,
    isLoading,
    error,
    setPlanMyPeakEnabled,
    setIntervalsEnabled,
    refresh,
  };
}

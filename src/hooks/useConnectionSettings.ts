import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/utils/constants';
import { parseConnectionSettings } from '@/schemas/storage.schema';
import { logger } from '@/utils/logger';

interface ConnectionSettings {
  isPlanMyPeakEnabled: boolean;
  isIntervalsEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  setPlanMyPeakEnabled: (enabled: boolean) => Promise<void>;
  setIntervalsEnabled: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useConnectionSettings(): ConnectionSettings {
  const [isPlanMyPeakEnabled, setIsPlanMyPeakEnabledState] = useState(false);
  const [isIntervalsEnabled, setIsIntervalsEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK,
        STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS,
      ]);

      // Use Zod schema validation with defaults
      const validated = parseConnectionSettings(data);

      setIsPlanMyPeakEnabledState(validated.isPlanMyPeakEnabled);
      setIsIntervalsEnabledState(validated.isIntervalsEnabled);

      logger.debug('Connection settings loaded:', validated);
    } catch (refreshError) {
      const errorMessage =
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load connection settings';
      logger.error('Failed to load connection settings:', refreshError);
      setError(errorMessage);
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

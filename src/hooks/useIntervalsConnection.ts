import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/utils/constants';

interface IntervalsConnectionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useIntervalsConnection(): IntervalsConnectionState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.INTERVALS_API_KEY,
      ]);
      const apiKey = data[STORAGE_KEYS.INTERVALS_API_KEY];

      setIsAuthenticated(
        typeof apiKey === 'string' && apiKey.trim().length > 0
      );
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to read Intervals.icu connection state'
      );
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
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
      if (!changes[STORAGE_KEYS.INTERVALS_API_KEY]) return;

      const nextValue = changes[STORAGE_KEYS.INTERVALS_API_KEY].newValue;
      setIsAuthenticated(
        typeof nextValue === 'string' && nextValue.trim().length > 0
      );
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    refresh,
  };
}

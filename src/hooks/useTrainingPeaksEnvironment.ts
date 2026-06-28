/**
 * Custom hook for the TrainingPeaks environment toggle (production vs sandbox).
 *
 * The selection is persisted in chrome.storage and read by the background API
 * client, so switching it changes which TrainingPeaks API/app the extension
 * talks to at runtime.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_TRAININGPEAKS_ENVIRONMENT,
  STORAGE_KEYS,
  isTrainingPeaksEnvironment,
  type TrainingPeaksEnvironment,
} from '@/utils/constants';
import {
  getTrainingPeaksEnvironment,
  setTrainingPeaksEnvironment as saveTrainingPeaksEnvironment,
} from '@/services/trainingPeaksConfigService';

export interface UseTrainingPeaksEnvironmentReturn {
  environment: TrainingPeaksEnvironment;
  isLoading: boolean;
  setEnvironment: (environment: TrainingPeaksEnvironment) => Promise<void>;
}

export function useTrainingPeaksEnvironment(): UseTrainingPeaksEnvironmentReturn {
  const [environment, setEnvironmentState] = useState<TrainingPeaksEnvironment>(
    DEFAULT_TRAININGPEAKS_ENVIRONMENT
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setEnvironmentState(await getTrainingPeaksEnvironment());
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setEnvironment = useCallback(async (next: TrainingPeaksEnvironment) => {
    await saveTrainingPeaksEnvironment(next);
    setEnvironmentState(next);
  }, []);

  // Keep in sync if another surface changes the environment.
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const change = changes[STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT];
      if (!change) return;

      if (
        typeof change.newValue === 'string' &&
        isTrainingPeaksEnvironment(change.newValue)
      ) {
        setEnvironmentState(change.newValue);
      } else if (change.newValue === undefined) {
        setEnvironmentState(DEFAULT_TRAININGPEAKS_ENVIRONMENT);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return { environment, isLoading, setEnvironment };
}

/**
 * TrainingPeaks environment configuration service
 *
 * Resolves the active TrainingPeaks environment (production vs sandbox) from
 * chrome.storage and exposes the corresponding API/app URLs. The environment is
 * switchable at runtime via the Settings panel.
 */

import {
  DEFAULT_TRAININGPEAKS_ENVIRONMENT,
  STORAGE_KEYS,
  TRAININGPEAKS_ENVIRONMENTS,
  isTrainingPeaksEnvironment,
  type TrainingPeaksEnvironment,
} from '@/utils/constants';

/**
 * Get the configured TrainingPeaks environment (defaults to production).
 */
export async function getTrainingPeaksEnvironment(): Promise<TrainingPeaksEnvironment> {
  const data = await chrome.storage.local.get(
    STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT
  );
  const value = data[STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT];

  if (typeof value === 'string' && isTrainingPeaksEnvironment(value)) {
    return value;
  }

  return DEFAULT_TRAININGPEAKS_ENVIRONMENT;
}

/**
 * Persist the TrainingPeaks environment selection.
 */
export async function setTrainingPeaksEnvironment(
  environment: TrainingPeaksEnvironment
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT]: environment,
  });
}

/**
 * Get the TrainingPeaks API base URL for the active environment.
 */
export async function getTrainingPeaksApiBaseUrl(): Promise<string> {
  const environment = await getTrainingPeaksEnvironment();
  return TRAININGPEAKS_ENVIRONMENTS[environment].apiBaseUrl;
}

/**
 * Get the TrainingPeaks web app URL for the active environment.
 * Used for the API origin/referer headers and the re-auth tab.
 */
export async function getTrainingPeaksAppUrl(): Promise<string> {
  const environment = await getTrainingPeaksEnvironment();
  return TRAININGPEAKS_ENVIRONMENTS[environment].appUrl;
}

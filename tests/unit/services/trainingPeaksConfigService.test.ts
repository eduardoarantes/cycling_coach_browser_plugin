import { beforeEach, describe, expect, it } from 'vitest';
import {
  getTrainingPeaksApiBaseUrl,
  getTrainingPeaksAppUrl,
  getTrainingPeaksEnvironment,
  setTrainingPeaksEnvironment,
} from '@/services/trainingPeaksConfigService';
import { STORAGE_KEYS } from '@/utils/constants';

describe('trainingPeaksConfigService', () => {
  beforeEach(async () => {
    await chrome.storage.local.remove([STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT]);
  });

  it('defaults to the production environment', async () => {
    expect(await getTrainingPeaksEnvironment()).toBe('production');
    expect(await getTrainingPeaksApiBaseUrl()).toBe(
      'https://tpapi.trainingpeaks.com'
    );
    expect(await getTrainingPeaksAppUrl()).toBe(
      'https://app.trainingpeaks.com'
    );
  });

  it('returns sandbox URLs when the sandbox environment is selected', async () => {
    await setTrainingPeaksEnvironment('sandbox');

    expect(await getTrainingPeaksEnvironment()).toBe('sandbox');
    expect(await getTrainingPeaksApiBaseUrl()).toBe(
      'https://tpapi.sandbox.trainingpeaks.com'
    );
    expect(await getTrainingPeaksAppUrl()).toBe(
      'https://app.sandbox.trainingpeaks.com'
    );
  });

  it('falls back to production for an invalid stored value', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.TRAININGPEAKS_ENVIRONMENT]: 'staging',
    });

    expect(await getTrainingPeaksEnvironment()).toBe('production');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPlanMyPeakApiUrl,
  getPlanMyPeakAppUrl,
  getPlanMyPeakEnvironment,
  getPlanMyPeakHostLabel,
  setPlanMyPeakEnvironment,
} from '@/services/planMyPeakConfigService';
import { DEFAULT_PLANMYPEAK_APP_PORT, STORAGE_KEYS } from '@/utils/constants';

// Tests run as a local-target build (VITE_PLANMYPEAK_TARGET unset + DEV), so
// all three environments are available and `local` is the default.
describe('planMyPeakConfigService', () => {
  beforeEach(async () => {
    await chrome.storage.local.remove([
      STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT,
      STORAGE_KEYS.PLANMYPEAK_APP_PORT,
    ]);
  });

  it('should default to the local environment in a local-target build', async () => {
    expect(await getPlanMyPeakEnvironment()).toBe('local');
    expect(await getPlanMyPeakAppUrl()).toBe(
      `https://localhost:${DEFAULT_PLANMYPEAK_APP_PORT}`
    );
    expect(await getPlanMyPeakHostLabel()).toBe(
      `localhost:${DEFAULT_PLANMYPEAK_APP_PORT}`
    );
  });

  it('should return staging URLs when the staging environment is selected', async () => {
    await setPlanMyPeakEnvironment('staging');

    expect(await getPlanMyPeakEnvironment()).toBe('staging');
    expect(await getPlanMyPeakAppUrl()).toBe(
      'https://staging.app.planmypeak.com'
    );
    expect(await getPlanMyPeakApiUrl()).toBe(
      'https://staging.app.planmypeak.com/api'
    );
    expect(await getPlanMyPeakHostLabel()).toBe('staging.app.planmypeak.com');
  });

  it('should return portal URLs when the production environment is selected', async () => {
    await setPlanMyPeakEnvironment('production');

    expect(await getPlanMyPeakAppUrl()).toBe('https://portal.planmypeak.com');
    expect(await getPlanMyPeakApiUrl()).toBe(
      'https://portal.planmypeak.com/api'
    );
    expect(await getPlanMyPeakHostLabel()).toBe('portal.planmypeak.com');
  });

  it('should use the configured dev port for the local environment', async () => {
    await setPlanMyPeakEnvironment('local');
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_APP_PORT]: 3000,
    });

    expect(await getPlanMyPeakAppUrl()).toBe('https://localhost:3000');
    expect(await getPlanMyPeakApiUrl()).toBe('https://localhost:3000/api');
    expect(await getPlanMyPeakHostLabel()).toBe('localhost:3000');
  });

  it('should ignore a stored value that is not a known environment', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'preprod',
    });

    expect(await getPlanMyPeakEnvironment()).toBe('local');
  });

  it('should reject an environment that is not available in this build', async () => {
    await expect(setPlanMyPeakEnvironment('preprod' as never)).rejects.toThrow(
      'not available in this build'
    );
  });
});

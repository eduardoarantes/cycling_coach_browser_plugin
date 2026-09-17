import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLANMYPEAK_ENABLED,
  parseConnectionSettings,
} from '@/schemas/storage.schema';
import { STORAGE_KEYS } from '@/utils/constants';

describe('parseConnectionSettings', () => {
  it('enables PlanMyPeak and disables Intervals.icu by default', () => {
    expect(DEFAULT_PLANMYPEAK_ENABLED).toBe(true);
    expect(parseConnectionSettings({})).toEqual({
      isPlanMyPeakEnabled: true,
      isIntervalsEnabled: false,
    });
  });

  it('keeps an explicit PlanMyPeak opt-out', () => {
    expect(
      parseConnectionSettings({
        [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: false,
      }).isPlanMyPeakEnabled
    ).toBe(false);
  });

  it('honours explicit values for both providers', () => {
    expect(
      parseConnectionSettings({
        [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: true,
        [STORAGE_KEYS.CONNECTION_ENABLE_INTERVALS]: true,
      })
    ).toEqual({ isPlanMyPeakEnabled: true, isIntervalsEnabled: true });
  });

  it('falls back to the defaults when storage holds an unexpected shape', () => {
    expect(
      parseConnectionSettings({
        [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: 'yes',
      })
    ).toEqual({ isPlanMyPeakEnabled: true, isIntervalsEnabled: false });
  });
});

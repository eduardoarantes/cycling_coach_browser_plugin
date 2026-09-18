import { describe, it, expect } from 'vitest';
import {
  accountMatchBlocksImport,
  resolveAccountMatch,
  type AccountMatchInput,
  type AccountMatchStatus,
} from '@/utils/accountMatch';

const base: AccountMatchInput = {
  environment: 'production',
  tpUserId: '100',
  linkedTpId: '100',
  coachKnown: true,
};

describe('accountMatch', () => {
  describe('resolveAccountMatch', () => {
    const cases: Array<
      [string, Partial<AccountMatchInput>, AccountMatchStatus]
    > = [
      ['linked id equals the TrainingPeaks user', {}, 'matched'],
      ['linked id differs', { linkedTpId: '200' }, 'mismatch'],
      ['no linked TrainingPeaks account', { linkedTpId: null }, 'not-linked'],
      ['TrainingPeaks user unknown', { tpUserId: null }, 'unknown'],
      ['coach profile unavailable', { coachKnown: false }, 'unknown'],
      [
        'staging, even with differing ids',
        { environment: 'staging', linkedTpId: '200' },
        'not-enforced',
      ],
      [
        'local, even with differing ids',
        { environment: 'local', linkedTpId: '200' },
        'not-enforced',
      ],
      [
        'staging with the TrainingPeaks user unknown',
        { environment: 'staging', tpUserId: null },
        'unknown',
      ],
    ];

    it.each(cases)('should report %s', (_label, overrides, expected) => {
      expect(resolveAccountMatch({ ...base, ...overrides })).toBe(expected);
    });
  });

  describe('accountMatchBlocksImport', () => {
    it('should block only a confirmed mismatch', () => {
      const statuses: AccountMatchStatus[] = [
        'matched',
        'mismatch',
        'not-linked',
        'unknown',
        'not-enforced',
      ];

      expect(statuses.filter(accountMatchBlocksImport)).toEqual(['mismatch']);
    });
  });
});

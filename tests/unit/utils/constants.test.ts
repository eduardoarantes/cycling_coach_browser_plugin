import { describe, expect, it } from 'vitest';
import { resolvePlanMyPeakTarget } from '@/utils/constants';

describe('resolvePlanMyPeakTarget', () => {
  it('uses the explicit local target when configured', () => {
    expect(resolvePlanMyPeakTarget('local', false)).toBe('local');
    expect(resolvePlanMyPeakTarget('local', true)).toBe('local');
  });

  it('uses the explicit production target when configured', () => {
    expect(resolvePlanMyPeakTarget('production', false)).toBe('production');
    expect(resolvePlanMyPeakTarget('production', true)).toBe('production');
  });

  it('defaults to local in Vite development mode when no target is set', () => {
    expect(resolvePlanMyPeakTarget(undefined, true)).toBe('local');
  });

  it('defaults to production for built bundles when no target is set', () => {
    expect(resolvePlanMyPeakTarget(undefined, false)).toBe('production');
  });

  it('ignores invalid target values and falls back to the mode default', () => {
    expect(resolvePlanMyPeakTarget('staging', true)).toBe('local');
    expect(resolvePlanMyPeakTarget('staging', false)).toBe('production');
  });
});

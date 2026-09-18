import { describe, expect, it } from 'vitest';
import {
  IS_LOCAL_PLANMYPEAK_TARGET,
  isValidPort,
  parsePort,
  planMyPeakEnvironmentForAppOrigin,
  resolvePlanMyPeakTarget,
} from '@/utils/constants';

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

describe('isValidPort', () => {
  it('accepts the full TCP port range', () => {
    expect(isValidPort(1)).toBe(true);
    expect(isValidPort(3002)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
  });

  it('rejects values outside the TCP port range', () => {
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(-1)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(isValidPort(3002.5)).toBe(false);
    expect(isValidPort(NaN)).toBe(false);
    expect(isValidPort(Infinity)).toBe(false);
  });
});

describe('parsePort', () => {
  it('parses any port a user can type', () => {
    expect(parsePort('3002')).toBe(3002);
    expect(parsePort('9')).toBe(9);
    expect(parsePort('65535')).toBe(65535);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parsePort('  3006 ')).toBe(3006);
  });

  it('rejects trailing junk that parseInt would silently accept', () => {
    expect(parsePort('3002abc')).toBeNull();
    expect(parsePort('3002.5')).toBeNull();
    expect(parsePort('3002 3003')).toBeNull();
  });

  it('rejects values outside the TCP port range', () => {
    expect(parsePort('0')).toBeNull();
    expect(parsePort('65536')).toBeNull();
    expect(parsePort('-1')).toBeNull();
  });

  it('rejects empty and non-numeric input', () => {
    expect(parsePort('')).toBeNull();
    expect(parsePort('   ')).toBeNull();
    expect(parsePort('abc')).toBeNull();
  });
});

describe('planMyPeakEnvironmentForAppOrigin', () => {
  it('should map the portal origin to production', () => {
    expect(
      planMyPeakEnvironmentForAppOrigin('https://portal.planmypeak.com')
    ).toBe('production');
  });

  it('should map the production Supabase project host to production', () => {
    expect(
      planMyPeakEnvironmentForAppOrigin(
        'https://nwvtltfibnkdogdeeluh.supabase.co'
      )
    ).toBe('production');
  });

  it('should map the staging origin to staging', () => {
    expect(
      planMyPeakEnvironmentForAppOrigin('https://staging.app.planmypeak.com')
    ).toBe('staging');
  });

  it('should not accept a lookalike origin with a first-party host as a prefix', () => {
    expect(
      planMyPeakEnvironmentForAppOrigin(
        'https://portal.planmypeak.com.evil.test'
      )
    ).toBeNull();
    expect(
      planMyPeakEnvironmentForAppOrigin(
        'https://staging.app.planmypeak.com.evil.test'
      )
    ).toBeNull();
  });

  it('should not accept an origin carrying a path', () => {
    expect(
      planMyPeakEnvironmentForAppOrigin('https://portal.planmypeak.com/x')
    ).toBeNull();
  });

  it('should map nothing for an unrelated or absent origin', () => {
    expect(planMyPeakEnvironmentForAppOrigin('https://example.com')).toBeNull();
    expect(planMyPeakEnvironmentForAppOrigin(null)).toBeNull();
    expect(planMyPeakEnvironmentForAppOrigin(undefined)).toBeNull();
  });

  it('should map loopback origins to local only in local-target builds', () => {
    const expected = IS_LOCAL_PLANMYPEAK_TARGET ? 'local' : null;
    expect(planMyPeakEnvironmentForAppOrigin('https://localhost:3002')).toBe(
      expected
    );
    expect(planMyPeakEnvironmentForAppOrigin('http://127.0.0.1:4100')).toBe(
      expected
    );
    expect(
      planMyPeakEnvironmentForAppOrigin('https://localhost.evil.test')
    ).toBeNull();
  });
});

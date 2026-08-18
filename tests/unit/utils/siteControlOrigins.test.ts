import { describe, expect, it } from 'vitest';
import {
  PLANMYPEAK_CONTROL_ORIGINS,
  PLANMYPEAK_PRODUCTION_ORIGIN,
  isPlanMyPeakControlOrigin,
  originFromUrl,
} from '@/utils/constants';

describe('isPlanMyPeakControlOrigin', () => {
  it('should accept the production portal origin', () => {
    expect(isPlanMyPeakControlOrigin(PLANMYPEAK_PRODUCTION_ORIGIN)).toBe(true);
    expect(isPlanMyPeakControlOrigin('https://portal.planmypeak.com')).toBe(
      true
    );
  });

  it('should accept every origin in the allowlist', () => {
    for (const origin of PLANMYPEAK_CONTROL_ORIGINS) {
      expect(isPlanMyPeakControlOrigin(origin)).toBe(true);
    }
  });

  it('should accept local development origins under a local-target build', () => {
    // Vitest runs with import.meta.env.DEV === true, which resolves the
    // PlanMyPeak target to local, so local origins are in the allowlist.
    expect(isPlanMyPeakControlOrigin('https://localhost:3002')).toBe(true);
    expect(isPlanMyPeakControlOrigin('http://localhost:3006')).toBe(true);
    expect(isPlanMyPeakControlOrigin('http://127.0.0.1:3006')).toBe(true);
  });

  it('should reject lookalike origins that merely contain an allowed host', () => {
    expect(
      isPlanMyPeakControlOrigin('https://portal.planmypeak.com.evil.test')
    ).toBe(false);
    expect(
      isPlanMyPeakControlOrigin('https://evil.test/portal.planmypeak.com')
    ).toBe(false);
    expect(isPlanMyPeakControlOrigin('https://portal-planmypeak.com')).toBe(
      false
    );
  });

  it('should reject the bare planmypeak.com origin', () => {
    expect(isPlanMyPeakControlOrigin('https://planmypeak.com')).toBe(false);
    expect(isPlanMyPeakControlOrigin('https://www.planmypeak.com')).toBe(false);
  });

  it('should reject a scheme mismatch on an allowed host', () => {
    expect(isPlanMyPeakControlOrigin('http://portal.planmypeak.com')).toBe(
      false
    );
  });

  it('should reject an unrelated port on an allowed local host', () => {
    expect(isPlanMyPeakControlOrigin('http://localhost:9999')).toBe(false);
  });

  it('should reject a value carrying a path rather than a bare origin', () => {
    expect(
      isPlanMyPeakControlOrigin('https://portal.planmypeak.com/dashboard')
    ).toBe(false);
  });

  it('should reject empty and missing values', () => {
    expect(isPlanMyPeakControlOrigin('')).toBe(false);
    expect(isPlanMyPeakControlOrigin(null)).toBe(false);
    expect(isPlanMyPeakControlOrigin(undefined)).toBe(false);
  });

  it('should reject other extension surfaces', () => {
    expect(isPlanMyPeakControlOrigin('https://app.trainingpeaks.com')).toBe(
      false
    );
    expect(isPlanMyPeakControlOrigin('https://intervals.icu')).toBe(false);
  });
});

describe('originFromUrl', () => {
  it('should extract the origin from an absolute URL', () => {
    expect(originFromUrl('https://portal.planmypeak.com/library/12')).toBe(
      'https://portal.planmypeak.com'
    );
  });

  it('should drop the port when it is the scheme default', () => {
    expect(originFromUrl('https://portal.planmypeak.com:443/x')).toBe(
      'https://portal.planmypeak.com'
    );
  });

  it('should preserve a non-default port', () => {
    expect(originFromUrl('http://localhost:3006/import')).toBe(
      'http://localhost:3006'
    );
  });

  it('should return null for values that are not absolute URLs', () => {
    expect(originFromUrl('/relative/path')).toBeNull();
    expect(originFromUrl('not a url')).toBeNull();
    expect(originFromUrl('')).toBeNull();
    expect(originFromUrl(null)).toBeNull();
    expect(originFromUrl(undefined)).toBeNull();
  });
});

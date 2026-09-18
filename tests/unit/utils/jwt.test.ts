import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_EXPIRY_SKEW_MS,
  isAccessTokenExpired,
  readJwtExpiry,
} from '@/utils/jwt';
import { TOKEN_EXPIRY_MS } from '@/utils/constants';

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(payload: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify(payload)),
    'signature',
  ].join('.');
}

const NOW = 1_800_000_000_000;

describe('readJwtExpiry', () => {
  it('should return the exp claim in milliseconds for a valid token', () => {
    expect(readJwtExpiry(makeJwt({ exp: 1_800_000_600 }))).toBe(
      1_800_000_600_000
    );
  });

  it('should return null for malformed base64 in the payload', () => {
    expect(readJwtExpiry('header.@@not*base64@@.sig')).toBeNull();
  });

  it('should return null for a payload that is not JSON', () => {
    expect(readJwtExpiry(`h.${base64Url('not json')}.s`)).toBeNull();
  });

  it('should return null for an opaque non-token value', () => {
    expect(readJwtExpiry('opaque-session-token')).toBeNull();
  });

  it('should return null when the token has no expiry claim', () => {
    expect(readJwtExpiry(makeJwt({ sub: 'coach' }))).toBeNull();
  });

  it('should return null when the expiry claim is not a number', () => {
    expect(readJwtExpiry(makeJwt({ exp: 'soon' }))).toBeNull();
  });
});

describe('isAccessTokenExpired', () => {
  it('should report a token with a future expiry as fresh', () => {
    const token = makeJwt({ exp: NOW / 1000 + 600 });
    expect(isAccessTokenExpired(token, NOW, NOW)).toBe(false);
  });

  it('should report a token past its expiry as expired even when captured recently', () => {
    const token = makeJwt({ exp: NOW / 1000 - 1 });
    expect(isAccessTokenExpired(token, NOW - 1000, NOW)).toBe(true);
  });

  it('should treat a token expiring within the skew allowance as expired', () => {
    const expiresAt = NOW + ACCESS_TOKEN_EXPIRY_SKEW_MS - 1000;
    const token = makeJwt({ exp: expiresAt / 1000 });
    expect(isAccessTokenExpired(token, NOW, NOW)).toBe(true);
  });

  it('should treat a token expiring just outside the skew allowance as fresh', () => {
    const expiresAt = NOW + ACCESS_TOKEN_EXPIRY_SKEW_MS + 1000;
    const token = makeJwt({ exp: expiresAt / 1000 });
    expect(isAccessTokenExpired(token, NOW, NOW)).toBe(false);
  });

  it('should fall back to the maximum-age rule for malformed base64', () => {
    expect(isAccessTokenExpired('h.@@.s', NOW - 1000, NOW)).toBe(false);
    expect(isAccessTokenExpired('h.@@.s', NOW - TOKEN_EXPIRY_MS - 1, NOW)).toBe(
      true
    );
  });

  it('should fall back to the maximum-age rule for an opaque non-token', () => {
    expect(isAccessTokenExpired('opaque', NOW - 1000, NOW)).toBe(false);
  });

  it('should fall back to the maximum-age rule for a token without an expiry claim', () => {
    const token = makeJwt({ sub: 'coach' });
    expect(isAccessTokenExpired(token, NOW - 1000, NOW)).toBe(false);
    expect(isAccessTokenExpired(token, NOW - TOKEN_EXPIRY_MS - 1, NOW)).toBe(
      true
    );
  });

  it('should leave an undecodable token with no capture time to the server', () => {
    expect(isAccessTokenExpired('opaque', null, NOW)).toBe(false);
  });
});

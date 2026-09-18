/**
 * Access-token freshness, read from the token itself.
 *
 * The PlanMyPeak credential is a short-lived JWT, so a fixed maximum age since
 * capture reports it fresh long after the server stops accepting it. The
 * expiry claim says when it actually lapses.
 *
 * The signature is deliberately not verified: expiry is read only to decide
 * when to obtain a replacement, and the server remains the authority on
 * whether a credential is accepted.
 *
 * Fail-soft by design. A value that is not a decodable token, or carries no
 * usable expiry, falls back to the maximum-age rule instead of being called
 * expired: a wrong "expired" costs a quiet refresh, a wrong "signed out" evicts
 * a coach whose credential works.
 */

import { TOKEN_EXPIRY_MS } from '@/utils/constants';

/**
 * Treat a credential as expired this long before its stated expiry, so a
 * replacement is obtained before a request is spent racing it.
 */
export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;

function decodeBase64Url(segment: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    return null;
  }

  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  try {
    return atob(padded);
  } catch {
    return null;
  }
}

/**
 * The token's expiry in epoch milliseconds, or null when the value is not a
 * decodable JWT or has no usable `exp` claim.
 */
export function readJwtExpiry(token: string | null | undefined): number | null {
  if (typeof token !== 'string') {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const json = decodeBase64Url(segments[1]);
  if (json === null) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const exp = (payload as { exp?: unknown }).exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) {
    return null;
  }

  return exp * 1000;
}

/**
 * Whether a stored access token should be treated as expired.
 *
 * @param token the stored credential
 * @param capturedAt when it was captured (epoch ms), for the maximum-age
 *   fallback; null when unknown
 */
export function isAccessTokenExpired(
  token: string | null | undefined,
  capturedAt: number | null | undefined,
  now: number = Date.now()
): boolean {
  const expiresAt = readJwtExpiry(token);
  if (expiresAt !== null) {
    return now >= expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS;
  }

  // Not a decodable token, or no usable expiry: the maximum-age rule decides.
  // With no capture time there is no age to judge, and calling it expired
  // would evict a credential the server may well accept, so it is not.
  if (typeof capturedAt !== 'number') {
    return false;
  }

  return now - capturedAt > TOKEN_EXPIRY_MS;
}

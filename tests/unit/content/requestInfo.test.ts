import { describe, it, expect } from 'vitest';
import { extractRequestInfo, toAbsoluteUrl } from '@/content/requestInfo';

describe('extractRequestInfo', () => {
  it('reads url + headers from fetch(urlString, init)', () => {
    const { urlStr, headers } = extractRequestInfo(
      'https://portal.planmypeak.com/api/backend/athlete/me',
      { headers: { authorization: 'Bearer token-1' } }
    );

    expect(urlStr).toBe('https://portal.planmypeak.com/api/backend/athlete/me');
    expect(headers.get('authorization')).toBe('Bearer token-1');
  });

  it('reads the Authorization header from a Request object (no init)', () => {
    const request = new Request(
      'https://portal.planmypeak.com/api/backend/athlete/me/activities/abc/review',
      { headers: { authorization: 'Bearer token-2', apikey: 'anon' } }
    );

    const { urlStr, headers } = extractRequestInfo(request);

    expect(urlStr).toContain('/api/backend/athlete/me/activities/abc/review');
    expect(headers.get('authorization')).toBe('Bearer token-2');
    expect(headers.get('apikey')).toBe('anon');
  });

  it('lets init.headers override a Request object headers', () => {
    const request = new Request('https://portal.planmypeak.com/api/backend/x', {
      headers: { authorization: 'Bearer old' },
    });

    const { headers } = extractRequestInfo(request, {
      headers: { authorization: 'Bearer new' },
    });

    expect(headers.get('authorization')).toBe('Bearer new');
  });

  it('handles a URL object input', () => {
    const { urlStr } = extractRequestInfo(
      new URL('https://portal.planmypeak.com/api/backend/x')
    );

    expect(urlStr).toBe('https://portal.planmypeak.com/api/backend/x');
  });

  it('returns empty headers when none are provided', () => {
    const { headers } = extractRequestInfo('https://example.com');
    expect(headers.get('authorization')).toBeNull();
  });
});

describe('toAbsoluteUrl', () => {
  it('resolves a relative /api/backend path against the portal origin', () => {
    expect(
      toAbsoluteUrl(
        '/api/backend/coaches/me',
        'https://portal.planmypeak.com/dashboard'
      )
    ).toBe('https://portal.planmypeak.com/api/backend/coaches/me');
  });

  it('leaves an already-absolute URL unchanged', () => {
    expect(
      toAbsoluteUrl(
        'https://portal.planmypeak.com/api/backend/events',
        'https://portal.planmypeak.com/dashboard'
      )
    ).toBe('https://portal.planmypeak.com/api/backend/events');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(toAbsoluteUrl('/api/backend/x', '')).toBe('/api/backend/x');
  });
});

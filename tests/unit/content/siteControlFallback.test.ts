/**
 * The availability fallback.
 *
 * Covers the one thing it exists for: when the bridge never loads, the page
 * must learn that the extension is broken rather than hear nothing and
 * conclude it is absent.
 *
 * @vitest-environment-options { "url": "https://portal.planmypeak.com/" }
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_EXTENSION_SOURCE,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';

import '@/content/siteControlFallback';

const READY_FLAG = '__planMyPeakSiteControlBridgeReady';

function ping(requestId = 'req-1'): unknown {
  return {
    source: SITE_CONTROL_PAGE_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    requestId,
    type: 'PING',
    payload: {},
  };
}

/** Deliver a message as the page would, straight to the registered listener. */
function post(data: unknown, origin = window.location.origin): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: window })
  );
}

function replies(spy: ReturnType<typeof vi.spyOn>): unknown[] {
  return spy.mock.calls.map((call) => call[0]);
}

describe('site-control availability fallback', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window[READY_FLAG] = undefined;
    postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window[READY_FLAG] = undefined;
  });

  it('should tell the page the bridge could not start', () => {
    post(ping());
    vi.runAllTimers();

    const [reply] = replies(postMessageSpy) as Array<{
      source: string;
      requestId: string;
      ok: boolean;
      error: { code: string; message: string };
    }>;

    expect(reply).toBeDefined();
    expect(reply.source).toBe(SITE_CONTROL_EXTENSION_SOURCE);
    expect(reply.requestId).toBe('req-1');
    expect(reply.ok).toBe(false);
    expect(reply.error.code).toBe('INTERNAL_ERROR');
    // An error the coach can act on beats silence, which the page can only
    // read as "not installed".
    expect(reply.error.message).toMatch(/reload/i);
  });

  it('should say nothing once the bridge is alive', () => {
    window[READY_FLAG] = true;

    post(ping());
    vi.runAllTimers();

    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should stand down for a bridge that attaches while it waits', () => {
    post(ping());

    // The bridge's module is fetched asynchronously, so it can legitimately
    // arrive after the request. A late bridge must win.
    window[READY_FLAG] = true;
    vi.runAllTimers();

    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should not answer before giving the bridge a chance', () => {
    post(ping());

    // Nothing yet: answering immediately would report a working extension as
    // broken every time the bridge is merely slow.
    expect(replies(postMessageSpy)).toEqual([]);

    vi.runAllTimers();
    expect(replies(postMessageSpy)).toHaveLength(1);
  });

  it('should answer only PING', () => {
    post({ ...(ping() as object), type: 'GET_LIBRARIES' });
    post({ ...(ping() as object), type: 'OPEN_IMPORTER' });
    vi.runAllTimers();

    // It reports readiness and nothing else; it cannot serve real requests.
    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should ignore messages that are not ours', () => {
    post({ source: 'something-else', type: 'PING', requestId: 'req-1' });
    post({ type: 'PING', requestId: 'req-1' });
    post('not an object');
    post(null);
    vi.runAllTimers();

    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should ignore a ping with no usable request id', () => {
    post({ ...(ping() as object), requestId: '' });
    post({ ...(ping() as object), requestId: 42 });
    vi.runAllTimers();

    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should ignore a message from another origin', () => {
    post(ping(), 'https://evil.test');
    vi.runAllTimers();

    expect(replies(postMessageSpy)).toEqual([]);
  });

  it('should echo each request id it answers', () => {
    post(ping('a'));
    post(ping('b'));
    vi.runAllTimers();

    expect(
      (replies(postMessageSpy) as Array<{ requestId: string }>).map(
        (reply) => reply.requestId
      )
    ).toEqual(['a', 'b']);
  });
});

describe('fallback wire constants', () => {
  it('should match the protocol definitions it deliberately duplicates', async () => {
    // The fallback imports nothing, so that the build emits it without a
    // module fetch that could fail - which is the whole point of it. That
    // forces these three values to be copied, so they are pinned here.
    const source = await import('fs').then((fs) =>
      fs.readFileSync('src/content/siteControlFallback.ts', 'utf8')
    );

    expect(source).toContain(
      `const PAGE_SOURCE = '${SITE_CONTROL_PAGE_SOURCE}'`
    );
    expect(source).toContain(
      `const EXTENSION_SOURCE = '${SITE_CONTROL_EXTENSION_SOURCE}'`
    );
    expect(source).toContain(
      `const PROTOCOL_VERSION = ${PLANMYPEAK_SITE_CONTROL_VERSION}`
    );

    // An import here would reintroduce the failure mode this file avoids.
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});

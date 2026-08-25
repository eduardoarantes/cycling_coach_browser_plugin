/**
 * Bridge behavior on an allowlisted PlanMyPeak origin.
 *
 * @vitest-environment-options { "url": "https://portal.planmypeak.com/" }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleSiteControlPageMessage } from '@/content/siteControlBridge';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_EXTENSION_SOURCE,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';
import type { SiteControlResponse } from '@/types/siteControl.types';

const ORIGIN = 'https://portal.planmypeak.com';

function envelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    source: SITE_CONTROL_PAGE_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    requestId: 'req-1',
    type: 'GET_LIBRARIES',
    payload: {},
    ...overrides,
  };
}

function pageEvent(
  data: unknown,
  overrides: { origin?: string; source?: MessageEventSource | null } = {}
): MessageEvent {
  return new MessageEvent('message', {
    data,
    origin: overrides.origin ?? ORIGIN,
    source: 'source' in overrides ? overrides.source : window,
  });
}

function postedResponses(
  spy: ReturnType<typeof vi.spyOn>
): SiteControlResponse[] {
  return spy.mock.calls.map((call) => call[0] as SiteControlResponse);
}

describe('siteControlBridge', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      source: SITE_CONTROL_EXTENSION_SOURCE,
      version: PLANMYPEAK_SITE_CONTROL_VERSION,
      requestId: 'req-1',
      ok: true,
      data: [],
    } as never);
  });

  describe('accepted requests', () => {
    it('should forward a valid request to the background worker', async () => {
      await handleSiteControlPageMessage(pageEvent(envelope()));

      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      expect(sendMessageSpy.mock.calls[0][0]).toMatchObject({
        type: 'SITE_CONTROL_REQUEST',
        request: { type: 'GET_LIBRARIES', requestId: 'req-1' },
      });
    });

    it('should post the background response back to the page', async () => {
      await handleSiteControlPageMessage(pageEvent(envelope()));

      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(true);
      expect(response.requestId).toBe('req-1');
      expect(response.source).toBe(SITE_CONTROL_EXTENSION_SOURCE);
    });

    it('should target the page origin rather than a wildcard', async () => {
      await handleSiteControlPageMessage(pageEvent(envelope()));

      expect(postMessageSpy.mock.calls[0][1]).toBe(ORIGIN);
    });

    it('should echo the request id on the response', async () => {
      sendMessageSpy.mockResolvedValue({
        source: SITE_CONTROL_EXTENSION_SOURCE,
        version: PLANMYPEAK_SITE_CONTROL_VERSION,
        requestId: 'custom-id',
        ok: true,
        data: [],
      } as never);

      await handleSiteControlPageMessage(
        pageEvent(envelope({ requestId: 'custom-id' }))
      );

      expect(postedResponses(postMessageSpy)[0].requestId).toBe('custom-id');
    });

    it('should forward a request with a payload', async () => {
      await handleSiteControlPageMessage(
        pageEvent(
          envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 12 } })
        )
      );

      expect(sendMessageSpy.mock.calls[0][0]).toMatchObject({
        request: { type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 12 } },
      });
    });
  });

  describe('messages that are ignored entirely', () => {
    it('should ignore a message from another window', async () => {
      await handleSiteControlPageMessage(
        pageEvent(envelope(), { source: null })
      );

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('should ignore a message whose origin does not match the document', async () => {
      await handleSiteControlPageMessage(
        pageEvent(envelope(), { origin: 'https://evil.test' })
      );

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('should ignore auth-bridge messages from the main-world interceptor', async () => {
      await handleSiteControlPageMessage(
        pageEvent({
          type: 'MY_PEAK_AUTH_FOUND',
          source: 'trainingpeaks-extension-main',
          token: 'secret',
          apiKey: 'secret',
          timestamp: 1,
        })
      );

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });

    it('should ignore unrelated page chatter', async () => {
      await handleSiteControlPageMessage(pageEvent({ hello: 'world' }));
      await handleSiteControlPageMessage(pageEvent('a string'));
      await handleSiteControlPageMessage(pageEvent(null));

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(postMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('rejected requests', () => {
    it('should answer an unsupported request type without forwarding it', async () => {
      await handleSiteControlPageMessage(
        pageEvent(envelope({ type: 'GET_TOKEN' }))
      );

      expect(sendMessageSpy).not.toHaveBeenCalled();
      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('UNSUPPORTED_REQUEST_TYPE');
    });

    it('should answer a malformed payload without forwarding it', async () => {
      await handleSiteControlPageMessage(
        pageEvent(
          envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 'x' } })
        )
      );

      expect(sendMessageSpy).not.toHaveBeenCalled();
      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('INVALID_REQUEST');
    });

    it('should answer an unsupported protocol version', async () => {
      await handleSiteControlPageMessage(pageEvent(envelope({ version: 999 })));

      expect(sendMessageSpy).not.toHaveBeenCalled();
      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('UNSUPPORTED_VERSION');
    });
  });

  describe('background failures', () => {
    it('should report an internal error when the background throws', async () => {
      sendMessageSpy.mockRejectedValue(
        new Error('Receiving end does not exist')
      );

      await handleSiteControlPageMessage(pageEvent(envelope()));

      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('INTERNAL_ERROR');
      expect(response.error.message).toContain('Receiving end does not exist');
    });

    it('should report an internal error when the background answers with nothing', async () => {
      sendMessageSpy.mockResolvedValue(undefined as never);

      await handleSiteControlPageMessage(pageEvent(envelope()));

      const [response] = postedResponses(postMessageSpy);
      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('siteControlBridge OPEN_IMPORTER', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage');
  });

  it('should not send OPEN_IMPORTER to the background worker', async () => {
    await handleSiteControlPageMessage(
      pageEvent(envelope({ type: 'OPEN_IMPORTER', payload: {} }))
    );

    // The overlay lives in the page context, so this never round-trips.
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  it('should always answer an OPEN_IMPORTER request', async () => {
    await handleSiteControlPageMessage(
      pageEvent(envelope({ type: 'OPEN_IMPORTER', payload: { libraryId: 3 } }))
    );

    const [response] = postedResponses(postMessageSpy);
    expect(response).toBeDefined();
    expect(response.requestId).toBe('req-1');
    expect(response.source).toBe(SITE_CONTROL_EXTENSION_SOURCE);
  });

  it('should answer an OPEN_IMPORTER request asking for the groups tab', async () => {
    await handleSiteControlPageMessage(
      pageEvent(envelope({ type: 'OPEN_IMPORTER', payload: { groups: true } }))
    );

    const [response] = postedResponses(postMessageSpy);
    expect(response).toBeDefined();
    expect(response.ok).toBe(true);
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});

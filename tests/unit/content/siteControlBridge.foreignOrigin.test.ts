/**
 * Bridge behavior when the document itself is not an allowlisted control
 * surface. Silence is the contract: an arbitrary site must not be able to use
 * this channel to detect that the extension is installed.
 *
 * @vitest-environment-options { "url": "https://evil.test/" }
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleSiteControlPageMessage } from '@/content/siteControlBridge';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';

const ORIGIN = 'https://evil.test';

function pageEvent(data: unknown): MessageEvent {
  return new MessageEvent('message', {
    data,
    origin: ORIGIN,
    source: window,
  });
}

describe('siteControlBridge on a non-allowlisted document', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage');
  });

  it('should not answer a well-formed request', async () => {
    await handleSiteControlPageMessage(
      pageEvent({
        source: SITE_CONTROL_PAGE_SOURCE,
        version: PLANMYPEAK_SITE_CONTROL_VERSION,
        requestId: 'req-1',
        type: 'PING',
        payload: {},
      })
    );

    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should not answer a data request', async () => {
    await handleSiteControlPageMessage(
      pageEvent({
        source: SITE_CONTROL_PAGE_SOURCE,
        version: PLANMYPEAK_SITE_CONTROL_VERSION,
        requestId: 'req-2',
        type: 'GET_LIBRARIES',
        payload: {},
      })
    );

    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('should not answer a malformed request either', async () => {
    // An error response would itself reveal that the extension is installed.
    await handleSiteControlPageMessage(
      pageEvent({
        source: SITE_CONTROL_PAGE_SOURCE,
        version: PLANMYPEAK_SITE_CONTROL_VERSION,
        requestId: 'req-3',
        type: 'NOT_A_REAL_TYPE',
        payload: {},
      })
    );

    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

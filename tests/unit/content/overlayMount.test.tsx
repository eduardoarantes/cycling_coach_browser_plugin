/**
 * Overlay lifecycle on the host page.
 *
 * @vitest-environment-options { "url": "https://portal.planmypeak.com/" }
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
  OVERLAY_HOST_ID,
  focusOverlay,
  isOverlayMounted,
  mountOverlay,
  unmountOverlay,
} from '@/content/overlay/mount';

function host(): HTMLElement | null {
  return document.getElementById(OVERLAY_HOST_ID);
}

describe('overlay mount', () => {
  beforeEach(() => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      success: true,
      data: [],
    } as never);
    document.body.innerHTML = '<main id="host-page">PlanMyPeak</main>';
    document.body.style.overflow = 'scroll';
  });

  afterEach(() => {
    act(() => {
      unmountOverlay();
    });
  });

  it('should mount a single host element with a shadow root', () => {
    act(() => {
      mountOverlay();
    });

    expect(isOverlayMounted()).toBe(true);
    expect(host()).not.toBeNull();
    expect(host()?.shadowRoot).not.toBeNull();
  });

  it('should keep the overlay inside its shadow root', () => {
    act(() => {
      mountOverlay();
    });

    // Nothing the overlay renders is reachable from the host document tree.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host()?.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('should leave existing host page markup untouched', () => {
    act(() => {
      mountOverlay();
    });

    expect(document.getElementById('host-page')?.textContent).toBe(
      'PlanMyPeak'
    );
  });

  it('should focus an existing overlay rather than mounting a second one', () => {
    act(() => {
      mountOverlay();
    });
    let secondResult: { focused: boolean } | undefined;
    act(() => {
      secondResult = mountOverlay();
    });

    expect(secondResult?.focused).toBe(true);
    expect(document.querySelectorAll(`#${OVERLAY_HOST_ID}`)).toHaveLength(1);
  });

  it('should report a first mount as not focused', () => {
    let result: { focused: boolean } | undefined;
    act(() => {
      result = mountOverlay();
    });

    expect(result?.focused).toBe(false);
  });

  it('should ignore a focus request when nothing is mounted', () => {
    expect(() => focusOverlay()).not.toThrow();
    expect(isOverlayMounted()).toBe(false);
  });

  it('should remove all overlay markup on unmount', () => {
    act(() => {
      mountOverlay();
    });
    act(() => {
      unmountOverlay();
    });

    expect(isOverlayMounted()).toBe(false);
    expect(host()).toBeNull();
    expect(document.getElementById('host-page')).not.toBeNull();
  });

  it('should restore the host page scroll setting exactly', () => {
    act(() => {
      mountOverlay();
    });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      unmountOverlay();
    });
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('should tolerate a redundant unmount', () => {
    act(() => {
      mountOverlay();
    });
    act(() => {
      unmountOverlay();
    });

    expect(() => unmountOverlay()).not.toThrow();
  });
});

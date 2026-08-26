/**
 * How the content scripts are registered.
 *
 * These are manifest facts rather than code paths, but they decide whether the
 * site-control channel can answer at all, so they are pinned here rather than
 * left to review.
 */

import { describe, it, expect } from 'vitest';
import manifest from '../../../public/manifest.json';

interface ContentScript {
  js: string[];
  run_at?: string;
  world?: string;
  matches: string[];
}

const scripts = manifest.content_scripts as ContentScript[];

function scriptFor(source: string): ContentScript {
  const match = scripts.find((script) =>
    script.js.some((file) => file.endsWith(source))
  );
  if (!match) throw new Error(`No content script registered for ${source}`);
  return match;
}

describe('content script registration', () => {
  it('should register the site-control bridge at document_start', () => {
    // The page can post a request as soon as its own scripts run, and
    // postMessage does not queue for a listener that does not exist yet. At
    // document_idle the bridge attached after a framework had already
    // hydrated and probed, so an opening PING could be lost and its timeout
    // read as "extension not installed".
    expect(scriptFor('siteControlBridge.ts').run_at).toBe('document_start');
  });

  it('should register every content script at document_start', () => {
    // They observe or answer page activity, so none of them may attach after
    // the page has started doing the thing being observed.
    for (const script of scripts) {
      expect(script.run_at).toBe('document_start');
    }
  });

  it('should keep the site-control bridge out of the page world', () => {
    // It relays to the extension and must not be reachable by page scripts.
    expect(scriptFor('siteControlBridge.ts').world).toBe('ISOLATED');
  });

  it('should serve site-control only on first-party PlanMyPeak origins', () => {
    // Loopback is added at build time for local targets; the checked-in
    // manifest must never carry anything but the two real deployments.
    expect(scriptFor('siteControlBridge.ts').matches).toEqual([
      'https://portal.planmypeak.com/*',
      'https://staging.app.planmypeak.com/*',
    ]);
  });

  it('should register the availability fallback alongside the bridge', () => {
    const fallback = scriptFor('siteControlFallback.ts');
    const bridge = scriptFor('siteControlBridge.ts');

    // It answers for the bridge, so it must be injected wherever the bridge
    // is - and nowhere else, or it would answer an origin the bridge would
    // have stayed silent for.
    expect(fallback.matches).toEqual(bridge.matches);
    expect(fallback.run_at).toBe('document_start');
    expect(fallback.world).toBe('ISOLATED');
  });

  it('should register the fallback before the bridge', () => {
    const order = scripts.findIndex((script) =>
      script.js.some((file) => file.endsWith('siteControlFallback.ts'))
    );
    const bridgeOrder = scripts.findIndex((script) =>
      script.js.some((file) => file.endsWith('siteControlBridge.ts'))
    );

    // The fallback has no module to fetch, so it is listening first either
    // way; declaring it first keeps the manifest honest about that.
    expect(order).toBeLessThan(bridgeOrder);
  });
});

describe('requested permissions', () => {
  it('should request only the permissions the extension still uses', () => {
    // Notifications were removed along with the export notifications they
    // served; a permission the code no longer exercises is one the store
    // review and the coach are asked to accept for nothing.
    expect(manifest.permissions).toEqual(['storage', 'tabs']);
  });
});

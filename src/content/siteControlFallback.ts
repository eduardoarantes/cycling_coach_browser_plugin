/**
 * Site-control availability fallback
 *
 * Answers a site-control request when the real bridge could not start, so a
 * broken extension reports itself as broken instead of saying nothing.
 *
 * Why this exists as a second script: the bridge imports schemas and constants,
 * so the build wraps it in a loader that fetches its module at runtime. If that
 * fetch fails — a stale cache pointing at a chunk a rebuild deleted, a partial
 * build, a corrupted unpacked directory — the loader logs and gives up, and the
 * bridge never attaches a listener. It is then silent forever. The page cannot
 * distinguish that from a missing extension, so it tells a coach to install one
 * they already have.
 *
 * This file must therefore IMPORT NOTHING. With no imports the build emits it
 * as a plain function registered directly in the manifest, with no module fetch
 * that can fail. Adding an import here would give it the failure mode it exists
 * to cover, so the wire constants below are duplicated deliberately rather than
 * imported — see the test that pins them to their real definitions.
 *
 * It is not a second implementation of the channel: it answers nothing but
 * `PING`, reads no data, reaches neither the background worker nor any
 * credential, and stands down the moment the real bridge is alive.
 */

/** Must equal `SITE_CONTROL_PAGE_SOURCE`. */
const PAGE_SOURCE = 'planmypeak-site-control';

/** Must equal `SITE_CONTROL_EXTENSION_SOURCE`. */
const EXTENSION_SOURCE = 'planmypeak-extension';

/** Must equal `PLANMYPEAK_SITE_CONTROL_VERSION`. */
const PROTOCOL_VERSION = 1;

/**
 * Flag the real bridge sets on the isolated world's window when it attaches.
 * Content scripts from this extension share that global, so it is how the two
 * scripts see each other.
 */
const READY_FLAG = '__planMyPeakSiteControlBridgeReady';

/**
 * How long to wait before concluding the bridge is not coming.
 *
 * The bridge's module is fetched asynchronously, so it can legitimately attach
 * a moment after this script does. Answering immediately would report a working
 * extension as broken. Waiting means a genuinely dead bridge is reported one
 * beat later, which is the cheaper mistake.
 */
const BRIDGE_GRACE_MS = 1500;

declare global {
  interface Window {
    [READY_FLAG]?: boolean;
  }
}

function bridgeIsAlive(): boolean {
  return window[READY_FLAG] === true;
}

/**
 * Whether this document may be answered at all.
 *
 * Origin is not re-derived here: this script is registered against the same
 * match list as the bridge, so the browser only injects it on allow-listed
 * origins. Re-implementing the allow-list would be a second copy of the one
 * rule that must never disagree with itself. What is checked is the part
 * matches cannot express — that this is the top-level document, so an
 * allow-listed portal embedded in another site is not treated as a control
 * surface.
 */
function isControlDocument(): boolean {
  return window.top === window;
}

interface PingLikeRequest {
  requestId: string;
}

/**
 * Recognise a `PING` envelope without validating the whole protocol.
 *
 * Deliberately narrow: this script answers readiness and nothing else, so it
 * only needs to know a ping when it sees one.
 */
function asPingRequest(data: unknown): PingLikeRequest | null {
  if (typeof data !== 'object' || data === null) return null;

  const envelope = data as Record<string, unknown>;
  if (envelope.source !== PAGE_SOURCE) return null;
  if (envelope.type !== 'PING') return null;
  if (typeof envelope.requestId !== 'string' || envelope.requestId === '') {
    return null;
  }

  return { requestId: envelope.requestId };
}

function replyUnavailable(requestId: string): void {
  window.postMessage(
    {
      source: EXTENSION_SOURCE,
      version: PROTOCOL_VERSION,
      requestId,
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'The extension could not start its PlanMyPeak bridge. Reload the extension from the browser extensions page, then reload this page.',
      },
    },
    window.location.origin
  );
}

window.addEventListener('message', (event) => {
  // Only this document's own postMessage calls, and only the top-level one.
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!isControlDocument()) return;

  // The bridge is alive and owns every request, including this one.
  if (bridgeIsAlive()) return;

  const request = asPingRequest(event.data);
  if (!request) return;

  // Re-checked after the grace period rather than before it: the bridge may
  // still be loading, and a late arrival must win over this answer.
  setTimeout(() => {
    if (bridgeIsAlive()) return;
    replyUnavailable(request.requestId);
  }, BRIDGE_GRACE_MS);
});

export {};

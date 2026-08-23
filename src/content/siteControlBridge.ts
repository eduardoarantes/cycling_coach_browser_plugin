/**
 * PlanMyPeak site-control bridge - runs in the extension's isolated context
 *
 * Registered only for PlanMyPeak origins. This is the single door through which
 * the PlanMyPeak web app can drive the extension, so it is deliberately narrow:
 *
 *   - only messages posted by this same window, from an allowlisted origin,
 *     carrying the site-control source marker are considered at all
 *   - a non-allowlisted origin gets silence, never an error, so an arbitrary
 *     site cannot use this channel to detect that the extension is installed
 *   - every accepted message is schema-validated before it is forwarded
 *   - the page names site-control request types, never `RuntimeMessage` types
 *
 * It stays dependency-light (schemas and constants, no React) because it runs on
 * every PlanMyPeak page view. The import overlay is loaded on demand instead.
 */

import { isPlanMyPeakControlOrigin } from '@/utils/constants';
import {
  createErrorResponse,
  createImportCompletedEvent,
  createSuccessResponse,
  parseSiteControlRequest,
} from '@/schemas/siteControl.schema';
import type {
  SiteControlRequest,
  SiteControlRequestEnvelope,
  SiteControlResponse,
} from '@/types/siteControl.types';
import type { SiteControlRequestMessage } from '@/types';

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log('[PlanMyPeak Site Control]', ...args);
};

/**
 * Post a message back to the page.
 *
 * Targeted at this document's own origin rather than `*`, so a response can
 * never be delivered to a frame from another origin.
 */
function postToPage(message: unknown): void {
  window.postMessage(message, window.location.origin);
}

/**
 * Whether this document may act as a site-control endpoint.
 *
 * Restricted to the top-level page: an allowlisted portal embedded as a frame
 * inside another site is not treated as a control surface.
 */
function isControlDocument(): boolean {
  return (
    window.top === window && isPlanMyPeakControlOrigin(window.location.origin)
  );
}

async function forwardToBackground(
  request: SiteControlRequest
): Promise<SiteControlResponse> {
  try {
    const response = await chrome.runtime.sendMessage<
      SiteControlRequestMessage,
      SiteControlResponse | undefined
    >({ type: 'SITE_CONTROL_REQUEST', request });

    if (!response) {
      return createErrorResponse(request.requestId, {
        code: 'INTERNAL_ERROR',
        message: 'No response from the extension background worker',
      });
    }

    return response;
  } catch (error) {
    log('Failed to reach background worker:', error);
    return createErrorResponse(request.requestId, {
      code: 'INTERNAL_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to reach the extension background worker',
    });
  }
}

/**
 * Open the import overlay, loading it on demand.
 *
 * The overlay bundle is behind a dynamic import so React and the export
 * machinery are not part of the script that runs on every portal page view.
 * The originating `requestId` is captured here so the completion notification
 * can be correlated with the request that started the import.
 */
async function openImporter(
  request: SiteControlRequestEnvelope<'OPEN_IMPORTER'>
): Promise<SiteControlResponse> {
  try {
    const overlay = await import('./overlay/mount');

    const { focused } = overlay.mountOverlay({
      preselectedLibraryId: request.payload.libraryId ?? null,
      preselectedPlanId: request.payload.planId ?? null,
      onImportCompleted: (payload) => {
        postToPage(createImportCompletedEvent(request.requestId, payload));
      },
    });

    return createSuccessResponse(request.requestId, {
      opened: true,
      focused,
    });
  } catch (error) {
    log('Failed to open the import overlay:', error);
    return createErrorResponse(request.requestId, {
      code: 'INTERNAL_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to open the import overlay',
    });
  }
}

/**
 * Handle one message posted by the page.
 *
 * Exported for testing; the listener below is what wires it up at runtime.
 */
export async function handleSiteControlPageMessage(
  event: MessageEvent
): Promise<void> {
  // Only this document's own postMessage calls are considered. A message from
  // a parent, child, or opener window has a different source and is ignored.
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!isControlDocument()) return;

  const parsed = parseSiteControlRequest(event.data);

  // Not a site-control envelope: some other script on the page posted it.
  if (parsed.outcome === 'ignore') return;

  if (parsed.outcome === 'error') {
    log('Rejected malformed request:', parsed.error.code);
    postToPage(createErrorResponse(parsed.requestId, parsed.error));
    return;
  }

  const request = parsed.request;
  log('Handling request:', request.type);

  if (request.type === 'OPEN_IMPORTER') {
    postToPage(await openImporter(request));
    return;
  }

  postToPage(await forwardToBackground(request));
}

window.addEventListener('message', (event) => {
  void handleSiteControlPageMessage(event);
});

log('Bridge loaded');

export {};

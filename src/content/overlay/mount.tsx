/**
 * Import overlay mount point
 *
 * Owns the overlay's lifecycle on a PlanMyPeak page: a single host element, a
 * shadow root that keeps the two style worlds apart, and one React root.
 *
 * Loaded on demand by the site-control bridge, so React and the export
 * machinery are not paid for on every portal page view.
 */

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import overlayStyles from '@/styles/overlay.css?inline';
import { ImportOverlay } from './ImportOverlay';
import type { SiteControlImportCompletedPayload } from '@/types/siteControl.types';

/** Well-known id so a second mount attempt can find an existing overlay. */
export const OVERLAY_HOST_ID = 'pmp-tp-importer-root';

export interface OverlayOptions {
  /** Pre-select this TrainingPeaks library when the overlay opens */
  preselectedLibraryId?: number | null;
  /** Pre-select this TrainingPeaks training plan when the overlay opens */
  preselectedPlanId?: number | null;
  /** Called once an import finishes, so the bridge can notify the page */
  onImportCompleted?: (payload: SiteControlImportCompletedPayload) => void;
}

interface OverlayInstance {
  host: HTMLElement;
  root: Root;
  queryClient: QueryClient;
  previousBodyOverflow: string;
}

let instance: OverlayInstance | null = null;
let focusNonce = 0;
let options: OverlayOptions = {};

export function isOverlayMounted(): boolean {
  return instance !== null;
}

/**
 * Apply the overlay stylesheet to a shadow root.
 *
 * Prefers constructable stylesheets; falls back to a `<style>` element inside
 * the shadow root for environments without them. Either way the rules stay
 * scoped to the shadow tree and never reach the host document.
 */
function applyStyles(shadow: ShadowRoot): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(overlayStyles);
    shadow.adoptedStyleSheets = [sheet];
    return;
  } catch {
    const style = document.createElement('style');
    style.textContent = overlayStyles;
    shadow.appendChild(style);
  }
}

function render(): void {
  if (!instance) return;

  instance.root.render(
    <StrictMode>
      <QueryClientProvider client={instance.queryClient}>
        <ImportOverlay
          focusNonce={focusNonce}
          preselectedLibraryId={options.preselectedLibraryId ?? null}
          preselectedPlanId={options.preselectedPlanId ?? null}
          onImportCompleted={options.onImportCompleted}
          onClose={unmountOverlay}
        />
      </QueryClientProvider>
    </StrictMode>
  );
}

/**
 * Mount the overlay, or focus it if it is already open.
 *
 * Returns whether an existing overlay was focused rather than a new one
 * mounted, which the bridge reports back to the page.
 */
export function mountOverlay(nextOptions: OverlayOptions = {}): {
  focused: boolean;
} {
  options = nextOptions;

  if (instance) {
    focusOverlay();
    return { focused: true };
  }

  const host = document.createElement('div');
  host.id = OVERLAY_HOST_ID;
  // The host itself carries no visual styling: everything the coach sees lives
  // inside the shadow root, so removing this element restores the page exactly.
  host.style.position = 'relative';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'open' });
  applyStyles(shadow);

  const container = document.createElement('div');
  shadow.appendChild(container);
  document.body.appendChild(host);

  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  instance = {
    host,
    root: createRoot(container),
    // The overlay runs in its own JavaScript context, so it keeps its own
    // cache rather than sharing the popup's.
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
      },
    }),
    previousBodyOverflow,
  };

  render();
  return { focused: false };
}

/**
 * Bring an already-open overlay back to the coach's attention.
 */
export function focusOverlay(): void {
  if (!instance) return;
  focusNonce += 1;
  render();
}

/**
 * Tear the overlay down completely.
 *
 * Restores the host page's scrolling to exactly the value it had before the
 * overlay opened, and leaves no markup behind.
 */
export function unmountOverlay(): void {
  if (!instance) return;

  const { host, root, queryClient, previousBodyOverflow } = instance;
  instance = null;
  options = {};

  root.unmount();
  queryClient.clear();
  host.remove();
  document.body.style.overflow = previousBodyOverflow;
}

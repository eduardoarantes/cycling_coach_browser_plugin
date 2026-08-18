## Context

See `proposal.md` — Why. The constraints that shape this design come from what already exists:

- Content scripts are already injected at `document_start` on `portal.planmypeak.com` and the configured local dev hosts, in both MAIN and ISOLATED worlds (`public/manifest.json`). The ISOLATED world script (`src/content/isolatedWorldBridge.ts`) already relays `window.postMessage` traffic to the background worker, keyed on `event.data.source === 'trainingpeaks-extension-main'`.
- Every TrainingPeaks and PlanMyPeak API call already runs in the background worker behind a `switch` on `RuntimeMessage.type` (`src/background/messageHandler.ts`, ~35 cases), returning `ApiResponse<T>`. Handlers for everything the overlay needs already exist: `GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS`, `GET_PLAN_WORKOUTS`, `GET_PLAN_NOTES`, `GET_PLAN_EVENTS`, `GET_RX_BUILDER_WORKOUTS`, plus the PlanMyPeak library/plan write handlers.
- The React data hooks (`useLibraries`, `useLibraryItems`, `useTrainingPlans`, `usePlanWorkouts`, …) are thin `chrome.runtime.sendMessage` wrappers over those handlers. `chrome.runtime.sendMessage` is available in ISOLATED-world content scripts, so these hooks are reusable outside the popup as-is.
- The import path itself already exists end to end: `planMyPeakAdapter` (transform → validate → upload), the duplicate-library preflight in `ExportDialog`, and progress reporting. The overlay must ride on this rather than fork it.
- The extension currently has exactly one page-facing surface (the MAIN-world auth interceptor, which only ever *reads* page traffic). This change adds the first surface where the page *drives* the extension, so origin gating and payload validation are load-bearing, not decorative.

## Goals / Non-Goals

**Goals:**

- One narrow, versioned, origin-gated door from the page into the extension — not a general-purpose RPC into `RuntimeMessage`.
- Zero duplication of the data path: the page reads the same data, through the same background handlers, as the popup does.
- Zero duplication of the import path: overlay imports and popup imports run the same adapter, the same duplicate preflight, and the same progress reporting.
- The always-on cost of this feature on PlanMyPeak pages stays negligible; the React overlay bundle is only paid for when the coach actually opens it.
- The overlay is invisible to the host page's CSS and leaves no trace when closed.

**Non-Goals:**

- No `externally_connectable` entry point (rejected below; may be added later without changing this protocol).
- No overlay on TrainingPeaks or Intervals.icu pages.
- No change to how TrainingPeaks or PlanMyPeak auth is captured, stored, or validated.
- No new TrainingPeaks or PlanMyPeak API endpoints.
- No Intervals.icu destination in the overlay.

## Decisions

### 1. Transport: `window.postMessage` relayed by a dedicated ISOLATED-world bridge

The page posts a message on its own window; a content script picks it up and forwards it to the background over `chrome.runtime.sendMessage`; the response comes back the same way.

*Why:* the manifest already injects into exactly the origins we want to serve, so the origin allowlist and the injection allowlist are the same list. The PlanMyPeak web app needs no build-time knowledge of the extension ID, which matters because the ID differs between an unpacked dev load and the Web Store build.

*Alternative — `externally_connectable` + `chrome.runtime.sendMessage(EXTENSION_ID, …)`:* a cleaner boundary (the browser enforces the origin match, and `sender.id` is unforgeable), but it forces the extension ID into the web app's build config and needs a second code path for local development. Deferred, not foreclosed: the request/response schema below is transport-agnostic, so an `externally_connectable` listener can be added later that feeds the same handler.

*Alternative — a long-lived `chrome.runtime.connect` port:* unnecessary. Requests are infrequent and the only server-push case (import completion) is already covered by a message the overlay sends when it finishes.

### 2. A new bridge file, not an extension of `isolatedWorldBridge.ts`

`src/content/siteControlBridge.ts` is a new ISOLATED-world content script registered only for PlanMyPeak origins. The existing `isolatedWorldBridge.ts` (auth relay, all origins) is left untouched.

*Why:* the auth bridge is a one-way, fire-and-forget relay with a completely different trust story — it forwards what the page's own traffic already contained. Mixing a request/response control channel into it would blur two very different security postures in one `window.addEventListener('message')` handler. Separate files keep the review surface for "what can the page make the extension do" in one place.

### 3. Distinct protocol namespace

Control messages use `source: 'planmypeak-site-control'` (page → extension) and `source: 'planmypeak-extension'` (extension → page), versus the existing `'trainingpeaks-extension-main'` marker. Envelope: `{ source, version, requestId, type, payload }`; response: `{ source, version, requestId, ok, data | error }`.

*Why:* the two channels must never cross-trigger. A distinct marker also means the existing auth-bridge tests keep their meaning.

`requestId` is generated by the page and echoed verbatim, so the page can multiplex concurrent requests. The extension treats it as an opaque string and never interprets it.

### 4. The page names *site-control* request types, never `RuntimeMessage` types

The bridge accepts a closed set of site-control types (`PING`, `GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS`, `GET_PLAN_CONTENTS`, `OPEN_IMPORTER`) and maps each to the corresponding background handler. It sends the background a single envelope message — `SITE_CONTROL_REQUEST` — carrying the validated site-control type and payload; the background's `switch` gains one new case that dispatches internally to the existing handlers.

*Why:* if the page could name a `RuntimeMessage` type directly, every handler ever added to that switch would automatically become page-reachable — including `GET_TOKEN`, `GET_INTERVALS_API_KEY`, and every write handler. The indirection makes the page-reachable surface an explicit, reviewable list that does not grow by accident. `GET_PLAN_CONTENTS` deliberately fans out to `GET_PLAN_WORKOUTS` + `GET_PLAN_NOTES` + `GET_PLAN_EVENTS` + `GET_RX_BUILDER_WORKOUTS` in one call, because the page always needs them together.

*Alternative — pass `RuntimeMessage` through with a denylist:* rejected. Denylists fail open; every new handler would be page-exposed until someone remembered to deny it.

### 5. Origin checked twice, and rejection is silent

The bridge checks `event.source === window`, `event.origin === window.location.origin`, and that the origin matches `PLANMYPEAK_CONTROL_ORIGINS` from `src/utils/constants.ts`. The background independently re-checks `sender.origin` (falling back to the origin of `sender.tab.url`) against the same list before dispatching, and rejects any `SITE_CONTROL_REQUEST` that did not come from a content script in a tab.

*Why twice:* the content-script check is the cheap first gate but lives in a world the page shares a DOM with; the background check is the one that actually protects the handlers, and it uses a value the page cannot set.

*Why silent:* a non-allowlisted origin gets no response at all rather than an error, so an arbitrary site cannot use the channel to fingerprint whether the extension is installed. This is why the spec makes "no response within the page's timeout" the defined way to detect absence.

### 6. Presence response reports readiness, never credentials

`PING` returns `{ protocolVersion, extensionVersion, trainingPeaks: { authenticated }, planMyPeak: { authenticated } }` — booleans derived from the existing auth services, with no token, key, timestamp-derived secret, or user identifier.

*Why:* the site's real need is "can I show the Import button, and what should I tell the coach if not". Everything beyond that is credential surface for no product gain. This is stated as a hard requirement in the spec so it survives future additions to the response shape.

### 7. Two content-script bundles: a tiny always-on bridge, a lazily-loaded overlay

`siteControlBridge.ts` is registered in the manifest and stays dependency-light (schemas + constants, no React). The overlay is a separate module that the bridge pulls in with a dynamic `import()` the first time `OPEN_IMPORTER` is handled.

*Why:* the bridge runs on every PlanMyPeak page view; the overlay is opened rarely. Statically importing React, TanStack Query and the adapter into the always-injected script would tax every portal page load for a feature most page views never use. Dynamic import keeps the chunk out of the initial content-script bundle while still shipping it inside the extension (no remote code — the chunk is an extension asset, satisfying MV3 and the existing strict CSP).

### 8. Overlay renders into a shadow root with adopted stylesheets

The overlay mounts a single host element (`<div id="pmp-tp-importer-root">`) on `document.body`, attaches an open shadow root, and mounts the React tree inside it. Tailwind is compiled into a dedicated overlay stylesheet imported as a string (`?inline`) and adopted into the shadow root — not injected into the document.

*Why:* the spec requires that overlay styles never touch host elements and host styles never alter the overlay. A shadow root gives both directions for free. Importing the CSS as a string rather than letting the bundler inject a document-level `<style>` is the part that actually keeps it out of the host page; the overlay stylesheet also drops the `body { … }` base rules in `globals.css`, which are meaningless (and harmful) inside a shadow root.

*Alternative — an `<iframe>` pointing at an extension page:* perfect isolation, but it needs `web_accessible_resources`, complicates sizing/focus/Escape handling, and cuts the overlay off from the host page context for no benefit here. Rejected.

### 9. The overlay reuses the popup's hooks and the existing import machinery

The overlay creates its own `QueryClient` (separate cache from the popup — different JS context, so sharing is not possible anyway) and reuses `useLibraries`, `useLibraryItems`, `useTrainingPlans`, `usePlanWorkouts`, `usePlanNotes`, `usePlanEvents`, `useMyPeakAuth`, `useAuth`. Import runs through `planMyPeakAdapter` and the existing `useExport` / `useMultiLibraryExport` flow.

*Why:* it is the only way to honor the "parity with the popup import" requirement without keeping two implementations in step by hand.

*One refactor this forces:* `useExport.ts` and `useMultiLibraryExport.ts` currently import `TrainingPlanExportProgressDialogState` from `@/popup/components/export/ExportDialog`, i.e. the hooks depend on a popup component. That type moves to `src/types/export.types.ts` and the component re-exports it, so the hooks become popup-independent. Type-only move, no behavior change.

The duplicate preflight logic (currently inline in `ExportDialog.tsx`) is extracted into a shared, UI-free helper that both the dialog and the overlay call, so `Replace` / `Append` / `Ignore Upload` semantics cannot drift between the two surfaces.

### 10. Singleton overlay, and completion is reported back to the requesting page

A module-level reference plus the well-known host element id makes a second `OPEN_IMPORTER` focus the existing overlay instead of mounting a second one. The bridge remembers the `requestId` that opened the overlay; when the import finishes, the overlay hands the outcome to the bridge, which posts `IMPORT_COMPLETED` to the page with `{ ok, importedCount, failedCount }` — and nothing else.

## Risks / Trade-offs

- **A page-driven entry point into the extension is a new attack surface.** → Closed request-type allowlist (decision 4), origin checked in both the content script and the background against the same constant (decision 5), Zod validation of every envelope and payload before dispatch, silent rejection of non-allowlisted origins, and a spec-level requirement that no credential ever appears in a page-bound message. Unit tests cover each rejection path explicitly.
- **A compromised or XSS'd PlanMyPeak page could read the coach's TrainingPeaks data through the channel.** → Accepted and bounded: that page can already act as the coach inside PlanMyPeak, and the channel exposes read-only TrainingPeaks content plus an import into that same coach's PlanMyPeak account. It exposes no credentials and no ability to write to TrainingPeaks. Opening the overlay does not itself import anything — the import always requires a click in extension-owned UI inside the shadow root, which the page cannot script.
- **Strict CSP on the portal could interfere with adopted stylesheets or the dynamically imported chunk.** → Content scripts run in the isolated world and are governed by the extension's CSP, not the page's, and `adoptedStyleSheets` on a shadow root is not subject to the page's `style-src`. Flagged as an explicit verification step against the real portal before the change is considered done, because getting this wrong is invisible in unit tests.
- **A second React bundle now ships inside the extension.** → Lazy-loaded (decision 7), so it costs nothing until opened; measured against the existing <2MB budget as part of the work.
- **Extracting the duplicate preflight out of `ExportDialog` touches a well-exercised path.** → Pure extraction with no behavior change, guarded by the existing export dialog tests, which must pass untouched.
- **The overlay is torn down by a full page reload mid-import.** → The upload itself runs in the background worker and continues; the overlay loses its progress view. Accepted for this change: the page can re-open the overlay, and the completion message is posted to whatever page is listening. Resumable progress reattachment is deliberately out of scope.
- **The protocol becomes a public contract the PlanMyPeak site depends on.** → `version` is in every envelope from day one, and `PING` reports it, so the site can feature-detect rather than assume.

## Migration Plan

Purely additive; nothing existing changes behavior.

1. Ship the extension side first. Until the PlanMyPeak site sends a request, the only runtime cost is one small content script that registers a `message` listener on portal pages.
2. The PlanMyPeak site adopts it behind a feature flag: `PING` on load, show the "Import from TrainingPeaks" affordance only on a successful response, hide it on timeout.
3. Rollback is removing the `siteControlBridge` entry from `content_scripts` — the site's `PING` then times out and it hides the affordance on its own.

No storage schema changes, no stored-data migration, and no change to any existing message type, so an older site build and a newer extension (or the reverse) degrade to "feature not available" rather than breaking.

## Open Questions

- The exact ergonomics of the page-side helper the PlanMyPeak app will use (a documented snippet in `PLANMYPEAK_INTEGRATION.md` versus a small published module). The wire protocol is fixed either way, so this can be settled while implementing without touching the specs.
- Whether the overlay should offer athlete-group import too. The background handler (`IMPORT_ATHLETE_GROUPS_TO_PLANMYPEAK`) already exists, but the request scoped this to workouts, libraries and training plans; adding it later is a new request type plus an overlay tab, and changes nothing in this design.

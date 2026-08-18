## Why

Today the only way a coach can move TrainingPeaks content into PlanMyPeak is to leave the PlanMyPeak portal, click the extension's toolbar icon, and drive the whole selection-and-export flow inside a 480px browser-action popup. The extension already holds the TrainingPeaks session token and knows how to read libraries, library items, training plans and plan workouts — but the PlanMyPeak web app has no way to ask for any of it. The result is a disjointed onboarding: the coach is in PlanMyPeak, wants TrainingPeaks content in PlanMyPeak, and has to switch contexts to a separate popup that knows nothing about where they were or what they were doing.

This change lets the PlanMyPeak site itself initiate and host the import: the site asks the extension for TrainingPeaks data, the extension renders a picker overlay on the PlanMyPeak page, and the coach triggers the import without ever leaving the portal.

## What Changes

- Add a **page → extension control channel** on PlanMyPeak origins. The PlanMyPeak web app posts typed requests via `window.postMessage`; the existing isolated-world content script validates and forwards them to the background worker over `chrome.runtime.sendMessage`, and posts typed responses back to the page. No extension ID needs to be embedded in the web app, and the channel only exists on origins the manifest already injects into (`portal.planmypeak.com` plus the configured local dev hosts).
- Add a **presence/handshake request** so the PlanMyPeak app can detect whether the extension is installed, which protocol version it speaks, and which TrainingPeaks/PlanMyPeak auth states are currently satisfied — enabling the site to show or hide its "Import from TrainingPeaks" affordance instead of guessing.
- Expose **read access to TrainingPeaks data** through the channel: workout libraries, the items (workouts) inside a library, training plans, and the workouts/notes/events belonging to a plan. These reuse the existing background handlers (`GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS`, `GET_PLAN_WORKOUTS`, `GET_PLAN_NOTES`, `GET_PLAN_EVENTS`, `GET_RX_BUILDER_WORKOUTS`) rather than introducing a second data path.
- Add an **in-page import overlay**: a React app mounted by a content script into a shadow root on the PlanMyPeak page. It lists the TrainingPeaks libraries/plans returned over the channel, lets the coach browse the workouts inside them, select what to import, and press Import.
- **Trigger the import into PlanMyPeak** from the overlay using the existing PlanMyPeak export adapter and background API client, including the established duplicate-library preflight (`Replace` / `Append` / `Ignore Upload`) and live progress reporting, so overlay imports and popup imports produce identical results.
- Enforce **origin and consent gating**: requests are accepted only from allowlisted PlanMyPeak origins, the overlay is only ever opened in response to a request from such an origin, and no TrainingPeaks token or raw credential is ever passed to the page — the page receives workout data and import outcomes, never auth material.

Non-goals for this change: opening the overlay on non-PlanMyPeak sites, an `externally_connectable` entry point, importing into Intervals.icu from the overlay, and any change to how TrainingPeaks or PlanMyPeak auth is captured or validated.

## Capabilities

### New Capabilities

- `planmypeak-site-control`: A versioned, origin-gated request/response protocol that lets the PlanMyPeak web app detect the extension, read TrainingPeaks workout libraries, workouts and training plans through it, and ask it to open the import UI — without ever receiving auth credentials.
- `planmypeak-import-overlay`: An in-page overlay, injected by the extension into PlanMyPeak pages, that displays the TrainingPeaks libraries, workouts and training plans, lets the coach select content, and triggers the import into PlanMyPeak with duplicate handling and progress feedback.

### Modified Capabilities

<!-- No existing specs under openspec/specs/; nothing to modify. -->

## Impact

- **Code (new)**:
  - `src/content/siteControlBridge.ts` — origin allowlist, request validation, page ↔ background relay.
  - `src/content/overlay/` — overlay mount (shadow DOM), React root, and overlay-specific components.
  - `src/schemas/siteControl.schema.ts` — Zod schemas for every inbound page request and outbound response.
  - `src/types/siteControl.types.ts` — protocol message contracts and version constant.
- **Code (modified)**:
  - `public/manifest.json` — register the overlay content script and add `web_accessible_resources` for overlay assets on PlanMyPeak origins.
  - `vite.config.ts` — add the overlay entry point alongside the popup input.
  - `src/background/messageHandler.ts` — route site-control requests, reusing existing TrainingPeaks and PlanMyPeak handlers.
  - `src/types/index.ts` — add the new runtime message types to `RuntimeMessage`.
  - `src/utils/constants.ts` — PlanMyPeak origin allowlist for the control channel.
  - `src/export/adapters/planMyPeak/` and `src/hooks/useExport.ts` — reused as-is by the overlay; extracted where they are currently popup-coupled.
- **Security surface**: a new page-facing entry point into the extension. Mitigated by strict origin checks on both `window.postMessage` receipt and `sender.origin` in the background, Zod validation of every payload, an explicit allowlist of permitted request types, and a hard rule that tokens never cross into the page.
- **Bundle**: adds a second React bundle (the overlay) injected into PlanMyPeak pages; must stay within the existing <2MB budget and must not leak Tailwind styles into the host page.
- **Tests**: new unit tests for the origin allowlist, request-schema validation, background routing of site-control messages, and overlay selection/import behavior; existing popup export tests must continue to pass unchanged.

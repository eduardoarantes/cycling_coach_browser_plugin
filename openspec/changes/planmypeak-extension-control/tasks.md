## 1. Protocol Contract

- [ ] 1.1 Add `src/types/siteControl.types.ts`: envelope types (`SiteControlRequest`, `SiteControlResponse`), the `PLANMYPEAK_SITE_CONTROL_VERSION` constant, the page/extension `source` markers, and the closed union of site-control request types (`PING`, `GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS`, `GET_PLAN_CONTENTS`, `OPEN_IMPORTER`)
- [ ] 1.2 Add `src/schemas/siteControl.schema.ts`: Zod schemas for the request envelope and each request payload, plus a discriminated-union parser that rejects unknown types
- [ ] 1.3 Add `PLANMYPEAK_CONTROL_ORIGINS` to `src/utils/constants.ts`, derived from the same production/local target resolution the manifest and interceptor already use, with an `isPlanMyPeakControlOrigin(origin)` helper
- [ ] 1.4 Add `SiteControlRequestMessage` (`type: 'SITE_CONTROL_REQUEST'`) to `src/types/index.ts` and include it in the `RuntimeMessage` union
- [ ] 1.5 Unit tests for the schemas and the origin helper: valid envelope parses, unknown request type rejected, malformed payload rejected, production/local origins accepted, lookalike origins (`portal.planmypeak.com.evil.test`, `planmypeak.com`) rejected

## 2. Background Routing

- [ ] 2.1 Add `handleSiteControlRequest` in `src/background/messageHandler.ts`: re-validate `sender.origin` (falling back to `sender.tab.url`) against `isPlanMyPeakControlOrigin`, reject requests with no tab sender, and dispatch the validated site-control type to the existing handlers
- [ ] 2.2 Implement `PING`: return `{ protocolVersion, extensionVersion, trainingPeaks: { authenticated }, planMyPeak: { authenticated } }` from the existing auth services, asserting no credential fields are present
- [ ] 2.3 Map `GET_LIBRARIES`, `GET_LIBRARY_ITEMS`, `GET_TRAINING_PLANS` onto the existing TrainingPeaks handlers, preserving `ApiResponse<T>` error shapes
- [ ] 2.4 Implement `GET_PLAN_CONTENTS` as a fan-out over `GET_PLAN_WORKOUTS`, `GET_PLAN_NOTES`, `GET_PLAN_EVENTS` and `GET_RX_BUILDER_WORKOUTS`, returning one combined result and failing as a whole if any leg fails
- [ ] 2.5 Add the `SITE_CONTROL_REQUEST` case to the message `switch`
- [ ] 2.6 Unit tests: allowlisted origin dispatches, non-allowlisted `sender.origin` is rejected without touching any handler, senderless/extension-page requests rejected, unauthenticated TrainingPeaks yields an authentication-required error, upstream API failure surfaces as an error response, and no response body contains token or key material

## 3. Page ↔ Extension Bridge

- [ ] 3.1 Add `src/content/siteControlBridge.ts` (ISOLATED world): listen for `message`, require `event.source === window`, `event.origin === location.origin`, an allowlisted origin, and the `planmypeak-site-control` source marker; ignore everything else silently
- [ ] 3.2 Validate the envelope with the Zod parser, forward valid requests to the background as `SITE_CONTROL_REQUEST`, and post the response back to the page with the original `requestId` and the `planmypeak-extension` source marker
- [ ] 3.3 Return a schema-validation error response for allowlisted origins that send malformed or unsupported requests, and no response at all for non-allowlisted origins
- [ ] 3.4 Handle `OPEN_IMPORTER` by dynamically importing the overlay module, mounting it (or focusing the existing instance), and remembering the originating `requestId` for the completion message
- [ ] 3.5 Register `siteControlBridge.ts` in `public/manifest.json` `content_scripts` for PlanMyPeak origins only (ISOLATED world), and extend `vite.config.ts`'s local-host augmentation so local dev origins get it too
- [ ] 3.6 Unit tests for the bridge: allowlisted valid request is forwarded, non-allowlisted origin produces no `sendMessage` call and no response, cross-window/`event.source` mismatch ignored, auth-bridge (`trainingpeaks-extension-main`) messages are not handled by this bridge, response echoes the `requestId`

## 4. Shared Import Logic Extraction

- [ ] 4.1 Move `TrainingPlanExportProgressDialogState` from `src/popup/components/export/ExportDialog.tsx` into `src/types/export.types.ts`, re-export it from the dialog for compatibility, and update `useExport.ts` / `useMultiLibraryExport.ts` imports so the hooks no longer depend on popup components
- [ ] 4.2 Extract the duplicate-container preflight from `ExportDialog.tsx` into a UI-free helper (existing-library lookup + `replace` / `append` / `ignore` resolution) that both the dialog and the overlay call
- [ ] 4.3 Repoint `ExportDialog.tsx` at the extracted helper with no behavior change, and confirm the existing export dialog and export hook tests pass untouched

## 5. Import Overlay

- [ ] 5.1 Add `src/content/overlay/mount.tsx`: create the `pmp-tp-importer-root` host element, attach an open shadow root, adopt the overlay stylesheet, mount the React root, and expose `mountOverlay` / `focusOverlay` / `unmountOverlay` with a module-level singleton guard
- [ ] 5.2 Add `src/styles/overlay.css` (Tailwind, imported `?inline`, without the `globals.css` `body` base rules) and wire it into the shadow root via `adoptedStyleSheets`
- [ ] 5.3 Add the overlay React root with its own `QueryClient`, an Escape/close-button dismiss that fully unmounts and restores host-page scroll, and a container that does not shift host-page layout
- [ ] 5.4 Build the browse view: libraries list, library workouts, training plans list, and plan contents — reusing `useLibraries`, `useLibraryItems`, `useTrainingPlans`, `usePlanWorkouts`, `usePlanNotes`, `usePlanEvents`, with distinct loading, empty, and error-with-retry states
- [ ] 5.5 Build the connection gate: use `useAuth` and `useMyPeakAuth` to block import when TrainingPeaks or PlanMyPeak is unauthenticated, naming the missing connection and offering a way to open it and re-check
- [ ] 5.6 Build selection: whole-library and per-workout selection, training-plan selection, a live summary of what will be imported, import disabled on empty selection, and a warning listing workouts whose type PlanMyPeak does not support
- [ ] 5.7 Honor an `OPEN_IMPORTER` payload that names a library or plan by pre-selecting it on open
- [ ] 5.8 Add `web_accessible_resources` for any overlay assets referenced by URL, scoped to PlanMyPeak origins

## 6. Import Execution

- [ ] 6.1 Wire the overlay's Import action to `planMyPeakAdapter` via the existing export hooks so transformation and upload match the popup path
- [ ] 6.2 Run the extracted duplicate preflight before upload and render the amber `Replace` / `Append` / `Ignore Upload` panel, matching the export dialog's wording and button order
- [ ] 6.3 Render import progress (current phase, items processed of total) from the existing progress state
- [ ] 6.4 Render the outcome: success count and destination container, or a partial-failure report listing each failed item with its reason; never report a partial failure as success
- [ ] 6.5 Post `IMPORT_COMPLETED` back to the requesting page through the bridge with `{ ok, importedCount, failedCount }` and no credential material, only when the overlay was opened by a page request
- [ ] 6.6 Unit tests: selection-to-payload mapping, empty selection blocks import, each duplicate action produces the expected upload behavior, partial failure is reported as partial, and the completion message contains no credentials

## 7. Verification and Documentation

- [ ] 7.1 Run `npm run type-check`, `npm run lint`, and `npm run test:unit`; all pass
- [ ] 7.2 Run `npm run build` and confirm the overlay chunk is emitted as a lazy chunk (absent from the bridge content script's initial bundle) and the total stays within the <2MB budget
- [ ] 7.3 Manual verification against a real PlanMyPeak page: `PING` responds, the overlay mounts under the portal's CSP with adopted stylesheets applied, host-page styling is unaffected, and closing the overlay leaves no residue
- [ ] 7.4 Manual verification of import parity: import the same library from the overlay and from the popup and confirm the PlanMyPeak result is equivalent, including the duplicate `Replace` / `Append` / `Ignore Upload` paths
- [ ] 7.5 Manual verification that a non-allowlisted origin gets no response (test page on another origin)
- [ ] 7.6 Document the wire protocol in `PLANMYPEAK_INTEGRATION.md` — envelope shape, request types, `PING` feature detection with a timeout, and the `IMPORT_COMPLETED` notification — and add the page-side snippet the PlanMyPeak app will use
- [ ] 7.7 Update `docs/EXPORT_DESTINATION_INTEGRATION_FLOW.md` and `CLAUDE.md` with the site-control channel and the overlay surface

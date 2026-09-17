## Why

A coach who builds a workout on an athlete's TrainingPeaks calendar has no quick way to get that workout into PlanMyPeak: today the extension only exports whole libraries and training plans, and a calendar workout is neither. The extension already runs a main-world interceptor on `app.trainingpeaks.com` that sees every `fetch`/XHR the page makes, so it can observe the `POST /fitness/v6/athletes/{athleteId}/workouts` call at the moment the workout is created and keep a copy. Once kept locally, the workout can be sent to PlanMyPeak's default library ("My Library") later without asking TrainingPeaks for it again.

Feasibility: yes. The create payload the coach shared carries everything the PlanMyPeak transformer already consumes for plan workouts (`title`, `workoutTypeValueId`, `structure`, `totalTimePlanned`, `tssPlanned`, `ifPlanned`, `description`, `coachComments`). The one gap is `workoutId`, which is `0` in the request and only assigned in the response, so the interceptor must read the response too.

## What Changes

- **Capture workout creation on TrainingPeaks.** The main-world interceptor additionally watches `POST …/fitness/v6/athletes/{athleteId}/workouts` (both `fetch` and XHR, production and sandbox hosts). On a successful response it posts the request body plus the response body to the isolated bridge, which relays a new `WORKOUT_CAPTURED` runtime message to the background worker. The page's own request is never delayed, altered, or failed by the capture.
- **Keep the captured workout locally.** The background validates the capture with Zod, normalizes it into the existing TrainingPeaks plan-workout shape (parsing the `structure` JSON string, dropping the derived `polyline`), and stores it in `chrome.storage.local` keyed by `environment:athleteId:workoutId`, with every write serialized in the background. There is no cap on the number of stored workouts; each is stored compactly so hundreds fit within the default storage quota. After capture, sending to PlanMyPeak reads only the stored copy, never TrainingPeaks.
- **Keep the stored copy current.** A `PUT …/workouts/{workoutId}` for a workout that is already captured refreshes the stored copy, so the coach does not send a stale structure after editing. Edits to workouts that were never captured are ignored.
- **Notify the coach.** The extension icon shows a badge with the count of captured workouts awaiting action. The export-progress badge keeps priority while an export is running; the pending count reappears when it clears. Inside the popup a new **New Workouts** tab carries a dot while there are pending items.
- **Send to PlanMyPeak.** The new tab lists captured workouts newest first with a **Send to PlanMyPeak** action per row and a **Send all pending** action. Sending runs the shared PlanMyPeak path (`planMyPeakAdapter.transform` → `validate` → `export`) with the target resolved to the coach's default library (`isDefault: true`, the one PlanMyPeak shows as "My Library") and a namespaced provider id (`cal:{workoutId}`, `cal-sandbox:{workoutId}`). Sends are blocked by the same TrainingPeaks/PlanMyPeak account-mismatch gate as every other import. The background upload loop records each workout's outcome as it goes, so closing the popup mid-send loses nothing. A successful send marks the row **Sent**; the coach can also **Dismiss** a row or clear sent rows.
- **Shared contract additions.** `ExportResult` gains optional per-item results keyed by provider id, and `PlanMyPeakExportConfig` gains `providerIdNamespace`. Both are additive; the export dialog and overlay are unaffected.
- **No new page-facing surface.** The PlanMyPeak site-control channel is unchanged: captured workouts are not exposed through `PING.supports` or any new request type.

## Capabilities

### New Capabilities

- `tp-workout-capture`: Observing workout creation (and edits of already-captured workouts) on TrainingPeaks in the page's main world, relaying it to the background, validating and normalizing it, and persisting it in local extension storage with a pending / sent / dismissed lifecycle.
- `captured-workout-notification`: Surfacing pending captured workouts to the coach through the extension action badge (count) and a dot on the popup's New Workouts tab, coordinated with the existing export-progress badge.
- `captured-workout-send-to-planmypeak`: Sending one or all pending captured workouts from local storage to the coach's default PlanMyPeak library through the shared adapter path, with account-mismatch gating, per-item result reporting, and local status updates.

### Modified Capabilities

<!-- `openspec/specs/` is empty; no existing capability requirements change. -->

## Impact

- **Content scripts**
  - `src/content/mainWorldInterceptor.ts` — detect the workout create/update URLs, read request body (string / `Request` body) and cloned response, post `TP_WORKOUT_CREATED` / `TP_WORKOUT_UPDATED` to the isolated world. Pure URL/body helpers extracted next to `requestInfo.ts` so they are unit-testable without patching `fetch`.
  - `src/content/isolatedWorldBridge.ts` — accept the two new main-world message types and forward them as `WORKOUT_CAPTURED` (no schema imports; the bridge stays dependency-light).
- **Background**
  - `src/types/index.ts` — `WorkoutCapturedMessage`, `GetCapturedWorkoutsMessage`, `UpdateCapturedWorkoutMessage`, `RemoveCapturedWorkoutsMessage`.
  - `src/schemas/capturedWorkout.schema.ts` — Zod schemas for the TrainingPeaks create request/response subset we keep and for the stored record.
  - `src/services/capturedWorkoutService.ts` — storage read/write/update, normalization (structure string → object, polyline stripped), pending count.
  - `src/services/badgeService.ts` (new) — single owner of `chrome.action` badge text; `exportProgressService.updateBadge` falls through to it when export state is idle.
  - `src/background/messageHandler.ts` — route the new messages; verify `sender.url` is a TrainingPeaks app origin before storing a capture.
  - `src/background/index.ts` — refresh the badge on `onStartup` / `onInstalled`.
- **Popup**
  - `src/popup/components/TabNavigation.tsx` — fourth tab **New Workouts** with pending dot.
  - `src/popup/components/CapturedWorkoutList.tsx` (new) and `CapturedWorkoutRow.tsx` (new).
  - `src/hooks/useCapturedWorkouts.ts` (new) — storage-backed list with `chrome.storage.onChanged` subscription; `useSendCapturedWorkouts.ts` (new) — transform/validate/export via `planMyPeakAdapter` with `createFolder: false`.
  - `src/export/adapters/planMyPeak/trainingPlanNormalizer.ts` — reused as-is to turn a stored workout into the `LibraryItem` shape the transformer consumes.
- **Constants**: `STORAGE_KEYS.CAPTURED_WORKOUTS`; TrainingPeaks app origins already exist in `TRAININGPEAKS_ENVIRONMENTS`.
- **Manifest / permissions**: none. Host permissions and content-script matches already cover both TrainingPeaks app hosts; `storage` is already granted.
- **Tests**: unit tests for the URL/body helpers, the bridge forwarding, the capture schema and normalizer, the service (store, refresh on update, status transitions, pending count), the badge arbitration, the message handler (origin gate, routing), the hooks, and the list/row components. `npm run build` for extension verification.
- **Security / privacy**: the capture carries no credentials; the `Authorization` header is never included in the relayed message. Only the two documented TrainingPeaks endpoints are watched. Nothing new crosses into any page.
- **Known limits**: only workouts created through the documented `POST` endpoint are captured; other TrainingPeaks flows that create calendar workouts (for example, applying a library item to the calendar) use endpoints that have not been observed and are out of scope until they are. Athlete names are not available from the capture, so rows show the athlete id and workout day.

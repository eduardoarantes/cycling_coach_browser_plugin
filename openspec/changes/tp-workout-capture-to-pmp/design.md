## Context

The extension already has every building block this feature needs; none of them currently touch calendar workouts.

- **Interception.** `src/content/mainWorldInterceptor.ts` runs in the page's main world on `app.trainingpeaks.com` and `app.sandbox.trainingpeaks.com`, wrapping `window.fetch`, `XMLHttpRequest.prototype.open` and `setRequestHeader`. It reads only URLs and headers today; it never reads a request body or a response. Pure helpers (`extractRequestInfo`, `toAbsoluteUrl`) live in `src/content/requestInfo.ts` so they can be unit-tested without patching `fetch`.
- **Relay.** `src/content/isolatedWorldBridge.ts` accepts `window.postMessage` events whose `source` is `trainingpeaks-extension-main` and forwards two message types (`TP_TOKEN_FOUND`, `MY_PEAK_AUTH_FOUND`) to the background with `chrome.runtime.sendMessage`. It imports nothing.
- **Background.** `src/background/messageHandler.ts` routes `RuntimeMessage` by `type`. Storage is `chrome.storage.local` with keys in `STORAGE_KEYS` and Zod validation on read.
- **Badge.** `src/services/exportProgressService.ts` owns `chrome.action` badge text for export progress (`n/m`, `✓`, `!`) and clears it when idle.
- **PlanMyPeak path.** `planMyPeakAdapter.transform(items: LibraryItem[], config)` → `validate` → `export`. `export` resolves the target library: an explicit `targetLibraryId`, else create/reuse by name when `createFolder !== false`, else the coach's default library (`isDefault: true`), which listing guarantees exists. Upload is `POST /workouts/library/`, an upsert keyed by `provider + providerWorkoutId`.
- **Calendar-shaped workouts already flow through that path.** `src/export/adapters/planMyPeak/trainingPlanNormalizer.ts` turns a `PlanWorkout` (`workoutId`, `title`, `workoutTypeValueId`, `structure` object, planned metrics) into the `LibraryItem` shape the transformer consumes, using `workoutId` as `exerciseLibraryItemId`, hence as `provider_workout_id`.
- **The create call.** `POST https://tpapi.trainingpeaks.com/fitness/v6/athletes/{athleteId}/workouts` with a JSON body. The body's `workoutId` is `0`; the assigned id is only in the response. `structure` is a JSON **string** in the body, and it carries a large `polyline` array the transformer discards.
- **Gates.** Imports are blocked on a confirmed TrainingPeaks/PlanMyPeak account mismatch (`AccountMismatchBanner` in the popup, `usePlanMyPeakAccountMatch`).

## Goals / Non-Goals

**Goals:**

- Capture a workout at the moment the coach creates it on TrainingPeaks, from either `fetch` or XHR, on both TrainingPeaks environments, without ever affecting the page's own request.
- Persist an unbounded number of captured workouts locally, compact enough that hundreds fit in the default storage quota, and never re-read TrainingPeaks for a captured workout.
- Keep the stored copy current when the coach edits a captured workout.
- Show the coach that new workouts are waiting (action badge count + tab dot) without fighting the export-progress badge.
- Send any pending captured workout, one or all, to the coach's default PlanMyPeak library through the shared adapter path, behind the same account-mismatch gate as every other import.
- Add no page-facing surface and no new permission.

**Non-Goals:**

- Capturing workouts created through TrainingPeaks flows that use other endpoints (applying a library item to a calendar day, copy/paste, plan application). Those endpoints have not been observed; each is a later, separate capture rule.
- Sending to a library other than the default one, or creating libraries. The request is "My Library".
- Exposing captured workouts to the PlanMyPeak page via site-control.
- Showing athlete names (the capture only carries `athleteId`).
- Deleting the workout from PlanMyPeak when the coach deletes it on TrainingPeaks.

## Decisions

### Decision 1: Capture from the response, not just the request

The interceptor takes a synchronous handle on the request body (`Request.clone()` for a `Request` input, the string itself for a string body) **without awaiting it**, dispatches the original `fetch` at once, clones the response, and **returns the original response to the page immediately**; a detached promise with its own `catch` then reads the request clone's text and the response clone's JSON concurrently, so the page's request is dispatched and its promise settles exactly when they would have without the interceptor. For XHR it hooks `send(body)` to remember the body and reads `responseText` on the `load` event, which fires after the page's own handlers have been queued and never blocks them. The capture posted to the isolated world is `{ request: <parsed body>, response: <parsed body> }`; `workoutId` and `lastModifiedDate` are taken from the response, everything else is taken from the response when present and from the request otherwise.

- **Why:** The request body has `workoutId: 0`. Without the response there is no stable identity, so re-sends could not upsert and edits could not be matched to the stored copy.
- **Alternatives considered:** Request-only capture with a synthetic id (hash of title+day+structure) — breaks the upsert-by-provider-id contract and cannot follow edits. Polling TrainingPeaks for recent workouts — contradicts "no longer relies on TP" and needs the athlete list.
- **Non-negotiable:** the capture path is wrapped so that any failure (non-JSON body, `ReadableStream` body, clone failure, non-2xx status) is logged in dev and swallowed; the page always gets the original promise/response, and never later than it would have. Only string bodies and `Request` bodies (`request.clone().text()`) are parsed; anything else is skipped. A test with a response whose body resolves after a delay must show the caller's promise settling before the capture is posted.

### Decision 2: Match URLs with an exact path pattern, extracted into a pure helper

`src/content/workoutCaptureDetection.ts` exports `matchTrainingPeaksWorkoutWrite(method, url): { kind: 'create' | 'update'; athleteId: number; workoutId: number | null } | null`. `create` is `POST` on `^/fitness/v6/athletes/(\d+)/workouts/?$`; `update` is `PUT` on `^/fitness/v6/athletes/(\d+)/workouts/(\d+)$`. The host must be one of the two TrainingPeaks API hosts already in `TRAININGPEAKS_ENVIRONMENTS`.

- **Why:** The workouts collection has sibling routes (`.../workouts/{id}/comments`, `.../workouts/{id}/details`) that must not be captured. A substring check would match them. A pure helper mirrors the `requestInfo.ts` pattern and is testable without the interceptor's side effects.
- **Alternative:** Matching by request body shape (`athleteId` + `workoutDay` + `title`) — fragile and still needs the URL for the update case.

### Decision 3: Normalize in the background, not in the content script

The bridge forwards the raw capture as a `WORKOUT_CAPTURED` runtime message with `{ kind, athleteId, workoutId, request, response, timestamp }`. The background validates it with a tolerant Zod schema (`src/schemas/capturedWorkout.schema.ts`) that keeps only the fields the PlanMyPeak transformer and the popup need, parses `structure` when it arrives as a string, drops `polyline`, and stores a `CapturedWorkoutRecord`.

- **Why:** Matches the existing rule that the main-world script and the bridge stay dependency-light and schema-free (the bridge is always injected; the site-control bridge's loader failure mode is the cautionary tale). Validation and shaping belong in one place, and the background is where storage is written.
- **Why drop `polyline`:** it is a derived visualization array that dominates the payload size (the example body is ~5 KB of which most is polyline) and `transformStructure` never reads it. Dropping it is what makes "as many as the coach creates" fit comfortably in the 10 MB default quota without asking for `unlimitedStorage`.
- **Alternative:** Store the raw request/response verbatim — 3–5× larger per record and stores fields (`personalRecords`, `syncedTo`, compliance metrics) that nothing reads.

### Decision 4: Storage shape — one record map keyed by `environment:athleteId:workoutId`

`STORAGE_KEYS.CAPTURED_WORKOUTS = 'captured_workouts'` holds `Record<string, CapturedWorkoutRecord>`:

```
CapturedWorkoutRecord {
  key: `${environment}:${athleteId}:${workoutId}`
  athleteId: number
  workoutId: number
  environment: 'production' | 'sandbox'   // which TP host it came from; part of the key
  capturedAt: number                       // first seen
  updatedAt: number                        // last refreshed from a PUT
  status: 'pending' | 'sent' | 'dismissed'
  sentAt?: number
  planMyPeakWorkoutId?: string
  lastSendError?: string
  workout: PlanWorkout-compatible subset   // title, workoutDay, workoutTypeValueId,
                                           // structure (object, no polyline), totalTimePlanned,
                                           // tssPlanned, ifPlanned, distancePlanned, caloriesPlanned,
                                           // velocityPlanned, energyPlanned, elevationGainPlanned,
                                           // description, coachComments, userTags
}
```

- **Why a map:** upserts on `PUT` and status updates are O(1) and idempotent; a duplicate `create` event (retries, two tabs) collapses into one record. Reads validate with Zod and drop malformed entries rather than failing the whole list.
- **Why `environment` is in the key:** sandbox and production workout ids are separate namespaces, so the same numeric id can name two different workouts. A key without the environment would let one overwrite the other and inherit its lifecycle (`sent`, `planMyPeakWorkoutId`). The popup shows a sandbox marker, and the environment also selects the remote provider-id namespace (Decision 8).
- **Why keep `dismissed` records:** a dismissed workout that the coach later edits on TrainingPeaks must not resurface as pending (the `PUT` refresh updates `workout` but never changes `status`). A **Clear** action removes `sent` and `dismissed` records. There is no automatic eviction; the coach controls the list.
- **Alternative:** Append-only array — simpler to reason about but requires linear scans and produces duplicates on retries.

### Decision 4a: Every mutation of the map is a serialized read-modify-write

`chrome.storage.local.set` is atomic per call, but read-then-set is not: two captures arriving together, or a capture racing a status update, would each read the same map and the second write would drop the first's change. `capturedWorkoutService` therefore runs every mutation (`storeCapture`, `updateCapturedWorkout`, `removeCapturedWorkouts`) through one in-memory promise queue, so each read-modify-write completes before the next begins. This is sufficient because MV3 runs a single service-worker instance, and it holds only if the worker is the sole writer: **the popup and hooks never write the map directly, only through runtime messages.** Reads may bypass the queue.

- **Alternative:** one storage key per record (`captured_workout:<key>`) makes inserts and updates atomic without a queue, but listing needs `get(null)` plus prefix filtering and removal needs a two-step read/remove, so the race just moves. The queue is smaller and testable: two concurrent captures both land; a capture racing a status update loses neither.

### Decision 5: Origin-gate the capture message in the background

`handleMessage` accepts `WORKOUT_CAPTURED` only when `sender.tab` is set and `new URL(sender.url).origin` is one of the two TrainingPeaks app origins from `TRAININGPEAKS_ENVIRONMENTS`. Anything else is ignored with `{ success: false }`.

- **Why:** The message writes durable state that later drives uploads into the coach's PlanMyPeak account. The site-control channel already establishes "check origin in the content script and re-check in the background"; this follows it. The popup can never send this message. Cost is one line.

### Decision 6: One badge owner with a priority rule

New `src/services/badgeService.ts` exposes `refreshBadge()`, which reads export progress and the pending capture count and applies, in order: export `in_progress` → existing progress text; export `completed` / `failed` **and** `Date.now() - completedAt < EXPORT_BADGE_LINGER_MS` (the existing 5 s clear delay) → existing `✓` / `!`; otherwise pending count > 0 → the count (capped display at `99+`) in an amber colour distinct from the blue/green/red export states; otherwise empty. `exportProgressService.updateBadge` delegates the idle branch to `refreshBadge()` instead of clearing; `clearBadgeAfterDelay` calls `refreshBadge()` too. The background calls `refreshBadge()` after every capture write, every status change, and on `chrome.runtime.onStartup` / `onInstalled`.

- **Why:** Two independent writers of `chrome.action.setBadgeText` would race and one would erase the other. Export progress is transient and time-critical, so it wins; the pending count is durable and simply reappears.
- **Why the linger window:** a completed or failed export state stays in storage until the popup dismisses it; only the badge text was cleared by the timer. A refresh that trusted persisted state would redraw `✓` forever, including after a browser restart. Expiring on `completedAt` makes the badge correct regardless of who calls `refreshBadge()` or when.
- **Alternative:** Show a plain dot (`•`) as asked — a count is a dot that also says how many; the tab inside the popup uses an actual dot.

### Decision 7: Popup tab, list, and send path reuse the shared adapter

- `TabNavigation` gains a fourth tab, `captured`, labelled **New Workouts**, rendering a small dot when `pendingCount > 0`. `App.tsx` adds the branch and resets selections like the other tabs.
- `useCapturedWorkouts()` reads the map once, subscribes to `chrome.storage.onChanged` for the key, and returns records sorted by `capturedAt` descending plus `pendingCount`. Storage is the source of truth; no React Query, because the data is local and event-driven (same pattern as `useExportProgress`).
- `useSendCapturedWorkouts()` takes records, maps each to a `LibraryItem` with `normalizeTpPlanWorkoutToPlanMyPeakLibraryItem` (the same bridge plan exports use), then runs `planMyPeakAdapter.transform` → `validate` → `export` with `{ createFolder: false, providerIdNamespace, capturedKeys }`. `createFolder: false` makes `resolveTargetLibrary` pick the `isDefault` library. Transform warnings (e.g. a structure whose targets cannot be expressed) are shown on the row; a workout skipped by `canImportTpItemToPlanMyPeak` stays pending with that reason and is recorded as `lastSendError` through the normal update message.
- **Outcomes are persisted by the background, not the popup.** `EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY` gains an optional `capturedKeys: Record<providerWorkoutId, recordKey>`. When present, the background upload loop marks each record `sent` (with `planMyPeakWorkoutId`, library name, `sentAt`) or stores `lastSendError` immediately after that workout's POST, through the serialized service. The popup only reflects storage. If the popup closes mid-send, the worker keeps looping (it stays alive while awaiting fetches) and every outcome still lands. The popup cannot run the loop itself because the adapter's library resolution and upload go through `sendMessage`.
- **Per-item results are part of the shared contract.** `ExportResult` gains `itemResults?: Array<{ providerWorkoutId: string; success: boolean; remoteId?: string; libraryName?: string; error?: string }>`, populated by the PlanMyPeak adapter from the background's upload summary, whose `failures` now carry `providerWorkoutId` alongside `name`. Identically named workouts and partial failures are then attributable by id, and the dialog and overlay get the same detail for free.
- **The all-failed path keeps the summary.** Today `exportWorkoutsToPlanMyPeakLibrary` short-circuits to `success: false` with only the first error when every upload fails, which throws away the keyed failures `itemResults` needs. `ApiError` has no typed place for a list, so instead the function returns `success: true` with the full summary whenever the loop ran, and an `isTotalUploadFailure(summary)` helper lets the two consumers (`PlanMyPeakAdapter.export`, `trainingPlanExport`) keep producing the same user-facing failure, now with every message in `errors`. `success: false` remains reserved for the cases where no upload was attempted (missing library id).
- The send button is disabled, with the existing banner as the explanation, whenever `usePlanMyPeakAccountMatch` reports a confirmed mismatch or PlanMyPeak is not authenticated. Unknown match state does **not** block here because the popup already fails closed on that in the shared path; this surface just mirrors what `ExportDialog` does.
- **Why the default library by flag, not by name:** "My Library" is the display name of the default library; matching by name would break on rename or localisation, and `isDefault` is what the adapter already trusts.
- **Why not the `ExportDialog`:** the dialog's purpose is destination choice and container naming, both of which are fixed here. The list row's single button is the whole decision. A per-row "Sending…" state and result line replaces the dialog's progress panel; the badge/export-progress banner still shows the upload because `exportWorkoutsToPlanMyPeakLibrary` tracks progress by default.

### Decision 8: Remote identity is a namespaced calendar id

`provider_workout_id` is `cal:{workoutId}` for production captures and `cal-sandbox:{workoutId}` for sandbox captures. The transformer derives the provider id from `exerciseLibraryItemId` today, so `PlanMyPeakExportConfig` gains an optional `providerIdNamespace?: string`; when set, `transformToPlanMyPeak` emits `${namespace}:${id}` for `provider_workout_id` and the matching `source_file`. The hook sets it from the record's environment. PlanMyPeak's `providerWorkoutId` is a free string, so the prefix is legal. A re-send upserts instead of duplicating, and the local `sent` state is a convenience, not a guard.

- **Why:** a bare `workoutId` would share PlanMyPeak's provider-id field with library item ids and with plan-workout ids, and a sandbox workout could overwrite a production one. Namespacing in the transformer, not by rewriting the output in the hook, keeps the shared path the only place identities are minted.
- **Trade-off:** this makes captured workouts the only namespaced provider ids. Library exports still send bare item ids and plan exports bare calendar ids, so their pre-existing collision remains. Migrating those is a separate change: it would turn every existing PlanMyPeak record into a new one on re-import unless the backend maps old ids.

## Risks / Trade-offs

- [TrainingPeaks changes the create endpoint or moves to a different route for some creation flows] → The URL matcher is a single pure helper with tests; a new route is a new case, not a rewrite. The known gap (library-item application) is listed as a non-goal.
- [Reading the response clone for every matched request adds work in the page] → Only the two matched routes are cloned; every other request is untouched. The clone is read off the page's promise chain, so the caller is never delayed. Errors in the capture path are swallowed so the page never sees them.
- [Popup closes while a send is running] → Outcomes are written by the background loop per item, not by the popup after the fact; reopening shows the true state.
- [Concurrent writes to the record map] → All mutations go through one promise queue in the worker; the popup never writes the key directly.
- [Persisted completed/failed export state keeps the badge on `✓`/`!`] → The badge owner expires those states on `completedAt`, so the pending count reappears even after a restart.
- [XHR `send` hook must handle non-string bodies] → Only string bodies are parsed; others are ignored and logged in dev.
- [Two tabs or a retry post the same create twice] → The storage map collapses on `environment:athleteId:workoutId`; the second write is a no-op refresh.
- [Storage growth with no cap] → Polyline stripped, unread fields dropped, records ~1–2 KB. The popup shows the stored count and a **Clear sent & dismissed** action. If a coach ever approaches quota, `unlimitedStorage` is a one-line manifest change and is deliberately not requested now.
- [Badge race with export progress] → Single owner (`badgeService`) with a fixed priority; export services call into it rather than `chrome.action` directly.
- [A captured workout fails PlanMyPeak validation (unsupported target units)] → Row stays pending with the adapter's warning text; the coach can fix it on TrainingPeaks, which refreshes the stored copy through the `PUT` rule, then re-send.
- [Service worker asleep when the page posts] → `chrome.runtime.sendMessage` wakes it; the write is idempotent so a retried message is safe.
- [Stale `sent` state after the coach deletes the workout in PlanMyPeak] → Re-send re-creates it (upsert returns 201); the row's "Sent" label is informational, and re-sending is always allowed.

## Migration Plan

- Purely additive: new storage key, new message types, new tab. No manifest change, no data migration. Rollback is removing the change; the storage key becomes an orphan that a later version can clear.

## Open Questions

- Which other TrainingPeaks actions the coach expects to count as "creating a workout" (drag from library, copy day, apply plan) and what endpoints they hit. Each is a follow-up capture rule once observed.
- Whether the popup should offer to open the TrainingPeaks calendar day for a row (`app.trainingpeaks.com/#calendar/...`). Cheap if a stable URL exists; not required.

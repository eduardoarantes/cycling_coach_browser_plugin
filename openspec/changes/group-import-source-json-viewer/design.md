## Context

The athlete group import screen (`src/popup/components/AthleteGroupList.tsx`) renders one card per group. All cards come from a **single** TrainingPeaks response: `GET /coaches/v2/coaches/{coachId}/tags`, returning an array of tag objects. The request flows through a generic background wrapper:

- `apiRequest<T>()` in `src/background/api/trainingPeaks.ts` fetches, calls `response.json()`, runs `schema.safeParse(json)`, and on success returns `{ success: true, data: validated }`. The raw `json` is used only for error previews and is otherwise **discarded**.
- `fetchAthleteGroups(coachId)` calls `apiRequest` with `AthleteGroupsApiResponseSchema`.
- `handleGetAthleteGroups` (messageHandler) returns that `ApiResponse<AthleteGroup[]>` to the popup.
- `useAthleteGroups()` unwraps `response.data` and exposes only `AthleteGroup[]`.

`ApiResponse<T>` is `{ success: true; data: T } | { success: false; error: ApiError }` (`src/types/api.types.ts`). Reusable pieces already exist: `downloadJsonFile(data, fileName)` in `src/utils/downloadJson.ts`, and the modal shell pattern in `src/popup/components/IntegrationHelpModal.tsx` (backdrop, centered card, close button, click-outside). Icons come from `lucide-react`.

The user confirmed: show the **raw** TrainingPeaks response, and the payload is a **single array for the whole screen** (no per-group endpoint exists).

## Goals / Non-Goals

**Goals:**

- Preserve the raw `/tags` JSON response end-to-end and expose it to `AthleteGroupList`.
- Add one header-level "View source JSON" icon that opens a modal showing the full raw response.
- Provide copy + download + close in the modal, reusing existing utilities and the modal shell.
- Keep the change additive and non-breaking for all other API paths.

**Non-Goals:**

- Per-group source-JSON icons / slicing the array per card (the honest source is the single response).
- Retaining raw JSON for other endpoints (user, libraries, plans) — only athlete groups needs it now.
- Any change to the PlanMyPeak import flow, endpoints, or the import button behavior.
- Syntax highlighting or a JSON tree explorer (plain pretty-printed `<pre>` is sufficient).

## Decisions

### Decision 1: Carry the raw payload via an optional `raw` field on the success `ApiResponse`

Extend the success branch of `ApiResponse<T>` to `{ success: true; data: T; raw?: unknown }`. `apiRequest` populates `raw` with the parsed `json` on success; `fetchAthleteGroups` returns it unchanged; `handleGetAthleteGroups` passes it through; `useAthleteGroups` exposes it.

- **Why:** Additive and optional, so it is backward-compatible — existing callers ignore `raw` and their types still hold. It reuses the single wrapper rather than forking a bespoke fetch path, and it generalizes cleanly if a future "view source" feature is wanted elsewhere.
- **Alternatives considered:**
  - _Dedicated non-generic `fetchAthleteGroupsWithRaw`_ that returns `{ data, raw }`: avoids touching the shared type but duplicates the fetch/validate/log logic and diverges from the established pattern.
  - _New message type `GET_ATHLETE_GROUPS_RAW`_ returning only raw JSON: doubles the network calls and message surface for data already fetched.
  - _Store raw JSON in the React Query cache under a second key_: more moving parts than threading one optional field.

### Decision 2: Expose `rawResponse` from `useAthleteGroups` without changing the query's data type

`useAthleteGroups` keeps returning `UseQueryResult<AthleteGroup[], Error>` for existing consumers. The raw payload is captured in the query function into a ref/closure or returned via a small wrapper. Simplest concrete approach: change the query's data to a struct `{ groups, raw }` internally and have the hook surface `data.groups` as before plus a `rawResponse` accessor — but to avoid churn at call sites, prefer keeping `data: AthleteGroup[]` and adding the raw payload as an extra returned property from the hook.

- **Why:** `AthleteGroupList` is the only consumer; a minimal, backward-compatible hook surface avoids ripples.
- **Trade-off:** Slightly less "pure" React Query shape, but keeps the blast radius to one component.

### Decision 3: One header icon + a new `GroupSourceJsonModal` component

Add a `lucide-react` icon button (e.g. `Braces` or `Code`) to the header row in `AthleteGroupList` next to the group count. Local state (`isJsonOpen`) toggles a new `GroupSourceJsonModal` that receives the raw payload. The modal reuses the `IntegrationHelpModal` shell (backdrop, centered card, close button, click-outside) and renders `JSON.stringify(raw, null, 2)` inside a scrollable `<pre>`. Copy uses `navigator.clipboard.writeText`; download calls `downloadJsonFile(raw, 'athlete-groups-source.json')`.

- **Why:** Matches existing modal UX and icon conventions; no new dependencies.
- **Alternative:** A `@floating-ui` popover instead of a modal — rejected because the payload can be large and benefits from a scrollable full-size surface.

### Decision 4: Only show the icon when `rawResponse` is present

The icon renders only in the success state where a raw response exists, consistent with the loading/error/empty branches already in `AthleteGroupList`.

## Risks / Trade-offs

- **[Large payloads make the modal heavy]** → Render inside a scrollable, height-capped container; the popup is 384px wide so wrap/overflow must be handled. Pretty-print only on open, not on every render.
- **[Adding `raw` to `ApiResponse` could be misused by other callers]** → It is optional and only populated for athlete groups; document that it is opt-in per fetch. No other code path reads it.
- **[Clipboard API can be unavailable]** → Guard `navigator.clipboard`; fall back to selecting the `<pre>` text or rely on the download action.
- **[Raw JSON exposure]** → The `/tags` response contains only group names and athlete IDs (already on screen); it carries no tokens or credentials, so displaying it does not widen data exposure.

## Migration Plan

No data migration. Ship additively: the optional `raw` field defaults to absent, so builds without the UI wired up behave exactly as today. Rollback is removing the icon/modal and the optional field. Run `npm run build` to verify the extension bundles (required before loading in Chrome).

## Open Questions

- Icon choice (`Braces` vs `Code` vs `FileJson`) — cosmetic; default to `Braces` unless a maintainer prefers otherwise.
- Whether to also surface a source-JSON viewer on other screens (libraries/plans) — deferred; this change deliberately scopes to athlete groups.

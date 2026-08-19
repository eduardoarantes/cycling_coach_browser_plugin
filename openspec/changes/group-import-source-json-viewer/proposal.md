## Why

The athlete group import screen (`AthleteGroupList`) is generated from a single TrainingPeaks API response (`GET /coaches/v2/coaches/{coachId}/tags`). When a group looks wrong — an unexpected name, a surprising athlete count, a missing group — there is no way to inspect the actual data TrainingPeaks returned. The raw response is validated by Zod in the background worker and then discarded, so debugging import issues today means guessing or attaching a debugger. A lightweight "view source JSON" affordance lets coaches and maintainers see exactly what TrainingPeaks sent that produced the screen.

## What Changes

- Preserve the **raw** TrainingPeaks `/tags` JSON response through the data flow. Today the background `apiRequest` wrapper parses and validates the response, then returns only the transformed `AthleteGroup[]`; the original JSON is dropped. The raw payload will be carried alongside the validated data so the popup can display it.
- Add a **"View source JSON" icon button** to the `AthleteGroupList` header (next to the group/athlete count and the Import button). Clicking it opens a modal.
- Add a **source JSON viewer modal** that shows the complete raw `/tags` response (pretty-printed), with Copy-to-clipboard and Download actions (reusing the existing `downloadJsonFile` utility and the established modal shell pattern).
- The displayed payload is the **single source array for the whole screen** (all groups), matching how TrainingPeaks returns the data. No per-group endpoint exists; per-card viewing is explicitly out of scope for this change.

## Capabilities

### New Capabilities

- `athlete-group-source-json`: Retaining the raw TrainingPeaks athlete-groups API response and exposing it in the popup through a header icon + modal so users can inspect the exact source JSON that generated the group import screen.

### Modified Capabilities

<!-- No existing OpenSpec specs in openspec/specs/; nothing to modify. -->

## Impact

- **Code**:
  - `src/background/api/trainingPeaks.ts` — carry the raw parsed JSON on the successful `ApiResponse` for the athlete-groups fetch (via an optional field on the generic `apiRequest` or a dedicated capture in `fetchAthleteGroups`).
  - `src/types/api.types.ts` — optional `raw` field on the success shape of `ApiResponse<T>` (or a scoped return type for athlete groups).
  - `src/hooks/useAthleteGroups.ts` — expose the raw response to the component alongside the validated `AthleteGroup[]`.
  - `src/popup/components/AthleteGroupList.tsx` — add the header icon button + modal state.
  - `src/popup/components/` — new `GroupSourceJsonModal.tsx` (modal shell reused from `IntegrationHelpModal`).
- **Dependencies**: none new — uses existing `lucide-react` icons, Tailwind, and `src/utils/downloadJson.ts`.
- **Tests**: unit coverage for the raw-response plumbing (background fetch retains raw JSON; hook exposes it) and the modal component (renders JSON, copy/download actions, close). No changes to the import flow or PlanMyPeak endpoints.
- **Security/privacy**: the source JSON contains athlete IDs and group names already shown on-screen; no tokens or credentials are included in the `/tags` response, and none are surfaced by the viewer.

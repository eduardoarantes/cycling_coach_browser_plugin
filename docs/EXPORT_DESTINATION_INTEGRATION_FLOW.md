# Export Destination Integration Flow Guide

## Purpose

This document defines the integration pattern for export destinations (current examples: `Intervals.icu` and `PlanMyPeak`) so new integrations can follow the same architecture, auth flow, and export dialog UX.

The goal is to keep destination integrations consistent, testable, and easy to extend without creating destination-specific UI drift.

## Current UI Rule (Important)

Integrations should use the same export dialog screen structure, as much as possible if they have similar steps.

What this means in practice:

- Reuse the shared `ExportDialog` layout in `src/popup/components/export/ExportDialog.tsx`
- Avoid destination-only cards/sections unless they are strictly required for capability gating (example: Intervals API key warning)
- Do not add destination-only naming inputs when the value is derived from TrainingPeaks data
- Keep destination-specific behavior in background services, hooks, and export handlers whenever possible

## High-Level Architecture

The extension uses a layered flow:

1. TrainingPeaks data is collected in the popup (libraries/plans/workouts)
2. Export dialog gathers destination choice and shared export settings
3. Popup sends a typed message to the background worker for destination API calls (if applicable)
4. Background performs authenticated fetches and returns `ApiResponse<T>`
5. Destination-specific transform/export logic runs using shared adapters and types

Auth capture is also layered:

1. Main-world content script intercepts page `fetch` / `XHR`
2. It posts auth details to the isolated content script via `window.postMessage`
3. Isolated content script forwards to background via `chrome.runtime.sendMessage`
4. Background stores tokens in `chrome.storage.local`
5. Popup auth hooks/stores validate and display status rows

## Source of Truth Files

Use these files as the main references when adding or modifying an integration:

- `src/popup/components/export/ExportDialog.tsx` (shared export UI and destination branching)
- `src/types/export.types.ts` (destination list and labels)
- `src/content/mainWorldInterceptor.ts` (browser request interception)
- `src/content/isolatedWorldBridge.ts` (main-world -> background bridge)
- `src/background/messageHandler.ts` (runtime message routing)
- `src/background/api/` (destination API clients, background-only)
- `src/hooks/` (React Query hooks for popup usage)
- `src/store/` and `src/services/` (auth state and validation orchestration)
- `src/types/index.ts` (runtime message contracts)
- `src/schemas/*.schema.ts` (Zod response validation)
- `public/manifest.json` (content script matches and host permissions)

PlanMyPeak API references:

- `PlanMyPeak/workouts-openapi.yaml`

## Export Screen Contract (What Must Stay Reused)

The export dialog should remain a shared shell with a stable section order:

1. Export destination selector
2. Destination-required configuration (minimal, only if truly needed)
3. Destination auth/API gating warnings (if needed)
4. Shared export summary (`What will be exported?`)
5. Shared ownership/authorization acknowledgement
6. Shared footer actions (`Cancel`, `Export`)

Keep these sections shared:

- Modal shell and sizing
- Destination radio cards
- Export summary section
- Acknowledgement checkbox
- Footer button states / loading states
- Export progress UI

Destination-specific UI should be limited to:

- Capability toggles required by that API (example: Intervals folder creation)
- Blocking warnings for missing credentials (example: Intervals API key)
- Conflict resolution flows if the remote API requires decisions

Destination-specific UI should NOT include:

- Informational cards that duplicate behavior already implied by the destination
- Manual naming inputs when the destination name should match the TrainingPeaks source name
- Standalone library management panels inside the export dialog unless the export action itself requires them immediately

## Preflight Override Validation (Duplicate Destination Containers)

When a destination can create a container (folder/library/plan) from a TrainingPeaks name, the export dialog should run a **preflight duplicate check** before starting upload.

This is the pattern used by `Intervals.icu` and now `PlanMyPeak`.

### Goal

Prevent accidental duplicate uploads when a destination container with the same name already exists.

### Flow

1. User clicks `Export`
2. `ExportDialog` builds destination config
3. Before calling `onExport(...)`, the dialog checks whether the target container name(s) already exist
4. If duplicates exist, export is paused and a warning panel is shown
5. User chooses one action for the export:
   - `Replace`
   - `Append`
   - `Ignore Upload`
6. The selected action is added to the destination config and export continues

### UI requirements

Use the same amber warning panel pattern for all destinations:

- Single duplicate panel (single library/plan export)
- Batch duplicate panel (multi-library / multi-plan export)
- Same button order:
  - `Replace`
  - `Append`
  - `Ignore Upload`

### Action semantics

- `Replace`: delete/remove the existing destination container, then recreate/use a fresh container before upload
- `Append`: reuse the existing destination container and upload into it (duplicates may occur)
- `Ignore Upload`: cancel/close without exporting

### Current implementations

- `Intervals.icu`
  - Checks existing library folders / PLAN folders before export
  - Uses `existingLibraryAction` / `existingPlanAction`
- `PlanMyPeak`
  - Checks existing user workout libraries by exact name before export when `Create library in PlanMyPeak` is enabled
  - Uses `existingLibraryAction`
  - `Replace` deletes the existing PlanMyPeak library and recreates it before workout upload

## Authentication Integration Pattern

### 1. Capture auth from real browser traffic

Capture tokens from the destination web app in `src/content/mainWorldInterceptor.ts`.

Pattern:

- Detect destination request URLs (domain/host match)
- Read auth headers from intercepted `fetch` / `XHR`
- Normalize values (token, API key, timestamp)
- Post a structured message to the isolated world

PlanMyPeak example:

- Detects local Supabase hosts (`127.0.0.1:54361`, `localhost:54361`)
- Captures both:
  - `authorization: Bearer <user access token>`
  - `apikey: <supabase anon key>`
- Ignores anon-only bearer tokens unless the request is `/auth/v1/user`

Why this matters:

- Supabase auth flows can send the anon key in `Authorization`
- Treating the anon key as the user token would produce false-auth states

### 2. Bridge to the background worker

Use `src/content/isolatedWorldBridge.ts` to forward main-world messages to the extension runtime.

Pattern:

- Accept only messages from `window`
- Verify `source` marker (`trainingpeaks-extension-main`)
- Forward typed payload to background via `chrome.runtime.sendMessage`

Current message examples:

- `TOKEN_FOUND` (TrainingPeaks token)
- `MY_PEAK_AUTH_FOUND` (PlanMyPeak token + Supabase API key)

### 3. Store auth state in `chrome.storage.local`

Background message handlers persist auth fields independently in `src/background/messageHandler.ts`.

Important rule:

- Store partial auth when available (example: Supabase `apikey` may arrive before user access token)

PlanMyPeak storage keys:

- `mypeak_auth_token`
- `mypeak_token_timestamp`
- `mypeak_supabase_api_key`

Defined in `src/utils/constants.ts`.

### 4. Validate auth in the background (not the popup)

Auth validation should happen in the background worker so credentials are handled in one place.

PlanMyPeak validation pattern:

- Background handler `VALIDATE_MY_PEAK_TOKEN`
- Calls `GET ${MYPEAK_SUPABASE_URL}/auth/v1/user`
- Sends:
  - `Authorization: Bearer <user token>`
  - `apikey: <supabase anon key>`
- On `401`, clears stored token to force the popup auth state to update

Why background validation:

- Keeps popup code simple
- Centralizes fetch headers and error handling
- Makes auth behavior consistent across popup screens

### 5. Expose popup auth state via hook + store

Use a hook + store pair (example: `useMyPeakAuth` + `myPeakAuthStore`) for UI state.

Responsibilities:

- Read token presence
- Trigger background validation
- Track loading / error / token age
- Subscribe to `chrome.storage.onChanged`
- Surface `refreshAuth` and `validateAuth` methods to the popup

### 6. Display auth status in a shared auth panel

`src/popup/components/AuthStatus.tsx` renders a compact row per provider.

Rules:

- Each provider gets its own row
- Each row has consistent status language (`Checking`, `Authenticated`, `Not Authenticated`)
- Each row has a refresh action that opens the provider tab and re-validates
- Popup-level access gating is based on all required auths

Current popup gate:

- `src/popup/App.tsx` requires both `TrainingPeaks` and `PlanMyPeak` auth before loading data UI

## Background API Integration Pattern

All destination API calls should run in the background worker, not directly in popup React components.

### Why background-only API clients

- Keeps tokens out of popup component logic
- Centralizes auth failure handling (especially `401`)
- Enables reuse across multiple screens and flows
- Simplifies testing for message handlers

### Client structure (recommended)

Create a dedicated client in `src/background/api/<destination>.ts` with this shape:

1. `getAuthToken()` (and any other auth dependencies)
2. `makeApiRequest()` for headers + fetch
3. `parseErrorMessage()` for readable API errors
4. `apiRequest<T>()` generic wrapper
5. Endpoint functions (`fetchX`, `createX`, `updateX`)

PlanMyPeak example:

- `src/background/api/planMyPeak.ts`
- Uses Zod schemas from `src/schemas/planMyPeakApi.schema.ts`
- Converts API responses to `ApiResponse<T>`
- Clears PlanMyPeak auth token on `401`

### Message routing pattern

Add typed runtime messages in `src/types/index.ts`, then route them in `src/background/messageHandler.ts`.

Pattern:

- Message type for each action (example: `GET_PLANMYPEAK_LIBRARIES`)
- Background handler function per action (example: `handleGetPlanMyPeakLibraries`)
- `switch` router case returns typed `ApiResponse<T>`

Current PlanMyPeak library actions:

- `GET_PLANMYPEAK_LIBRARIES`
- `CREATE_PLANMYPEAK_LIBRARY`

### Popup hooks pattern (React Query)

Expose destination operations through hooks in `src/hooks/`.

Pattern:

- `useQuery` for list/get operations
- `useMutation` for create/update/delete
- Invalidate related queries after mutations
- Convert background `ApiResponse<T>` failures into thrown `Error`

PlanMyPeak example:

- `src/hooks/usePlanMyPeakLibraries.ts`

## Export Flow Integration Pattern

### Shared flow

The export flow should remain destination-agnostic at the dialog shell level.

Flow:

1. User opens export dialog from a TP library or training plan screen
2. User chooses destination
3. User confirms shared acknowledgement
4. Dialog builds destination config object
5. `onExport(config, destination)` is called
6. Export executor performs transform + upload/file output behavior

### Destination config object rules

Keep config objects minimal and deterministic:

- Include only values the destination needs
- Derive values from TrainingPeaks source data when possible
- Avoid optional UI fields unless the destination API truly requires user input

PlanMyPeak current behavior:

- `targetLibraryName` is derived from `sourceLibraryName`
- No PlanMyPeak library-name input in the export dialog
- No PlanMyPeak file export options shown in the export dialog UI

## Screen Parity Rules for New Integrations

If you add a new destination, default to the same export screen experience used by `Intervals.icu` and `PlanMyPeak`.

Before adding new UI controls, ask:

1. Is this required to execute the export?
2. Can this value be derived from TrainingPeaks source data?
3. Can this be handled in background logic instead?
4. Can this live in a settings panel instead of the export dialog?

If the answer to (1) is no, do not add the control to the export dialog.

## Step-by-Step Checklist for Adding a New Destination

### A. Define destination metadata

- Add destination type and label to `src/types/export.types.ts`
- Keep description short and user-facing

### B. Add auth capture (if browser-based auth)

- Add content script match patterns in `public/manifest.json`
- Add `host_permissions` for target API/auth domains
- Extend `src/content/mainWorldInterceptor.ts` URL detection and header parsing
- Forward a new message through `src/content/isolatedWorldBridge.ts`

### C. Add background auth storage and validation

- Add storage keys in `src/utils/constants.ts`
- Add message types in `src/types/index.ts`
- Add handlers in `src/background/messageHandler.ts`
- Implement validation endpoint call in background
- Clear stale tokens on `401`

### D. Add popup auth row

- Add tab opener helper (if needed)
- Add hook/store pair for auth state
- Render a row in `src/popup/components/AuthStatus.tsx`
- Update popup gating logic in `src/popup/App.tsx` if destination auth is required

### E. Add destination API client

- Create `src/background/api/<destination>.ts`
- Add Zod schemas in `src/schemas/`
- Return `ApiResponse<T>` everywhere
- Handle `401` by clearing auth state

### F. Add popup data hooks

- Add `useQuery` / `useMutation` hooks in `src/hooks/`
- Use typed runtime messages only (no direct popup fetch)

### G. Wire export flow

- Extend destination config types/schemas
- Add destination branch in `ExportDialog` config builder only
- Keep UI changes minimal and consistent with shared screen
- Implement destination export executor/upload handler

### H. Tests and validation

- Add/extend background message handler tests
- Test auth missing / auth invalid / auth valid cases
- Test API `401` token clearing behavior
- Run `npm run build` (required for extension testing)

## PlanMyPeak Notes (Current State)

- Local dev app URL: `http://localhost:3006`
- Local Supabase auth URL: `http://127.0.0.1:54361`
- PlanMyPeak API base (local): `http://localhost:3006/api/v1`
- OpenAPI source: `PlanMyPeak/workouts-openapi.yaml`

Current implemented endpoints:

- `GET /workouts/libraries/`
- `POST /workouts/libraries/`
- `DELETE /workouts/libraries/{libraryId}`
- `POST /workouts/library/` (create workout)

Current export dialog UX rule:

- PlanMyPeak export uses the shared export dialog shell and summary
- No extra PlanMyPeak naming box
- Includes the same pre-export control pattern as Intervals.icu (create destination container toggle + direct upload message card)
- Includes duplicate-library preflight override validation (`Replace / Append / Ignore Upload`) before upload when creating libraries
- No PlanMyPeak file export options shown in the dialog
- Keep parity with Intervals.icu screen layout

## Suggested Extension Point for Future Integrations

When multiple destinations begin to need similar pre-export remote setup (library selection, folder selection, conflict rules), create a shared pre-export section contract instead of adding ad hoc destination cards.

Example future abstraction:

- `destinationCapabilities` object (booleans and labels)
- Shared section renderers keyed by capabilities
- Destination adapters provide behavior, not custom JSX blocks

This preserves UI parity while allowing feature growth.

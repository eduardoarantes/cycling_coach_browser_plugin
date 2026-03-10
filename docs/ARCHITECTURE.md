# Architecture Overview

This extension is a Manifest V3 Chrome extension built with React, TypeScript,
and Vite. The core design goal is to reuse authenticated browser sessions from
supported services and keep the heavy network work inside the background service
worker.

## Runtime Pieces

### Popup UI

The popup is a React app under `src/popup/`. It renders auth state, libraries,
plans, export dialogs, and settings.

Key files:

- `src/popup/App.tsx`
- `src/popup/components/*`
- `src/hooks/*`

### Background Service Worker

The background worker is the extension's API layer. It receives messages from
the popup and content scripts, reads and writes `chrome.storage.local`, and
makes cross-origin requests using the extension's host permissions.

Key files:

- `src/background/index.ts`
- `src/background/messageHandler.ts`
- `src/background/api/trainingPeaks.ts`
- `src/background/api/planMyPeak.ts`
- `src/background/api/intervalsicu.ts`

### Content Scripts

The extension uses two content-script contexts:

- `MAIN` world: patches page `fetch` and `XMLHttpRequest` so it can observe auth
  headers that normal extension scripts cannot access
- `ISOLATED` world: bridges page messages back into the extension runtime

Key files:

- `src/content/mainWorldInterceptor.ts`
- `src/content/isolatedWorldBridge.ts`

## Authentication Flows

### TrainingPeaks

1. The user signs in to `app.trainingpeaks.com`.
2. `mainWorldInterceptor.ts` watches page requests for encrypted bearer tokens
   sent to `tpapi.trainingpeaks.com`.
3. The token is posted to the isolated content script and forwarded to the
   background worker.
4. The background worker stores `auth_token` and `token_timestamp` in
   `chrome.storage.local`.
5. Popup hooks ask the background worker to validate and use the token for
   TrainingPeaks API requests.

### PlanMyPeak

1. The user signs in to `planmypeak.com` or a local PlanMyPeak app.
2. The interceptor watches requests to known Supabase auth endpoints and
   captures the observed `authorization` bearer token and `apikey`.
3. The background worker stores:
   - `mypeak_auth_token`
   - `mypeak_token_timestamp`
   - `mypeak_supabase_api_key`
4. The popup validates auth by calling Supabase `/auth/v1/user` through the
   background worker.

### Intervals.icu

1. The user manually enters an Intervals.icu API key in the popup.
2. The key is stored in `chrome.storage.local` as `intervals_api_key`.
3. Background API code uses that key for direct Intervals.icu API requests.

## Export Flows

### Export to PlanMyPeak

- The popup transforms TrainingPeaks workouts or plans into PlanMyPeak payloads
- The background worker authenticates with the captured PlanMyPeak token
- Workouts are created in PlanMyPeak libraries
- Training plan exports can create or update plans and related notes
- Progress is persisted so the popup can recover state after reopening

### Export to Intervals.icu

- The popup transforms TrainingPeaks data into Intervals.icu workout or PLAN
  payloads
- The background worker authenticates with the stored Intervals.icu API key
- Library exports create workout templates, optionally inside folders
- Plan exports create reusable PLAN folders and preserve day offsets

## Storage Model

Common local storage keys:

| Key                            | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `auth_token`                   | TrainingPeaks bearer token                            |
| `token_timestamp`              | TrainingPeaks token capture time                      |
| `mypeak_auth_token`            | PlanMyPeak user auth token                            |
| `mypeak_token_timestamp`       | PlanMyPeak token capture time                         |
| `mypeak_supabase_api_key`      | Supabase API key observed on PlanMyPeak auth requests |
| `intervals_api_key`            | User-supplied Intervals.icu API key                   |
| `connection_enable_planmypeak` | UI toggle for PlanMyPeak integration                  |
| `connection_enable_intervals`  | UI toggle for Intervals.icu integration               |
| `planmypeak_app_port`          | Local PlanMyPeak app port for dev builds              |
| `planmypeak_supabase_port`     | Local Supabase port for dev builds                    |
| `trainingpeaks_api_logs`       | Debug log exports                                     |
| `export_progress`              | Current export session state                          |

## Environment Targeting

The extension supports two PlanMyPeak targets:

- Production target: `planmypeak.com` and the hosted Supabase instance
- Local target: configurable localhost PlanMyPeak and Supabase ports

The active target is resolved from `VITE_PLANMYPEAK_TARGET` and build mode.

Key files:

- `src/utils/constants.ts`
- `src/services/portConfigService.ts`

## Design Constraints

- TrainingPeaks auth capture depends on real browser traffic from the web app
- Cross-origin provider calls must run in the background worker
- Playwright extension tests run in headed Chromium, not headless mode
- Release-oriented build commands bump the patch version automatically

## Related Docs

- [README.md](../README.md)
- [INSTALL.md](../INSTALL.md)
- [TESTING.md](../TESTING.md)
- [docs/PRIVACY_AND_PERMISSIONS.md](./PRIVACY_AND_PERMISSIONS.md)

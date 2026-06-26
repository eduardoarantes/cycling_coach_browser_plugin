## Why

PlanMyPeak has been rewritten and re-hosted. Production now lives at `https://portal.planmypeak.com/` (no longer the bare `planmypeak.com`), and the backend architecture changed (Supabase-authenticated Next.js web app proxying a separate Fastify API under `/api/backend`). The extension still captures and validates auth against the old host (`planmypeak.com`) and old Supabase project (`yqaskiwzyhhovthbvmqq.supabase.co`), so PlanMyPeak auth capture and the validate-token flow no longer work: tokens are never intercepted from the new portal traffic, and validation calls hit a Supabase project that did not issue the user's token.

## What Changes

- **BREAKING**: Update the PlanMyPeak **production** host from `planmypeak.com` to `portal.planmypeak.com` across the request interceptor, manifest match patterns, and host permissions.
- Update the PlanMyPeak **production** Supabase project URL from the stale `https://yqaskiwzyhhovthbvmqq.supabase.co` to the project the rewritten app actually authenticates against: **`https://nwvtltfibnkdogdeeluh.supabase.co`** (confirmed). The project ref changed, which is the root cause: portal-issued tokens were being validated against a project that never issued them, so validation always returned `401` and the popup showed "Not Authenticated".
- Update the main-world interceptor's host detection so it recognizes the new portal origin and the new production Supabase origin, and continues to distinguish the user access token from the Supabase anon `apikey` (still required: anon-key-only bearer tokens must not be stored as the user token).
- Keep the validate-token flow's existing shape (`GET {supabaseUrl}/auth/v1/user` with `Authorization: Bearer <token>` + `apikey`) but point it at the confirmed production Supabase URL, and confirm it still returns `200` for a valid portal-issued token and clears stored auth on `401`.
- Update production URL constants so the configurable target-switching layer resolves the correct portal app URL and Supabase URL, while preserving the existing in-extension configuration approach (no hardcoded one-off values).
- Update `manifest.json` `content_scripts` matches and `host_permissions` so the interceptor injects on the portal and can reach the production Supabase auth endpoint.

Out of scope (deferred): updating the workout/library/training-plan API client endpoints (e.g. `/api/v1/...` → `/api/backend/...`) and reconciling the missing workout-library resource. This change restores **auth capture and validation only**; export/data endpoints are a separate follow-up.

## Capabilities

### New Capabilities

- `planmypeak-auth-validation`: Capturing a PlanMyPeak user access token (and Supabase anon key) from production portal browser traffic, storing it, and validating it against the correct Supabase project so the popup shows accurate PlanMyPeak authentication status.

### Modified Capabilities

<!-- No existing OpenSpec specs in openspec/specs/; nothing to modify. -->

## Impact

- **Code**:
  - `src/content/mainWorldInterceptor.ts` — production host detection / URL matching.
  - `src/content/isolatedWorldBridge.ts` — unchanged contract, verify forwarding still applies on the new origin.
  - `src/utils/constants.ts` — production app URL and Supabase URL constants (and any supported-host/target config defaults).
  - `src/background/messageHandler.ts` — `VALIDATE_MY_PEAK_TOKEN` target URL via the resolved Supabase URL; `401` clearing behavior.
  - `src/services/portConfigService.ts` (and related target-resolution helpers) — production URL resolution.
  - `public/manifest.json` — `content_scripts.matches` and `host_permissions` for `https://portal.planmypeak.com/*` and the production Supabase host.
- **Auth/credentials**: Validation depends on the correct production Supabase project URL and anon key behavior.
- **Confirmed**: Production Supabase project URL is `https://nwvtltfibnkdogdeeluh.supabase.co` (replaces the stale `yqaskiwzyhhovthbvmqq.supabase.co`). Still to confirm during implementation: the production anon key value and whether the `apikey` header is observable on portal traffic.
- **Tests**: Background `VALIDATE_MY_PEAK_TOKEN` handler tests (missing/invalid/valid token, `401` clearing) and interceptor host-detection tests updated for the new origins.

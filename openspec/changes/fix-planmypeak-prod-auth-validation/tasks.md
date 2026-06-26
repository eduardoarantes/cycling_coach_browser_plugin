## 1. Confirm production auth facts (do first — blocks correctness)

- [x] 1.1 Determine the production Supabase project URL used by `https://portal.planmypeak.com`. **Confirmed: `https://nwvtltfibnkdogdeeluh.supabase.co`** (changed from `yqaskiwzyhhovthbvmqq.supabase.co` — this is the root cause).
- [x] 1.2 Anon key is captured dynamically from the `apikey` request header (never hardcoded), so its literal value is not needed. Live confirmation that the header is present on portal traffic folds into manual verification (6.2).
- [x] 1.3 Addressed defensively: host detection now captures from BOTH the Supabase project origin (`/auth/v1/*`, `/rest/v1/*`) and the `portal.planmypeak.com` app origin (Bearer on `/api/backend`), so the user token is captured regardless of which origin carries it. Any separate `api.` subdomain (if discovered during 6.2) can be added to `MYPEAK_APP_HOSTS` + host permissions.

## 2. Update production URL configuration

- [x] 2.1 `src/utils/constants.ts`: `PLANMYPEAK_APP_URL` and `PLANMYPEAK_HOST_LABEL` production values now `portal.planmypeak.com`.
- [x] 2.2 `src/utils/constants.ts`: `PLANMYPEAK_AUTH_BASE_URL` production value now `https://nwvtltfibnkdogdeeluh.supabase.co`. `manifest.json` host permission updated to the new project (task 3.4).
- [x] 2.3 `src/services/portConfigService.ts` now imports and returns the production constants (`PLANMYPEAK_APP_URL` / `PLANMYPEAK_AUTH_BASE_URL` / `PLANMYPEAK_HOST_LABEL`) instead of re-hardcoding literals, so production URLs are defined once in constants.

## 3. Update auth capture (interceptor + bridge + manifest)

- [x] 3.1 Host detection extracted to the pure module `src/content/mypeakAuthDetection.ts` (imported by `mainWorldInterceptor.ts`); now matches the new Supabase project host and `portal.planmypeak.com`.
- [x] 3.2 Discrimination logic unchanged: anon-key-only bearer is still not stored as the user token, the `/auth/v1/user` exemption is preserved, and a JWT bearer on the portal origin is correctly treated as the user token (no apikey on those calls → user token still posted via partial storage).
- [x] 3.3 `public/manifest.json`: `content_scripts.matches` (MAIN + ISOLATED) and `host_permissions` now use `https://portal.planmypeak.com/*`.
- [x] 3.4 `public/manifest.json`: host permission updated to `https://nwvtltfibnkdogdeeluh.supabase.co/*`. No separate `api.` subdomain known yet (revisit during 6.2 if found).
- [x] 3.5 `isolatedWorldBridge.ts` forwards `MY_PEAK_AUTH_FOUND` purely on message type/source, independent of origin — no change needed.

## 4. Update token validation

- [x] 4.1 Confirmed: `handleValidateMyPeakToken` resolves `getSupabaseUrl()` (now the production project in production builds) and calls `GET {supabaseUrl}/auth/v1/user` with `Authorization: Bearer` + `apikey`. No code change needed; covered by new tests.
- [x] 4.2 Confirmed: the `401` branch clears `mypeak_auth_token` + `mypeak_token_timestamp`. Covered by a new test.

## 5. Tests

- [x] 5.1 Added `tests/unit/content/mypeakAuthDetection.test.ts`: matches new Supabase host + portal origin + local ports; rejects retired host and bare `planmypeak.com`.
- [x] 5.2 Added `VALIDATE_MY_PEAK_TOKEN` tests to `tests/unit/background/messageHandler.test.ts`: no token, missing anon key, valid `200` (asserts `/auth/v1/user` + Bearer + apikey), `401` clears storage. Also updated the env-indicator test for the new host.
- [x] 5.3 Ran the affected suites — all 25 PlanMyPeak auth/detection/env tests pass; `tsc --noEmit` clean. (Pre-existing, unrelated calendar + Playwright-e2e failures exist on the baseline and are untouched by this change.)

## 5b. Validation no longer depends on a captured anon key (root-cause follow-up)

Discovered during manual testing (popup showed "not authenticated" on 1.11.84): the rewritten portal restores its Supabase session from `localStorage` (no network call) and routes data through its own `/api/backend`, so the anon `apikey` header is essentially never emitted on intercepted traffic. The user token IS captured (from `portal.planmypeak.com/api/backend/*`), but `handleValidateMyPeakToken` bailed at `if (!apiKey)`.

- [x] 5b.1 Added `PLANMYPEAK_SUPABASE_ANON_KEY` constant (`src/utils/constants.ts`) — the public, static production publishable key baked into the portal browser build (project ref `nwvtltfibnkdogdeeluh`, confirmed from the PlanMyPeak repo `infra/live/prod/env.hcl`). Empty for local builds.
- [x] 5b.2 `handleValidateMyPeakToken` now uses `capturedApiKey || PLANMYPEAK_SUPABASE_ANON_KEY` so production validation works without capturing the anon key; local still relies on the captured key.
- [x] 5b.3 Confirmed via build that the anon key + Supabase host are baked into `dist/`. (Compile-time target flag makes the production fallback path not unit-testable in the DEV test env; covered by existing handler tests + build verification + manual 6.2.)

## 5c. Why is capture failing on `portal.planmypeak.com`? (root-cause follow-up #2 — OPEN)

Second manual test (1.11.85) showed `chrome.storage.local` empty for all `mypeak_*` keys → the token was never captured — even though `portal.planmypeak.com` was already in the match list. So the host list is NOT the problem.

A brief detour added `api.planmypeak.com` (from the repo's `infra/live/prod/env.hcl`), but the user confirmed their deployment serves everything from `portal.planmypeak.com` (no separate API host). That change was **reverted**.

Diagnosed on the live portal (via a temporary always-on diagnostic build, since production logging is off):

- [x] 5c.1 Interceptor IS injecting on `portal.planmypeak.com` (`window.fetch` shows our wrapper).
- [x] 5c.2 Auth travels as an `Authorization: Bearer` header on the portal's API requests. The diagnostic showed the app calls them with **relative URLs** (`/api/backend/coaches/me`, `/api/backend/activities`, …, `inputType: string`) — same origin, no separate API host.
- [x] 5c.3 **Root cause:** host-based detection did `url.includes('portal.planmypeak.com')`, but a relative URL has no host → `match: false`, so the token (which we could read — `auth: YES`) was discarded. Fixed by resolving relative request URLs to absolute against the page origin (`document.baseURI`) before detection, via `toAbsoluteUrl()` in `src/content/requestInfo.ts`. After the fix the diagnostic showed `match: true` + `POSTED MY_PEAK_AUTH_FOUND | token: true` for `/api/backend/*`.
- [x] 5c.4 Also hardened the fetch wrapper to read headers from a `Request` object (not only `options.headers`) via `extractRequestInfo()`. Covered by `tests/unit/content/requestInfo.test.ts` (Request-object, url+init, URL object, override, and relative→absolute resolution).
- [x] 5c.5 Removed the temporary `[PMP-DIAG]` diagnostic logging; shipped clean build.

## 6. Build & manual verification

- [x] 6.1 `npm run build` succeeds; built `dist/manifest.json` and `dist/assets/*.js` carry the new hosts + anon key and zero references to the retired project. **Manual:** loading the unpacked build on a clean Chrome profile (re-grant host permissions) remains for you.
- [x] 6.2 **Confirmed by user:** logged in at `https://portal.planmypeak.com`, popup shows PlanMyPeak **Authenticated**. Token captured from relative `/api/backend/*` requests; validated via the embedded anon key. (No `apikey` on portal traffic and no separate `api.` host — both handled.)
- [ ] 6.3 **Manual (optional):** Confirm an expired/foreign token yields a `401` and the popup flips to not-authenticated (token cleared). Logic unchanged + unit-tested; not separately exercised in the browser.

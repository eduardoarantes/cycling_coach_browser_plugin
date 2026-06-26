## Context

PlanMyPeak was rewritten (Supabase-auth Next.js web app + separate Fastify API under `/api/backend`) and re-hosted at `https://portal.planmypeak.com/`. The extension's PlanMyPeak auth layer still assumes the old world:

- Production app host `planmypeak.com`; production Supabase `https://yqaskiwzyhhovthbvmqq.supabase.co`.
- `mainWorldInterceptor.ts` matches a fixed set of Supabase hosts (incl. local `54361/54341`) plus a `localhost`/`127.0.0.1` + `/auth/v1/` | `/rest/v1/` fallback.
- `manifest.json` injects content scripts and grants host permissions only for `app.trainingpeaks.com`, `planmypeak.com`, and `yqaskiwzyhhovthbvmqq.supabase.co`.
- `VALIDATE_MY_PEAK_TOKEN` calls `GET {supabaseUrl}/auth/v1/user` with `Authorization: Bearer` + `apikey`, clearing the token on `401`.
- URL resolution already goes through a configurable target layer (`portConfigService` / constants) with `local` vs `production` targets.

The auth model itself is unchanged in kind — it is still a Supabase access token (JWT) plus the anon `apikey`, and Supabase GoTrue still exposes `/auth/v1/user`. What changed is _where_ that auth lives: a new portal host and (probably) a new Supabase project. Because the extension targets the old host and old project, it never captures tokens from the portal and, even if it did, would validate them against a project that did not mint them — so validation fails.

This change is deliberately scoped to **auth capture + validation for the production target**. The data/export API surface (now `/api/backend`, with workout-library endpoints possibly absent) is a separate follow-up.

## Goals / Non-Goals

**Goals:**

- Capture the PlanMyPeak user access token and Supabase anon key from `https://portal.planmypeak.com` browser traffic.
- Inject content scripts and hold host permissions for the portal origin and the production Supabase origin.
- Validate the captured token against the Supabase project the portal actually authenticates against, and clear it on `401`.
- Keep production URL resolution inside the existing configurable target layer (update defaults, do not scatter hardcoded literals).
- Preserve the existing user-token-vs-anon-key discrimination so anon-key-only bearers are never stored as the user token.

**Non-Goals:**

- Updating the workout/library/training-plan API client (`/api/v1/...` → `/api/backend/...`) or reconciling missing library endpoints.
- Local-dev port reconfiguration for the new monorepo (54321/54331, 3000/3001, 4000/4001, HTTPS). Out of scope for this production-focused change; tracked separately.
- Changing the auth transport mechanism (still main-world intercept → isolated bridge → background storage → Supabase validation).
- OAuth or any new login flow.

## Decisions

### Decision: Reuse the existing intercept → bridge → validate pipeline, only re-point hosts/URLs

Rather than re-architect auth capture, keep the proven pipeline and change the host/URL inputs. The new portal still emits a Supabase Bearer token and anon `apikey`, so the existing `MY_PEAK_AUTH_FOUND` contract, storage keys, and `VALIDATE_MY_PEAK_TOKEN` handler remain valid.

- _Alternative considered_: Switch to reading the Supabase session directly (e.g. from page storage). Rejected — higher coupling to the app's internals, more fragile across rewrites than header interception.

### Decision: Production host is `portal.planmypeak.com`, resolved via the target config layer

Update the `production` branch of the URL resolution (constants + `portConfigService`) so the app URL is `https://portal.planmypeak.com` and the Supabase URL is the confirmed production project. Update `mainWorldInterceptor.ts` host detection to recognize the portal origin and the production Supabase origin. Update `manifest.json` `content_scripts.matches` and `host_permissions` accordingly.

- _Alternative considered_: Hardcode the new host at each call site. Rejected — violates the existing configurable-target design and the user's "configurable + new defaults" preference; would drift on the next rename.

### Decision: Treat the production Supabase project URL as a confirm-then-set value

The rewritten app uses a different Supabase project than the old `yqaskiwzyhhovthbvmqq.supabase.co`. The confirmed production project is **`https://nwvtltfibnkdogdeeluh.supabase.co`** — set this as the production Supabase default. The project-ref change is the confirmed root cause: portal-issued tokens validated against the old project always returned `401`. The anon-key value and `apikey`-header observability still need confirmation during implementation.

- _Alternative considered_: Keep the old Supabase URL. Rejected — confirmed stale; validation fails silently with `401`.

### Decision: Use the known public anon key for validation instead of relying on capture (added after manual testing)

Manual testing of the production build showed PlanMyPeak still "not authenticated." Investigation of the portal confirmed: supabase-js restores the session from `localStorage` with **no network call**, and authenticated data goes to the portal's own `/api/backend` (same origin, `Authorization: Bearer` only — no `apikey` header). So the anon `apikey` is essentially never emitted on interceptable traffic, and validation — which required a captured `apikey` — always bailed.

Resolution: embed the production Supabase anon (publishable) key as a constant and use it as the `apikey` when none was captured. The anon key is public and already baked into the portal's browser bundle, so embedding it exposes nothing new; it is static (expires 2036) and role-agnostic. Validation continues to hit Supabase `/auth/v1/user`, which authoritatively verifies the user token's signature/expiry regardless of coach/athlete role.

- _Alternative considered_: Validate via a portal `/api/backend/*/me` endpoint with just the Bearer token. Rejected for now — the "me" endpoints are role-specific (coach vs athlete), so a single endpoint risks false-invalidating a valid token of the other role; the Supabase anon-key path is role-agnostic and authoritative.
- _Token capture_ is unaffected: the user token is intercepted from `portal.planmypeak.com/api/backend/*` requests via the portal host match.

### Decision: Keep `401` → clear-token behavior as the auth-state correctness mechanism

The popup gate trusts stored auth; clearing on `401` is what flips a stale/foreign token to "not authenticated." Retain it and add/confirm test coverage for the new project URL.

## Risks / Trade-offs

- **Production Supabase project URL unknown / wrong** → Validation keeps returning `401`. Mitigation: explicit confirmation task before setting the default; verify a real portal-issued token returns `200`.
- **Anon key differs or is no longer sent as a header on portal traffic** → user-token discrimination or the `apikey` validation header could break. Mitigation: inspect real portal network traffic for the `apikey` header presence and value during implementation; keep the `/auth/v1/user` exemption.
- **Manifest changes require user re-grant of host permissions** → existing installs may need a permission re-prompt/reinstall. Mitigation: document in the release notes; verify on a clean profile.
- **Portal may route API auth differently (e.g. proxied `/api/backend` on the portal origin rather than direct Supabase calls)** → token might be captured from portal API requests rather than Supabase requests. Mitigation: host detection covers the portal origin itself (Bearer on `portal.planmypeak.com/api/...`), not only the Supabase origin.
- **Auth-only fix won't make export work end-to-end** → users may still hit failures in the export flow due to the deferred `/api/backend` endpoint changes. Mitigation: scope is communicated in the proposal; this change only claims to restore auth status, and the follow-up is noted.

## Migration Plan

1. Confirm the production Supabase project URL + anon-key header behavior for `portal.planmypeak.com`.
2. Update production URL defaults (constants + `portConfigService`).
3. Update `mainWorldInterceptor.ts` host detection for the portal + production Supabase origins.
4. Update `manifest.json` matches + host permissions.
5. Update/confirm `VALIDATE_MY_PEAK_TOKEN` resolves the production Supabase URL.
6. Update unit tests (interceptor host detection; validation missing/invalid/valid/`401`).
7. `npm run build`, load on a clean Chrome profile, log into the portal, confirm the popup shows PlanMyPeak authenticated and that an expired/foreign token is cleared.

**Rollback**: Revert the constants/manifest/interceptor changes; the old configuration returns (still broken for the new portal, but no regression for unrelated TrainingPeaks/Intervals.icu flows since those paths are untouched).

## Open Questions

- ~~What is the production Supabase project URL used by `portal.planmypeak.com`?~~ **Resolved:** `https://nwvtltfibnkdogdeeluh.supabase.co` (changed from `yqaskiwzyhhovthbvmqq.supabase.co`). Anon key value still to confirm.
- On the portal, is the user Supabase token observable on requests to the Supabase origin directly, on `portal.planmypeak.com/api/backend/*`, or both? (Determines which origins host detection must cover.)
- Is the anon `apikey` still sent as a request header on portal traffic, or only embedded client-side? (Affects whether the validation `apikey` header can be sourced from interception.)
- Should a separate production API host (if any, e.g. an `api.` subdomain) also be added to host permissions now, or deferred with the rest of the API work?

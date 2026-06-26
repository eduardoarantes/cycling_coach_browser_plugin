## ADDED Requirements

### Requirement: Capture PlanMyPeak auth from production portal traffic

The extension SHALL intercept authenticated browser requests on the PlanMyPeak production portal origin (`https://portal.planmypeak.com`) and the production Supabase auth origin, and extract the user's Supabase access token (from the `Authorization: Bearer <token>` header) and the Supabase anon `apikey` header.

The content script SHALL be injected on the production portal origin via the manifest `content_scripts` match patterns, and the extension SHALL hold host permissions for both the portal origin and the production Supabase origin.

#### Scenario: Token captured from portal API request

- **WHEN** a logged-in user's browser issues an authenticated request from `https://portal.planmypeak.com` carrying an `Authorization: Bearer <user-access-token>` header
- **THEN** the main-world interceptor recognizes the origin, extracts the bearer token, and posts a `MY_PEAK_AUTH_FOUND` message containing the user token

#### Scenario: Content script injects on the new portal origin

- **WHEN** the user navigates to `https://portal.planmypeak.com`
- **THEN** the manifest match patterns cause both the main-world interceptor and the isolated-world bridge to be injected at `document_start`

#### Scenario: Old host no longer required

- **WHEN** auth capture is configured for production
- **THEN** the system targets `portal.planmypeak.com` rather than the former `planmypeak.com` host

### Requirement: Distinguish user access token from Supabase anon key

The extension SHALL NOT store the Supabase anon `apikey` as the user access token. A bearer token equal to the anon key SHALL be treated as a non-user token unless it originates from an `/auth/v1/user` request. The anon key SHALL be captured and stored separately for use in validation requests.

#### Scenario: Anon-key-only bearer is not stored as user token

- **WHEN** an intercepted request carries a bearer token identical to the Supabase anon `apikey` and is not an `/auth/v1/user` request
- **THEN** the user token is reported as `null` while the anon key is still captured

#### Scenario: User token from auth endpoint is stored

- **WHEN** an intercepted `/auth/v1/user` request carries a bearer token
- **THEN** that token is stored as the PlanMyPeak user access token together with the captured anon key

### Requirement: Store partial auth independently

The background worker SHALL persist the user access token, the Supabase anon key, and the capture timestamp independently, updating each only when a value is present, so credentials arriving in separate requests are not lost.

#### Scenario: Anon key arrives before user token

- **WHEN** the anon `apikey` is captured before the user access token
- **THEN** the anon key is stored and the previously stored user token is not overwritten with `null`

### Requirement: Validate token against the correct Supabase project

The extension SHALL validate the stored PlanMyPeak token by calling `GET {supabaseUrl}/auth/v1/user` with `Authorization: Bearer <token>` and the `apikey` header, where `{supabaseUrl}` resolves to the Supabase project that the production portal authenticates against (not a stale project).

#### Scenario: Valid token returns authenticated

- **WHEN** the stored token was issued by the production portal's Supabase project and the validation request returns `200`
- **THEN** the popup reports PlanMyPeak as authenticated

#### Scenario: Validation targets the configured production Supabase URL

- **WHEN** the production target is active
- **THEN** the validation request is sent to the configured production Supabase project URL, not the former `yqaskiwzyhhovthbvmqq.supabase.co` value if that project no longer issues the portal's tokens

### Requirement: Clear stored auth on rejected token

The background worker SHALL clear the stored PlanMyPeak token when the validation request returns `401`, so the popup reflects a not-authenticated state instead of a stale valid state.

#### Scenario: Expired or foreign token is cleared

- **WHEN** the validation request to the Supabase project returns `401`
- **THEN** the stored PlanMyPeak token is removed and the popup shows PlanMyPeak as not authenticated

### Requirement: Resolve production URLs via configurable target

The production PlanMyPeak app URL and Supabase URL SHALL be resolved through the existing target-switching configuration layer (not hardcoded at each call site), with production defaults set to the portal app URL and the confirmed production Supabase URL.

#### Scenario: Production target resolves portal URLs

- **WHEN** the extension resolves PlanMyPeak URLs for the production target
- **THEN** the app URL resolves to `https://portal.planmypeak.com` and the Supabase URL resolves to the configured production Supabase project URL

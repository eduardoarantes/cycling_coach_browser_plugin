## 1. Confirm the diagnosis

- [ ] 1.1 Ask the reporting coach whether the existing Refresh control next to PlanMyPeak unblocks their export, and record the answer in this change
- [ ] 1.2 If it does not, capture the service-worker logs for a failing export before continuing, and revisit the proposal's premise

## 2. Shared freshness rule

- [x] 2.1 Add `src/utils/jwt.ts` with `readJwtExpiry` and `isAccessTokenExpired`, no signature verification, clock-skew allowance, fallback to the maximum-age rule when the value is undecodable or has no usable expiry
- [x] 2.2 Add `tests/unit/utils/jwt.test.ts` covering valid, expired, skew boundary, malformed base64, opaque non-token, and token without an expiry claim
- [x] 2.3 Point `myPeakAuthService.isTokenExpired` at the shared rule
- [x] 2.4 Leave the value reported by `buildSiteControlPingResult` as `planMyPeak.authenticated` presence-based; if `isPlanMyPeakAuthenticated` becomes expiry-aware, give the handshake a presence-based reader instead so the page contract is unchanged
- [x] 2.5 Add a regression test asserting the handshake still reports authenticated for a present but expired credential

## 3. Environment mapping and capture refusal

- [x] 3.1 Add `planMyPeakEnvironmentForAppOrigin(origin)` to `src/utils/constants.ts`, exact-match for portal and staging, any loopback port for `local` in local-target builds, known Supabase project host mapping to production
- [x] 3.2 Add the recorded-environment storage key to `src/utils/constants.ts`
- [x] 3.3 Change `handleMyPeakAuthFound` to derive the environment from `sender`, ignore a capture from a confirmed inactive environment, and record the environment alongside the credential
- [x] 3.4 Treat a stored credential with a confirmed mismatched environment as absent on read; treat unknown or unrecorded as usable
- [x] 3.5 Extend `tests/unit/utils/constants.test.ts` with the origin mapping, including a lookalike origin such as `https://portal.planmypeak.com.evil.test`
- [x] 3.6 Extend `tests/unit/background/messageHandler.test.ts`: a staging-origin capture does not displace the production credential, and the environment comes from the sender rather than the message

## 4. Credential removal owner

- [x] 4.1 Add a background credential owner that performs compare-and-remove, serialized against capture writes through a single queue in the shape of `withCapturedWorkoutsLock`
- [x] 4.2 Route the API client's rejection path through the owner
- [x] 4.3 Route `validateMyPeakTokenViaAppBackend` in `src/background/messageHandler.ts` through the owner
- [x] 4.4 Stop `myPeakAuthStore.refreshAuth` from calling `clearAuth` directly; have it ask the background owner instead
- [x] 4.5 Add tests: a replacement captured between the decision and the removal is not erased; a late rejection does not clear a newer credential; a freshness-driven removal follows the same rule

## 5. Resolver with passive and active modes

- [x] 5.1 Add `src/background/api/planMyPeakAuthRecovery.ts` exposing a passive `resolveCredential`, an active `recoverForRun`, and `reportCredentialRejected`
- [x] 5.2 Make passive resolution answer from stored state only, never refreshing and never opening a tab, within the existing `COACH_LOOKUP_TIMEOUT_MS` budget
- [x] 5.3 Make recovery single-flight so concurrent callers share one attempt and one tab
- [x] 5.4 Count a refresh as unsuccessful unless the credential is accepted: a non-`refreshed` outcome, a credential failing the freshness or environment check, or a credential rejected on the retried request
- [x] 5.5 Verify no import cycle is introduced between the resolver, `authRefreshService` and the API client
- [x] 5.6 Add `tests/unit/background/api/planMyPeakAuthRecovery.test.ts`: capture followed by another rejection is unsuccessful; passive mode opens no tab and does not wait on an in-flight refresh

## 6. Run handle and latch

- [x] 6.1 Add `AuthRun`, `beginAuthRun` and `endAuthRun`, with `recoverForRun` requiring the handle as a non-optional argument
- [x] 6.2 Latch terminal failure per run; a latched run attempts nothing further and opens no tab
- [x] 6.3 Keep the time-based cooldown as a secondary guard only
- [x] 6.4 Mint runs in the background and hand the identifier to the requesting surface, so a caller cannot invent one
- [x] 6.5 Have the popup obtain a run before the duplicate-library preflight, not at the upload handler, since the preflight returns without starting the export when it fails
- [x] 6.6 Carry the run identifier on the request through the preflight, library lookup and creation, and every upload in the batch
- [x] 6.7 Carry a run through training plan export, which performs its own library lookup and creation
- [x] 6.8 Resolve any request that carries no run identifier passively, so recovery is a property of the request and not of the request type
- [x] 6.9 End the run on every exit path: failed preflight, cancelled duplicate decision, completed export and failed export
- [x] 6.10 Expire a run that is never ended, so a closed popup cannot leave terminal state that refuses the next attempt
- [x] 6.11 Keep one run open across the coach's duplicate-library decision rather than starting a second
- [x] 6.12 Add tests: a terminal run does not block a concurrent unrelated run; an explicit retry after signing in starts a fresh run; a thirty-workout batch opens at most one tab; an abandoned run expires

## 7. Passive and active call sites

- [x] 7.1 Use passive resolution in `buildSiteControlPingResult`
- [x] 7.2 Use passive resolution in the captured-import summary and status handlers in `src/background/capturedImports/siteControlHandlers.ts`
- [x] 7.3 Use active recovery in the popup export and training plan export paths only; leave the import start path and the captured-workout send passive, so their behaviour is unchanged by this change
- [x] 7.4 Keep `usePlanMyPeakLibraries` and the in-page overlay's use of the shared export transport passive, and assert this in tests so nobody adds a run identifier to them for symmetry
- [x] 7.5 Add a regression test that the handshake answers within its budget while a recovery is in flight

## 8. Request policy in the API client

- [x] 8.1 Split `makeApiRequest` into a pure `sendApiRequest(endpoint, init, token)` and a policy wrapper that resolves the credential through the resolver
- [x] 8.2 Retry a rejected request exactly once through `sendApiRequest` so a second retry is structurally impossible; skip the retry for a non-replayable body
- [x] 8.3 Add `code` to `PlanMyPeakUploadFailure` and `PlanMyPeakUploadItemResult`, and set it for auth rejections
- [x] 8.4 Add `tests/unit/background/api/planMyPeak.auth.test.ts`: at most one retry, and the rejection path defers removal to the owner

## 9. Structured auth failure through the export result

- [x] 9.1 Add `authFailure?: { reason }` to `ExportResult` in `src/types/export.types.ts`
- [x] 9.2 Preserve the structured auth failure through `findExistingPlanMyPeakLibraries`, whose result currently carries only a message, so the banner can distinguish an expired credential from a genuine API error
- [x] 9.3 Preserve it through library lookup and creation, where `getLibraries` currently drops the code before any workout uploads
- [x] 9.4 Set it in `PlanMyPeakAdapter.export` from the outer failure handling as well as from per-item codes, so a failure with no item results is still structured
- [x] 9.5 Preserve `itemsExported`, `itemResults` and warnings alongside it
- [x] 9.6 Stop remaining libraries in `useMultiLibraryExport` when a result carries `authFailure`, retaining partial successes and reporting the rest with one shared reason
- [x] 9.7 Extend `tests/unit/export/adapters/planMyPeak/PlanMyPeakAdapter.test.ts`: five workouts succeed, the credential then fails, and the result records the auth failure while reporting the five successes
- [x] 9.8 Add `tests/unit/hooks/useMultiLibraryExport.test.ts`: the batch stops on the first terminal auth failure and keeps already-successful libraries

## 10. Popup auth states

- [x] 10.1 Move `ConnectionGate` from `src/content/overlay/components/` to `src/components/` and update both importers
- [x] 10.2 Add the `checking → refreshing → ready | sign_in_required` states to `ExportDialog`, keeping Export available in `ready` and showing the blocking gate only after recovery fails
- [x] 10.3 Scope the gate to the PlanMyPeak destination so other destinations stay usable
- [x] 10.4 Wire the gate's refresh action to `useProviderAuthRefresh('planmypeak')` followed by re-validation
- [x] 10.5 Render the duplicate-check banner from the structured auth failure, so an unrecoverable credential shows the sign-in action rather than the generic "Unable to validate existing PlanMyPeak libraries" text

## 11. Messages

- [x] 11.1 Move the auth failure strings into `src/utils/uiStrings.ts`, worded by outcome
- [x] 11.2 Ensure no message claims a sign-in tab was opened when the run was latched or in cooldown
- [x] 11.3 Confirm page-facing errors still map to the existing authentication error code, carry no credential, and add no site-control request type

## 12. Verification

- [x] 12.1 Run `make check` and `make test-unit`
- [x] 12.2 Run `make build`
- [ ] 12.3 Manual: sign in, export four libraries, confirm success
- [ ] 12.4 Acceptance: click Export with library creation enabled, four libraries selected, and an expired or missing credential; recovery happens before the duplicate check, no banner appears, and all four libraries export
- [ ] 12.5 Acceptance: repeat 12.4 while signed out; exactly one recovery is attempted and one actionable failure is shown
- [ ] 12.6 Acceptance: cancel at the duplicate-library prompt with Ignore Upload, then export again; the second attempt still recovers
- [ ] 12.7 Manual: delete the stored credential, then export; the dialog shows recovering and Export was never disabled first
- [ ] 12.8 Manual: sign out of PlanMyPeak, then export; recovery is attempted, fails, and only then does the blocking gate appear
- [ ] 12.9 Manual: with production active, load staging in another tab, then export; the production credential survives
- [ ] 12.10 Manual: start a page-initiated captured import with an expired credential; it reports an authentication failure without opening a tab, exactly as it does today
- [ ] 12.11 Manual: with an expired credential, confirm the PlanMyPeak page still detects the extension promptly and still offers its import entry point
- [ ] 12.12 Confirm the captured-import and send paths behave exactly as before, then hand off to `extend-planmypeak-auth-recovery-to-imports`

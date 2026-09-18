## Why

A coach exporting four TrainingPeaks libraries to PlanMyPeak had every library fail with `PlanMyPeak authentication required` and zero workouts uploaded, while the popup showed them as authenticated. The extension treats a stored credential as usable whenever the storage key exists, calls a short-lived credential fresh for 24 hours, deletes it on the first `401` so the rest of the batch fails without reaching the network, and has no recovery in the export path even though a working background-tab refresh already exists.

Expired credentials fit the reported evidence but are not yet a confirmed cause of this specific incident. Every gap below is real independent of what triggered this report, so the change is worth making either way; confirming with the coach is the first implementation task.

## Scope

This change restores the popup-initiated export path. Page-initiated captured-workout imports and the captured-workout send path keep their current behaviour: they resolve credentials passively and do not recover. Extending recovery to those surfaces requires reworking how account identity tolerates a credential changing mid-lookup, which is a separate change, `extend-planmypeak-auth-recovery-to-imports`.

## What Changes

- Introduce a background-only credential resolver that owns every "is this credential usable, and can we obtain a better one" decision.
- Separate passive credential questions from active recovery. Passive callers answer from stored state within the existing lookup budget, never refresh, and never open a browser tab. Only explicit work started by the coach may recover, and in this change that means the popup export path.
- Scope recovery to a run, minted by the background and identified by an identifier that travels with the work, so a run that has failed terminally cannot block unrelated work and an explicit retry starts clean.
- Begin that run before the duplicate-library check rather than at the upload step. The preflight returns without starting the export when it fails, which is the banner the coach reported, so recovery attached later could never run.
- Carry the run identifier on the request rather than marking a request type active, because five callers share the library request type and one of them is an idle query that runs on popup open.
- Bound a run's lifetime, ending it on every exit from the export and expiring it if the surface that began it disappears, so an abandoned run cannot refuse the coach's next attempt.
- Treat recovery as successful only when the API accepts the credential. Today `refreshProviderAuth` reports success as soon as a token is written to storage, which is capture, not acceptance.
- Retry a rejected request exactly once, structurally, by splitting the request sender from the credential policy.
- Route every automatic credential removal through one background owner and serialize compare-and-remove against capture writes. Three removal paths exist today, and the one in the popup store reads then removes, which can erase a replacement that arrives in between.
- Carry a terminal auth failure as structured data through every stage where it can arise: the duplicate preflight, library lookup and creation, the adapter's outer failure handling, and the per-item results. A failure before any workout uploads has no item results to derive from, and codes are currently discarded at three layers.
- Derive credential freshness from the JWT `exp` claim instead of a 24-hour age heuristic, falling back to the age rule when the value is not a decodable JWT.
- Replace the binary popup auth gate with explicit states (`checking → refreshing → ready | sign_in_required`) so the gate cannot block the recovery it depends on.
- Ignore an auth capture whose origin maps to a confirmed inactive environment, so signing in to staging no longer overwrites the production credential. **BREAKING** for the implicit behaviour where any first-party origin could write the single credential slot.

Not changing: the site-control page surface gains no new request type, and `PING.supports` is untouched. The handshake's reported `planMyPeak.authenticated` value deliberately keeps its current presence-based meaning, even though the shared freshness rule becomes expiry-aware, so the page does not hide the import entry point for a credential that recovery could still rescue.

## Capabilities

### New Capabilities

- `planmypeak-auth-recovery`: how the extension decides a PlanMyPeak credential is unusable, recovers one for explicit work, bounds the attempts, and reports a terminal failure to the surfaces that started the work.

### Modified Capabilities

- `planmypeak-auth-validation`: credential freshness becomes expiry-aware rather than age-based; every automatic removal routes through one background owner performing a serialized compare-and-remove; captures from a confirmed inactive environment are refused rather than stored.

## Impact

**Affected code**

- `src/background/api/planMyPeakAuthRecovery.ts` — new
- `src/background/api/planMyPeak.ts` — request/policy split, single retry, error codes on failure types
- `src/background/messageHandler.ts` — credential removal through the owner, environment-aware capture handling, passive resolution in the handshake
- `src/background/capturedImports/siteControlHandlers.ts` — passive resolution in the summary and status handlers
- `src/store/myPeakAuthStore.ts` — stops removing credentials directly
- `src/services/myPeakAuthService.ts`, `src/utils/jwt.ts` (new), `src/utils/constants.ts`, `src/utils/uiStrings.ts`
- `src/types/export.types.ts`, `src/export/adapters/planMyPeak/PlanMyPeakAdapter.ts`, `src/hooks/useMultiLibraryExport.ts`
- `src/export/adapters/planMyPeak/duplicatePreflight.ts` — carries the run identifier and a structured failure
- `src/export/adapters/planMyPeak/transport.ts` and `trainingPlanExport.ts` — carry the run identifier
- `src/hooks/usePlanMyPeakLibraries.ts` — explicitly stays passive
- `src/components/ConnectionGate.tsx` (moved from the overlay, shared), `src/popup/components/export/ExportDialog.tsx`

**Known limitation accepted in this change**

While an export is recovering, a concurrent account lookup whose credential changes mid-flight resolves to unknown. Unknown already fails closed for imports, so the effect is a transient refusal rather than a wrong-account write. The follow-up change removes it.

**Dependencies**: none added.

## Context

The PlanMyPeak credential is never held by the extension itself. It is observed when the site's own page makes an authenticated request, captured by the main-world interceptor, and stored by the background worker. It is a short-lived access token.

Four properties of the current code combine into the reported failure:

1. `getAuthToken()` in `src/background/api/planMyPeak.ts` returns whatever is stored. `makeApiRequest` throws only when the storage key is absent, so an expired credential is indistinguishable from a working one until the server rejects it.
2. `myPeakAuthService.isTokenExpired()` compares the capture timestamp against `TOKEN_EXPIRY_MS`, a fixed 24 hours, while the credential itself lives about an hour. The popup therefore reports the coach as authenticated long after requests would be rejected.
3. `makeApiRequest` deletes the credential on any `401`. In a four-library batch, library one gets a genuine rejection and libraries two to four then fail without reaching the network, producing four copies of the same message.
4. Nothing in the export path recovers. `refreshProviderAuth('planmypeak')` in `src/services/authRefreshService.ts` already works and is already wired for this provider, but only into the auth status row and Settings. The export dialog gates destinations on a settings toggle and never consults auth state at all.

Since #145, three surfaces call the same API client: the popup export path, the captured-workout send path, and page-initiated captured-workout imports through the site-control channel. Any change to credential policy is felt by all three, which is what makes the ordering and scoping decisions below load-bearing rather than cosmetic.

Two constraints from `CLAUDE.md` bound the design. Credentials live in the background and never cross into a page, including in error text. The site-control surface is an explicit list that must not grow as a side effect of adding behaviour.

## Goals / Non-Goals

**Goals:**

- A signed-in coach whose credential expired completes their export without intervention.
- A signed-out coach gets one accurate statement and one action, not a repeated internal error string.
- No surface reports a credential as usable when it is not, and no surface refuses work that recovery could have rescued.
- Recovery is bounded so a large batch cannot open a tab per item, and a failed batch cannot poison unrelated work.
- Passive questions stay fast. A handshake must not wait on a refresh or open a tab.
- Signing in to staging does not sign the coach out of production.

**Non-Goals:**

- Extending active recovery to the captured-workout send or to page-initiated imports. Those keep today's behaviour here and are handled in `extend-planmypeak-auth-recovery-to-imports`, because they require account identity to tolerate a credential changing mid-lookup.
- Obtaining credentials without the site's own page producing them. The extension holds no credential of its own and this change does not alter that.
- Verifying token signatures. Expiry is read for scheduling only; the server remains the authority.
- Per-environment credential slots that would let a coach be signed in to two environments at once. Switching environments already clears the credential deliberately.
- Widening the page-reachable site-control surface, or changing what the handshake reports.

## Decisions

### Passive resolution and active recovery are different operations

This is the central decision, and it is what keeps the handshake honest.

`resolvePlanMyPeakCoachId` is called directly by the site-control handshake at `messageHandler.ts:1153`, under a documented budget: `COACH_LOOKUP_TIMEOUT_MS` is 1200ms, and the comment above the call states that a slow or unreachable PlanMyPeak must degrade to `null` rather than delay the handshake past the page's detection timeout. A single entry point that may refresh would put a 20 second `AUTH_REFRESH_TIMEOUT_MS` wait, and a browser tab, behind a handshake. That breaks a stated invariant, not merely a latency budget, and it would let a page cause a tab to open simply by detecting the extension.

So the resolver has two modes, and callers choose:

```ts
type Passive = { usable: boolean; token: string | null };

type Recovery =
  | { ok: true; token: string }
  | {
      ok: false;
      terminal: true;
      reason: 'sign_in_required' | 'environment_mismatch';
    };

export async function resolveCredential(): Promise<Passive>; // never refreshes, never opens a tab
export async function recoverForRun(run: AuthRun): Promise<Recovery>; // may refresh, may open a tab
export async function reportCredentialRejected(token: string): Promise<void>;
```

- **Passive** serves the handshake, the captured-import summary, and the import status request. It answers from stored state within the existing budget and degrades to "not usable" rather than waiting.
- **Active** serves the popup-initiated export. Only it may refresh in this change.

The captured-import guard and the captured-workout send stay passive here, so nothing in the import path changes behaviour. Turning them active is what the follow-up change does, together with the identity work that requires.

### The handshake keeps its current meaning of "authenticated"

Making the shared freshness rule expiry-aware would otherwise change what the page is told. `buildSiteControlPingResult` reports `planMyPeak.authenticated` from `isPlanMyPeakAuthenticated()`, which is presence-based today. If that became expiry-aware, the page would see `false` for an expired credential and could hide its import entry point, which is the same self-blocking failure as gating the export button on expiry.

The handshake therefore keeps reporting presence. Freshness is used by the surfaces that can act on it. If the page ever needs freshness, it should arrive as an additive field, not by redefining an existing one.

### Recovery is scoped to a run, with an explicit handle

A parameterless call plus a global reset cannot express a per-run latch: one failed batch would either block unrelated work, or another caller's reset would reopen recovery inside the failed batch.

```ts
export interface AuthRun {
  readonly id: string;
}
export function beginAuthRun(id: string): AuthRun;
export function endAuthRun(run: AuthRun): void;
```

- A run is minted by the background and requested by the surface that starts explicit work, so a caller cannot invent an identifier that grants itself recovery.
- The latch is per run. A run that has failed terminally attempts nothing further and opens no tab; other runs are unaffected.
- The time-based cooldown remains as a secondary guard against unrelated bursts, but the latch is what bounds a batch.
- The follow-up change adds the captured-workout send and the import runner, which will use its operation id so a run survives a service-worker restart.

#### The run begins before the duplicate check, not at upload

The popup export is not one request. The real sequence is: Export click, duplicate-library preflight, library lookup or creation, then the uploads. The preflight returns without starting the export when it fails (`ExportDialog.tsx:363`), which is precisely the red banner the reporting coach saw. A recovery attached to the upload handler therefore never runs, and the change would not fix the failure it was written for.

So the popup obtains a run before the preflight and carries its identifier through the preflight, the library lookup and creation, and every upload in the batch. Training plan export does the same, because it performs its own library lookup and creation.

#### Recovery travels on the request, not on the request type

`GET_PLANMYPEAK_LIBRARIES` has five senders: the duplicate preflight, the shared export transport used by both the popup and the in-page overlay, the popup's library list query in `usePlanMyPeakLibraries`, and training plan export. Marking the request type active would let an idle React Query hook open a browser tab when the popup opens.

The run identifier therefore travels on the request, and a request carrying none is resolved passively. That keeps the default safe: a new caller is passive until it deliberately asks not to be.

#### A run has a bounded lifetime

The run is opened before the preflight, so every path that leaves the export has to close it: a failed preflight, a cancelled duplicate decision, a completed export and a failed export. The popup can also disappear at any moment, taking its intent with it but not the background's run, so runs expire on their own as well. Without that, an abandoned terminal run would refuse the coach's next attempt, converting a transient failure into a stuck one.

One run deliberately spans the pause while the coach decides how to resolve a duplicate library. That is one export from their point of view, and splitting it would let the second half open a second tab.

### Recovery succeeds only on acceptance

`refreshProviderAuth` resolves `refreshed` as soon as a credential is written to storage (`authRefreshService.ts:99-117`). That is capture, not acceptance. Recovery counts all of the following as unsuccessful, each latching the run: a refresh outcome other than `refreshed`; a captured credential that still fails the freshness or environment check; and a captured credential whose retried request is rejected.

The last case is the specific hole in the first draft, where a captured-then-rejected credential cleared state without ever starting a cooldown, letting the next workout open another tab.

### Exactly one retry, structurally

`makeApiRequest` splits into a pure `sendApiRequest(endpoint, init, token)` and a policy wrapper that resolves a credential, sends, and on rejection calls `reportCredentialRejected` then recovers once and re-sends through `sendApiRequest`. The retry never re-enters the wrapper, so a second retry is impossible by construction rather than by a counter. Bodies are JSON strings today; the retry asserts a replayable body rather than assuming one.

### One owner for credential removal, with serialized compare-and-remove

There are three automatic removal paths, not two:

1. the API client on rejection,
2. popup validation, which issues its own request and clears at `messageHandler.ts:453`,
3. the popup store, which clears after its own expiry check at `myPeakAuthStore.ts:59`.

The third is the most dangerous under this change. Today it fires at most once a day; once freshness is expiry-aware it fires whenever the short-lived credential lapses, which is most of the time a popup opens. It reads, decides, then removes, so a replacement captured in between is erased.

All three route through one background owner that performs compare-and-remove: remove only when the stored credential still equals the one that was judged unusable. Because `chrome.storage.local` offers no compare-and-swap, the comparison and removal are serialized against capture writes through a single background queue, the same shape as `withCapturedWorkoutsLock`. The popup store stops removing credentials itself and asks the background instead, consistent with the existing rule that the background owns credential state and the popup is a reader.

### Auth failure travels as data, and is set on partial failure too

Attaching an error code to the adapter's throws does not reach the batch loop. `PlanMyPeakAdapter.export` catches internally and returns an `ExportResult` carrying only strings (`PlanMyPeakAdapter.ts:596-605`), and the upload summary discards codes: `PlanMyPeakUploadFailure` is `{providerWorkoutId, name, message}` and `PlanMyPeakUploadItemResult.error` is a string (`planMyPeak.ts:1397-1424`).

Setting `authFailure` only from the catch and from a total upload failure is not enough. When some workouts land and the credential then fails, the adapter pushes the failures into warnings and returns `success: true` with a count of what landed, so nothing marks the result as an auth failure and the remaining libraries proceed to fail the same way.

Nor is deriving it from per-item codes sufficient on its own. Library lookup and creation throw through `getLibraries` at `PlanMyPeakAdapter.ts:63`, which drops the code, and that happens before any workout uploads, so there are no per-item results to derive from. The duplicate preflight has the same problem one stage earlier: it returns a bare message, so the banner cannot tell an expired credential from a genuine API error and cannot offer the right action.

So the structured failure is preserved at every stage where it can arise: the preflight result, library lookup and creation, the adapter's outer failure handling, and the per-item codes. The successful count, the per-item results and the warnings are preserved alongside it. `useMultiLibraryExport` stops the remaining libraries when a result carries it, retains every partial success, and reports the rest with one shared reason.

### Freshness from the expiry claim, fail-soft when undecodable

A new pure helper `src/utils/jwt.ts` exposes `readJwtExpiry` and `isAccessTokenExpired`, shared by the popup and the background so one rule exists. About 30 seconds of skew means a replacement is obtained just before expiry rather than racing it.

When the value is not a decodable token or carries no usable expiry, the helper falls back to the existing maximum-age rule rather than declaring it expired. The asymmetry is deliberate: a wrong "expired" costs a quiet background refresh, while a wrong "signed out" evicts working coaches. This is the opposite choice from the `coachId` check, which stays fail-closed because nothing downstream catches a wrong-account write.

### Explicit auth states in the export dialog

A binary gate on `isAuthenticated` contradicts recovery: an expired credential would disable the export action, so the request that triggers recovery never happens. The dialog uses `checking → refreshing → ready | sign_in_required`. Export remains available in `ready`, starting it with an expired credential runs recovery and shows `refreshing`, and the blocking gate appears only after recovery fails. The gate is destination-scoped so other destinations remain usable, and the shared component moves from `src/content/overlay/components/ConnectionGate.tsx` to `src/components/` so the two surfaces cannot drift.

The dialog can only gate a failure it sees, which is the duplicate-library check. Every export surface closes the dialog once the export ends, so a failure during library resolution, upload, plan scheduling, or an export that skips the check, is shown in the result modal instead: `ExportResult` and `MultiExportResult` render the same gate, with the same refresh, whenever a result carries `authFailure`.

### Refuse the overwrite rather than tag and reject

Tagging a credential with its environment only lets the active environment reject it afterwards; the single slot is already overwritten and the coach is already signed out. To actually preserve the production credential, `handleMyPeakAuthFound` ignores a capture whose origin maps to a confirmed inactive environment, deriving the environment from the sender the way `handleWorkoutCaptured` already does.

A new `planMyPeakEnvironmentForAppOrigin(origin)` in `constants.ts` matches the portal and staging origins exactly and accepts any loopback port for `local` in local-target builds, mirroring `isLocalPlanMyPeakControlOrigin`. Captures from an unmapped origin are stored and recorded as unknown. Stored credentials recorded as unknown, or carrying no recorded environment, stay usable, so nobody is signed out by the upgrade.

Per-environment credential slots were considered and rejected: switching environments already clears the credential by design, so the extra state buys nothing.

### Nothing a page sends can open a tab in this change

Every page-reachable request — the handshake, the summary, the status request, and a page-initiated import — resolves passively here, so none of them can open a browser tab. That keeps extension detection free of visible side effects and keeps this change's blast radius inside the popup.

The follow-up change makes a page-initiated import active, at which point a tab can open from one. That is defensible on its own terms, since `REFRESH_PROVIDER_AUTH` is already allowed from that same allowlisted origin by explicit design (`messageHandler.ts:386-408`), but it is a separate decision and belongs with the identity work.

## Risks / Trade-offs

- **The passive and active split must be applied per call site** → A caller that picks the wrong mode either stalls a handshake or silently refuses recoverable work. Mitigation: the mode is an explicit argument with no default, and a regression test asserts the handshake answers within its budget while a refresh is in flight.
- **A concurrent account lookup can resolve to unknown while an export recovers** → The credential changes mid-lookup and the existing attribution check voids the result. Unknown already fails closed for imports, so this is a transient refusal rather than a wrong-account write. Mitigation: accepted here and removed by the follow-up change.
- **Run identifiers must be threaded through every stage of the export** → A stage that omits it silently reverts to passive and fails where it used to fail. Mitigation: the acceptance test drives the real Export click end to end rather than starting from a deleted credential, so a missed stage shows up as the original symptom.
- **An abandoned run could block the next attempt** → Mitigation: runs expire as well as ending explicitly, and the acceptance test cancels at the duplicate prompt and exports again.
- **Serializing credential writes adds a queue to the credential path** → Slight added latency on capture and removal. Accepted: the alternative is the lost-replacement race.
- **The diagnosis is not confirmed for this incident** → Expired credentials fit the evidence but were not proven. Mitigation: task 1 is asking the coach whether the existing Refresh control unblocks them. Every gap addressed here is real regardless.
- **Retry replays the request body** → Safe for JSON strings, unsafe for streams. Mitigation: assert replayability and skip the retry otherwise.
- **Recovery adds a coach lookup after each replacement** → One extra request per refresh. Accepted as the cost of not attributing a profile to the wrong session.

## Migration Plan

No data migration. Credentials stored before this change carry no recorded environment and remain usable, so no coach is signed out by deploying it. The handshake's reported fields are unchanged, so no page-side update is required. Rollback is a straight revert: nothing persists a new required field, and the added storage key is ignored by older builds.

## Open Questions

- Is the expired-credential diagnosis confirmed by the reporting coach? Resolve in task 1.
- Should the follow-up ship together with this change if the coach is not actually unblocked by the export path alone?
- Should the handshake eventually carry an additive freshness field, so a page can distinguish "signed in" from "signed in and usable right now"? Out of scope here; noted because this change makes the distinction meaningful for the first time.
- Does the staging deployment issue credentials with the same expiry lifetime as production? Affects only how often recovery runs, not correctness.

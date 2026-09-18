## ADDED Requirements

### Requirement: Single credential resolver owned by the background

The extension SHALL resolve a usable PlanMyPeak credential through one background-only module that owns every decision about whether a stored credential is usable and whether a replacement may be obtained. Surfaces that need a credential SHALL obtain it from that module rather than reading storage and deciding independently.

Recovery SHALL be single-flight: concurrent callers share one attempt and one result.

#### Scenario: Concurrent callers share one recovery attempt

- **WHEN** two requests need a credential at the same time and the stored one is unusable
- **THEN** one recovery attempt runs, at most one browser tab is opened, and both callers receive the same result

#### Scenario: Surfaces do not decide independently

- **WHEN** any surface needs to know whether the PlanMyPeak credential is usable
- **THEN** it calls the resolver rather than reading the storage key and applying its own freshness rule

### Requirement: Passive credential checks never refresh and never open a tab

The resolver SHALL offer a passive mode that answers from stored state only. Passive resolution SHALL NOT attempt recovery, SHALL NOT open a browser tab, and SHALL answer within the existing account lookup budget, degrading to an unknown or unusable answer rather than waiting.

The site-control handshake, the captured-import summary request, the captured-import status request, the captured-workout send, and page-initiated imports SHALL use passive resolution. The popup-initiated export SHALL use active recovery.

Extending active recovery to the captured-workout send and to page-initiated imports is deliberately out of scope here, because it requires account identity to tolerate a credential changing mid-lookup.

Because several callers share the same request types, whether a request may recover SHALL be carried by the request itself, in the form of a recovery run identifier, and SHALL NOT be a property of the request type. A request that carries no run identifier SHALL be resolved passively. In particular the popup's library list query and the in-page overlay's use of the shared export transport SHALL remain passive.

#### Scenario: A shared request type does not make a caller active

- **WHEN** the popup's library list query runs on popup open with an unusable credential
- **THEN** it is resolved passively, no recovery is attempted, and no browser tab is opened, even though the export path uses the same request type

#### Scenario: Overlay use of the shared transport stays passive

- **WHEN** the in-page overlay reaches PlanMyPeak through the shared export transport with an unusable credential
- **THEN** the request is resolved passively

#### Scenario: Handshake answers promptly while a refresh is in flight

- **WHEN** a page sends the handshake request while a credential recovery is in progress
- **THEN** the handshake answers within its existing lookup budget rather than waiting for the recovery to finish

#### Scenario: Extension detection opens no tab

- **WHEN** a page sends the handshake request and the stored credential is unusable
- **THEN** no browser tab is opened and no recovery is attempted

#### Scenario: Summary and status requests stay passive

- **WHEN** a page requests the captured-import summary or the status of a running import
- **THEN** the answer is produced without attempting recovery

#### Scenario: Popup export recovers

- **WHEN** the coach starts a popup export and the stored credential is unusable
- **THEN** recovery is attempted

#### Scenario: Captured-workout send and page imports stay passive for now

- **WHEN** a captured-workout send or a page-initiated import runs with an unusable credential
- **THEN** it reports an authentication failure without attempting recovery, exactly as it does today

### Requirement: Reported authentication state keeps its presence-based meaning

Making the shared freshness rule expiry-aware SHALL NOT change the authentication value reported to a page by the site-control handshake, which SHALL continue to reflect whether a credential is held. A credential that is expired but could still be recovered SHALL NOT be reported to the page as not authenticated, because the page would hide the entry point that triggers recovery.

#### Scenario: Expired credential is still reported as authenticated to the page

- **WHEN** the handshake runs while the stored credential is present but expired
- **THEN** the reported authentication value is unchanged from the presence-based answer, so the page keeps offering its import entry point

### Requirement: Recovery succeeds only when the API accepts the credential

The extension SHALL treat recovery as successful only when the resulting credential is accepted by the PlanMyPeak API. Observing that a credential was written to storage SHALL NOT by itself count as success.

A recovered credential that fails the freshness check, fails the environment check, or is rejected on the retried request SHALL count as an unsuccessful recovery.

#### Scenario: Capture followed by another rejection

- **WHEN** recovery captures a new credential and the retried request is still rejected
- **THEN** recovery is recorded as unsuccessful and the run is latched as terminally unauthenticated

#### Scenario: Captured credential fails the environment check

- **WHEN** recovery captures a credential whose environment does not match the active environment
- **THEN** recovery is recorded as unsuccessful rather than successful

### Requirement: Recovery is bounded per run by an explicit run handle

The extension SHALL scope recovery to a run identified by a handle created where explicit work begins, and SHALL require that handle to attempt recovery. The handle SHALL travel with the work so every request in one batch shares one run.

Once a run has failed terminally, every subsequent request in that run SHALL fail immediately without attempting recovery and without opening a browser tab. A terminal run SHALL NOT affect any other run, and no caller SHALL be able to reopen recovery inside a run that has already failed terminally.

A run SHALL end when its work ends, and explicitly retried work SHALL begin a new run with a clean state. A time-based cooldown alone SHALL NOT be relied upon to bound a batch.

#### Scenario: Batch of many uploads opens at most one tab

- **WHEN** a batch uploads thirty workouts and the credential is unusable for all of them
- **THEN** at most one browser tab is opened for the whole batch

#### Scenario: Terminal run suppresses further attempts

- **WHEN** recovery has already failed terminally during a run
- **THEN** later requests in that run fail immediately, open no tab, and do not wait for a cooldown to elapse

#### Scenario: A terminal run does not block unrelated work

- **WHEN** one run has failed terminally and a different run begins
- **THEN** the new run may attempt recovery

#### Scenario: Retry after signing in starts a fresh run

- **WHEN** the coach signs in and starts the same work again
- **THEN** a new run begins with no terminal state carried over, and recovery may be attempted

### Requirement: A rejected request is retried exactly once

The extension SHALL retry a rejected request at most once, after recovery, and SHALL make a second retry structurally impossible rather than relying on a counter. Requests whose body cannot be replayed SHALL NOT be retried.

#### Scenario: One retry after successful recovery

- **WHEN** a request is rejected and recovery succeeds
- **THEN** the request is sent once more with the recovered credential, and a further rejection is not retried again

#### Scenario: Non-replayable body is not retried

- **WHEN** a request carries a body that cannot be sent a second time
- **THEN** the request is not retried and the rejection is reported

### Requirement: Terminal auth failure is reported as structured data, including on partial uploads

The extension SHALL carry a terminal authentication failure as structured data rather than only as an error message string, and SHALL set it whenever such a failure occurred during the run.

The structured failure SHALL survive every stage where it can arise, not only the upload stage: the duplicate-library preflight, the library lookup and creation, and the export's outer failure handling. A failure before any workout uploads has no per-item results to derive from, so deriving it from per-item codes alone is not sufficient.

Where some workouts already uploaded, the count of successful uploads, the per-item results, and any warnings SHALL be preserved alongside the structured failure.

#### Scenario: Preflight failure is structured

- **WHEN** the duplicate-library preflight fails because the credential is terminally unusable
- **THEN** the failure is reported as a structured authentication failure rather than a generic message, so the surface can offer the right next action

#### Scenario: Library resolution failure is structured

- **WHEN** library lookup or creation fails because the credential is terminally unusable, before any workout uploads
- **THEN** the result records a structured authentication failure

#### Scenario: Partial upload still reports the auth failure

- **WHEN** five workouts upload successfully and the credential then fails terminally for the rest of that library
- **THEN** the result records the terminal authentication failure while still reporting the five successful uploads and their item results

#### Scenario: Remaining libraries stop rather than repeat the error

- **WHEN** the first of four libraries records a terminal authentication failure
- **THEN** the remaining three are reported as stopped with one shared reason, instead of each repeating the same authentication error

#### Scenario: Partial successes are preserved across the batch

- **WHEN** two libraries have uploaded successfully and the third fails terminally
- **THEN** the two successful libraries and their uploaded workout counts remain in the reported result

### Requirement: Auth state surfaces do not block their own recovery

The popup export surface SHALL represent PlanMyPeak authentication with explicit states covering checking, recovering, ready, and sign-in required. It SHALL NOT disable the export action solely because the stored credential is expired, because doing so prevents the request that would trigger recovery.

A blocking gate SHALL be shown only after recovery has failed.

#### Scenario: Expired credential still allows export to start

- **WHEN** the coach opens the export dialog with an expired credential
- **THEN** the export action remains available, and starting it runs recovery and shows a recovering state

#### Scenario: Blocking gate appears only after recovery fails

- **WHEN** recovery fails because the coach is signed out
- **THEN** a blocking gate is shown naming sign-in as the next action

#### Scenario: Other destinations remain usable

- **WHEN** the PlanMyPeak credential cannot be recovered and another export destination is enabled
- **THEN** the gate applies only to PlanMyPeak and the other destination remains selectable

### Requirement: One run spans the whole export, beginning before the duplicate check

The popup export SHALL obtain a recovery run before the duplicate-library preflight runs, and SHALL carry that run's identifier through the preflight, the library lookup and creation, and every upload in the batch. The run SHALL be minted by the background rather than invented by the caller.

Recovery SHALL NOT be attached only to the upload step. The preflight runs first and returns without starting the export when it fails, so a recovery attached later can never run and the coach is left with the original error.

Training plan export SHALL obtain and carry a run in the same way, because it performs its own library lookup and creation.

#### Scenario: Expired credential recovers before the duplicate check

- **WHEN** the coach clicks Export with library creation enabled, four libraries selected, and an expired or missing credential
- **THEN** recovery runs before the duplicate-library check, the check then succeeds, and all four libraries export

#### Scenario: One run covers preflight, library resolution and uploads

- **WHEN** an export proceeds through the preflight, library lookup and creation, and the uploads
- **THEN** all of those requests share one recovery run, so at most one recovery is attempted for the whole export

#### Scenario: Training plan export recovers too

- **WHEN** a training plan export runs its own library lookup with an unusable credential
- **THEN** it recovers under its own run rather than failing outright

### Requirement: A recovery run has a bounded lifetime

The extension SHALL end a recovery run on every path that leaves the export, including a failed preflight, a cancelled duplicate decision, a completed export and a failed export. Because the surface that began the run can disappear without notice, a run SHALL also expire on its own, so an abandoned run cannot leave a terminal state that blocks the coach's next attempt.

A single run MAY remain open while the coach is deciding how to resolve a duplicate library, because that is one export from the coach's point of view.

#### Scenario: Cancelling at the duplicate prompt does not block the next attempt

- **WHEN** the coach cancels at the duplicate-library prompt and then starts the export again
- **THEN** the second attempt recovers normally rather than being refused by state left behind by the first

#### Scenario: Closing the popup mid-export does not leak a run

- **WHEN** the popup is closed while an export is in progress
- **THEN** the run ends or expires, and a later export is not refused because of it

#### Scenario: One run survives the duplicate decision

- **WHEN** the coach pauses at the duplicate-library prompt and then chooses to proceed
- **THEN** the export continues under the same run rather than beginning a new one

### Requirement: Recovery reports no credential and describes only what happened

Messages produced by recovery SHALL NOT contain any credential, and SHALL NOT state that a sign-in tab was opened when none was opened. Page-facing errors SHALL continue to map to the existing authentication error code without introducing a new page-reachable request type.

#### Scenario: Cooldown or terminal path does not claim a tab was opened

- **WHEN** a request fails because the run is terminally latched or in cooldown, so no tab was opened
- **THEN** the reported message does not state that a tab was opened

#### Scenario: Page-facing error carries no credential

- **WHEN** a page-initiated import fails for authentication reasons
- **THEN** the response carries the existing authentication error code and a message containing no credential

## ADDED Requirements

### Requirement: Captured workouts are listed in the popup

The New Workouts tab SHALL list captured workouts from local storage, newest first, showing for each the title, workout day, athlete id, sport (from `workoutTypeValueId`), planned duration and TSS when present, a TrainingPeaks environment marker when the record came from sandbox, and a status label (`Pending`, `Sent`, `Dismissed`). The list SHALL read only local storage and SHALL NOT request the workout from TrainingPeaks.

#### Scenario: Records rendered from storage

- **WHEN** the tab opens with records in storage
- **THEN** each record SHALL be rendered as a row with the fields above, ordered by `capturedAt` descending

#### Scenario: Empty state

- **WHEN** no records are stored
- **THEN** the tab SHALL show an empty-state message explaining that workouts created on TrainingPeaks will appear here

#### Scenario: Live update

- **WHEN** a new workout is captured while the popup is open
- **THEN** the row SHALL appear without reopening the popup

#### Scenario: No TrainingPeaks request

- **WHEN** the list renders or a send runs
- **THEN** no `GET_LIBRARY_ITEMS`, `GET_PLAN_WORKOUTS` or other TrainingPeaks fetch SHALL be issued for the captured workouts

### Requirement: Send one workout to the default PlanMyPeak library

Each pending row SHALL offer a **Send to PlanMyPeak** action. Sending SHALL convert the stored record to the library-item shape with the existing plan-workout normalizer, run the shared PlanMyPeak adapter (`transform`, `validate`, `export`) with `createFolder: false` so the target resolves to the coach's default library (`isDefault: true`), and SHALL NOT create or name a library. The provider identity sent to PlanMyPeak SHALL be namespaced: `cal:{workoutId}` for production captures and `cal-sandbox:{workoutId}` for sandbox captures, minted by the transformer through a `providerIdNamespace` config option.

#### Scenario: Successful send

- **WHEN** the coach activates Send on a pending row and the upload succeeds
- **THEN** the workout SHALL be uploaded with `providerWorkoutId` equal to `cal:{workoutId}`, the row SHALL change to `Sent` with the PlanMyPeak library name shown, and the record SHALL store `sentAt` and `planMyPeakWorkoutId`

#### Scenario: Sandbox capture uses its own namespace

- **WHEN** the coach sends a record captured from the sandbox host
- **THEN** the upload SHALL use `providerWorkoutId` equal to `cal-sandbox:{workoutId}` and SHALL NOT update a production workout with the same numeric id

#### Scenario: Namespace is applied by the transformer

- **WHEN** the adapter transforms a captured workout with `providerIdNamespace` set
- **THEN** `provider_workout_id` and `source_file` SHALL carry the namespace, and no code outside the transformer SHALL rewrite them

#### Scenario: Default library resolved by flag

- **WHEN** the coach's libraries include one with `isDefault: true` named other than "My Library"
- **THEN** the workout SHALL be sent to that library

#### Scenario: Upload failure keeps the row pending

- **WHEN** the upload returns an error
- **THEN** the row SHALL stay `Pending`, show the error text, and remain sendable

#### Scenario: Transform warning surfaced

- **WHEN** the adapter skips the workout or sends it without a structure because its targets cannot be expressed
- **THEN** the row SHALL show the adapter's warning text and, if skipped, SHALL stay `Pending`

#### Scenario: Re-send is an update

- **WHEN** the coach activates Send on a row already marked `Sent`
- **THEN** the upload SHALL run again and the existing PlanMyPeak workout SHALL be updated in place (upsert), not duplicated

### Requirement: Send outcomes are persisted by the background per workout

The export message SHALL accept an optional `capturedKeys` map from provider id to record key. When present, the background upload loop SHALL, immediately after each workout's upload, mark that record `sent` (with `planMyPeakWorkoutId`, library name and `sentAt`) or store its `lastSendError`, through the serialized capture service. The popup SHALL NOT be responsible for writing send outcomes.

#### Scenario: Popup closes mid-send

- **WHEN** Send all starts for three pending records and the popup is closed after the first upload completes
- **THEN** the background SHALL finish the remaining uploads, and on reopening the popup every record SHALL be `Sent` with its PlanMyPeak id or `Pending` with its error; none SHALL be `Pending` without an error after a successful upload

#### Scenario: Outcome written before the next upload starts

- **WHEN** the second of three uploads is in flight
- **THEN** the first record's outcome SHALL already be in storage

#### Scenario: Message without captured keys is unchanged

- **WHEN** the export dialog or overlay sends the export message without `capturedKeys`
- **THEN** no captured-workout record SHALL be touched

### Requirement: Per-workout results are part of the shared export contract

The adapter export result SHALL include per-item results keyed by provider id (`providerWorkoutId`, `success`, `remoteId`, `libraryName`, `error`), and the background upload summary's failure entries SHALL carry `providerWorkoutId` alongside the workout name.

#### Scenario: Identically named workouts are distinguishable

- **WHEN** two pending records both titled "Intervals" are sent and one fails
- **THEN** the result SHALL identify the failed one by its provider id, and only that row SHALL show the error

#### Scenario: Every failure is preserved when all uploads fail

- **WHEN** every workout in a send fails to upload
- **THEN** the background SHALL return the full summary with every keyed failure, the adapter result SHALL report `success: false` with one `itemResults` entry per workout and every failure message in `errors`, not only the first

#### Scenario: Existing consumers unaffected

- **WHEN** the library export dialog, the overlay, or the training-plan export reads the export result
- **THEN** the existing fields (`success`, `itemsExported`, `warnings`, `errors`) SHALL keep their meaning, a total failure SHALL still surface as a failure to the user, and `itemResults` SHALL be additive

### Requirement: Send all pending

The tab SHALL offer a **Send all pending** action that sends every pending record in one adapter run, reporting per-workout results and updating each record's status independently.

#### Scenario: Mixed outcome

- **WHEN** three records are pending and one fails to upload
- **THEN** two rows SHALL become `Sent`, the failing row SHALL stay `Pending` with its error, and the summary SHALL state two sent and one failed

#### Scenario: Nothing pending

- **WHEN** no records are pending
- **THEN** the Send all action SHALL be disabled

### Requirement: Sending is gated like every other import

The send actions SHALL be disabled when PlanMyPeak is not authenticated or the PlanMyPeak connection is disabled, and SHALL be blocked when the TrainingPeaks/PlanMyPeak account match is a confirmed mismatch, with the existing account-mismatch banner as the explanation.

#### Scenario: PlanMyPeak not authenticated

- **WHEN** no valid PlanMyPeak token is stored
- **THEN** Send and Send all SHALL be disabled with a hint to connect PlanMyPeak in Settings

#### Scenario: Confirmed account mismatch

- **WHEN** the account-match hook reports a confirmed mismatch
- **THEN** Send and Send all SHALL be disabled and the mismatch banner SHALL be visible

#### Scenario: Accounts match

- **WHEN** the account-match hook reports a match
- **THEN** Send and Send all SHALL be enabled for pending rows

### Requirement: Dismiss and clear

Each pending row SHALL offer **Dismiss**, and the tab SHALL offer **Clear sent & dismissed**. Neither action SHALL contact PlanMyPeak or TrainingPeaks.

#### Scenario: Dismiss a row

- **WHEN** the coach activates Dismiss on a pending row
- **THEN** the record SHALL become `Dismissed`, the pending count SHALL decrease, and the row SHALL remain visible with its new status

#### Scenario: Clear finished rows

- **WHEN** the coach activates Clear sent & dismissed
- **THEN** all `Sent` and `Dismissed` records SHALL be removed from storage and pending rows SHALL remain

### Requirement: Send progress is visible

While a send runs, the affected rows SHALL show a sending state and the actions SHALL be disabled; the shared export-progress reporting SHALL be used for the upload so the existing progress banner and badge reflect it.

#### Scenario: Row sending state

- **WHEN** a send is in progress for a row
- **THEN** that row SHALL show `Sending…` and its Send and Dismiss actions SHALL be disabled until the result arrives

#### Scenario: Progress banner

- **WHEN** Send all runs for several workouts
- **THEN** the export-progress banner SHALL show the upload progress with PlanMyPeak as the destination

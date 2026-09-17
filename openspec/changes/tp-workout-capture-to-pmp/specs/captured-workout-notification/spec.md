## ADDED Requirements

### Requirement: Action badge shows the pending capture count

The extension action badge SHALL show the number of captured workouts with `status: 'pending'` whenever no export is being reported, in a colour distinct from the export-progress colours. The badge SHALL be empty when the pending count is zero and no export state is shown.

#### Scenario: First capture shows a badge

- **WHEN** a workout is captured and stored as pending while the badge is empty
- **THEN** the badge text SHALL become `1`

#### Scenario: Count updates on further captures and on status changes

- **WHEN** a second workout is captured, then one is marked `sent`
- **THEN** the badge SHALL read `2` after the capture and `1` after the status change

#### Scenario: Badge clears when nothing is pending

- **WHEN** the last pending record is sent or dismissed
- **THEN** the badge text SHALL be empty

#### Scenario: Large counts are capped

- **WHEN** more than 99 records are pending
- **THEN** the badge SHALL read `99+`

### Requirement: Export progress takes priority over the pending count

A single badge owner SHALL arbitrate between export progress and the pending count. While an export is `in_progress`, or is `completed` / `failed` with `completedAt` less than the clear delay ago, the export badge SHALL be shown; otherwise the pending count SHALL be shown instead of an empty badge. A persisted `completed` or `failed` export state older than the clear delay SHALL NOT keep the export badge on screen, regardless of whether the popup has dismissed it.

#### Scenario: Export in progress hides the count

- **WHEN** two workouts are pending and an export starts
- **THEN** the badge SHALL show the export progress (for example `0/5`) and not `2`

#### Scenario: Count returns after export clears

- **WHEN** the export completes and its badge clear delay elapses while two workouts are still pending
- **THEN** the badge SHALL read `2`

#### Scenario: Stale completed state expires

- **WHEN** a `completed` export state with `completedAt` older than the clear delay is still in storage, two workouts are pending, and the badge is refreshed
- **THEN** the badge SHALL read `2`, not `✓`

#### Scenario: Stale completed state after restart

- **WHEN** the browser restarts with an old `completed` export state in storage and one pending record
- **THEN** the badge SHALL read `1` after the service worker starts

#### Scenario: No direct badge writes outside the owner

- **WHEN** export progress services need to change the badge
- **THEN** they SHALL call the badge owner rather than `chrome.action.setBadgeText` directly for the idle case

### Requirement: Badge is restored when the service worker starts

The background SHALL recompute the badge from stored state on `chrome.runtime.onStartup` and `chrome.runtime.onInstalled`.

#### Scenario: Browser restart with pending captures

- **WHEN** the browser restarts with three pending records in storage and no active export
- **THEN** the badge SHALL read `3` after the service worker starts

### Requirement: Popup tab shows a pending dot

The popup's tab navigation SHALL include a **New Workouts** tab that renders a visible dot indicator with an accessible label while the pending count is greater than zero, and no dot otherwise.

#### Scenario: Dot shown while pending

- **WHEN** the popup opens with one or more pending records
- **THEN** the New Workouts tab SHALL show the dot and expose the pending count to assistive technology

#### Scenario: Dot removed when nothing is pending

- **WHEN** the last pending record is sent or dismissed while the popup is open
- **THEN** the dot SHALL disappear without reopening the popup

#### Scenario: Tab is available without PlanMyPeak authentication

- **WHEN** TrainingPeaks is authenticated and PlanMyPeak is not
- **THEN** the New Workouts tab SHALL still be shown and list captured workouts; only the send action is gated

## ADDED Requirements

### Requirement: Workout creation is detected on TrainingPeaks

The extension SHALL detect a workout creation on TrainingPeaks by observing, in the page's main world, a `POST` to `/fitness/v6/athletes/{athleteId}/workouts` on either TrainingPeaks API host (production or sandbox), made through `fetch` or `XMLHttpRequest`. Detection SHALL use an exact path match and SHALL NOT match sibling routes under a workout id.

#### Scenario: Create via fetch is detected

- **WHEN** the page calls `fetch` with method `POST` to `https://tpapi.trainingpeaks.com/fitness/v6/athletes/4830660/workouts` and the response is 2xx JSON
- **THEN** the interceptor SHALL post a capture message to the isolated world containing the parsed request body, the parsed response body, the athlete id and the response's `workoutId`

#### Scenario: Create via XHR is detected

- **WHEN** the page opens an `XMLHttpRequest` with method `POST` to the same URL, sends a string JSON body, and the request loads with a 2xx JSON response
- **THEN** the interceptor SHALL post the same capture message as for `fetch`

#### Scenario: Sandbox host is detected

- **WHEN** the same call is made to `https://tpapi.sandbox.trainingpeaks.com`
- **THEN** it SHALL be captured and tagged with the `sandbox` environment

#### Scenario: Sibling routes are not captured

- **WHEN** the page makes a request to `/fitness/v6/athletes/4830660/workouts/123/comments` or to `/fitness/v6/athletes/4830660/workouts/123/details`
- **THEN** no capture message SHALL be posted

#### Scenario: Non-2xx response is not captured

- **WHEN** the create request returns a 4xx or 5xx status
- **THEN** no capture message SHALL be posted

### Requirement: Capture never affects the page's request

The capture path SHALL be transparent to the page: the original request SHALL be sent unchanged, the page SHALL receive the original response object or XHR result, and any failure inside the capture path SHALL be swallowed.

#### Scenario: Response body is read from a clone

- **WHEN** a create request is captured via `fetch`
- **THEN** the interceptor SHALL read the JSON from a clone of the response and return the original response to the caller unread

#### Scenario: Capture does not delay the caller

- **WHEN** a create request is captured via `fetch` and the response body takes time to arrive
- **THEN** the promise returned to the page SHALL settle as soon as the original response is available, before the clone has been parsed or the capture posted

#### Scenario: Reading the request body does not delay dispatch

- **WHEN** the page calls `fetch` with a `Request` object whose body takes time to read
- **THEN** the original request SHALL be dispatched synchronously with the call, and the body SHALL be read from a clone concurrently with the request rather than before it

#### Scenario: Unparseable body is ignored

- **WHEN** the request body is not a string or `Request` (for example a `FormData` or `ReadableStream`), or the response is not valid JSON
- **THEN** the page's request SHALL complete normally and no capture message SHALL be posted

#### Scenario: Capture error does not reject the page's promise

- **WHEN** an exception is thrown while parsing or posting the capture
- **THEN** the promise returned to the page SHALL still resolve with the original response

### Requirement: Captures are relayed to the background and origin-gated

The isolated bridge SHALL forward main-world capture messages to the background as a `WORKOUT_CAPTURED` runtime message without importing schemas or validating content. The background SHALL accept `WORKOUT_CAPTURED` only from a content script whose sender URL origin is a TrainingPeaks app origin.

#### Scenario: Bridge forwards a capture

- **WHEN** the bridge receives a `window` message with `source: 'trainingpeaks-extension-main'` and type `TP_WORKOUT_CREATED` or `TP_WORKOUT_UPDATED`
- **THEN** it SHALL call `chrome.runtime.sendMessage` with type `WORKOUT_CAPTURED` carrying the kind, athlete id, workout id, request body, response body and timestamp

#### Scenario: Bridge ignores foreign messages

- **WHEN** a `window` message arrives from another source or with another type
- **THEN** the bridge SHALL ignore it

#### Scenario: Background rejects captures from non-TrainingPeaks senders

- **WHEN** a `WORKOUT_CAPTURED` message arrives with no `sender.tab` or with a `sender.url` whose origin is not a TrainingPeaks app origin
- **THEN** the background SHALL NOT store anything and SHALL respond with `success: false`

### Requirement: Captured workouts are validated, normalized and stored locally

The background SHALL validate a capture with a Zod schema, normalize it into a compact record, and store it in `chrome.storage.local` under the `captured_workouts` key as a map keyed by `environment:athleteId:workoutId`, where `environment` is `production` or `sandbox` derived from the sender origin. Normalization SHALL parse `structure` when it arrives as a JSON string, SHALL remove the `polyline` array, and SHALL keep only the fields needed for display and for the PlanMyPeak transform (`title`, `workoutDay`, `workoutTypeValueId`, `structure`, `totalTimePlanned`, `tssPlanned`, `ifPlanned`, `distancePlanned`, `caloriesPlanned`, `velocityPlanned`, `energyPlanned`, `elevationGainPlanned`, `description`, `coachComments`, `userTags`).

#### Scenario: New capture is stored as pending

- **WHEN** a valid `WORKOUT_CAPTURED` message of kind `create` arrives for a key not yet stored
- **THEN** a record SHALL be written with `status: 'pending'`, `capturedAt` and `updatedAt` set to the capture timestamp, the workout id and `lastModifiedDate` taken from the response, and the normalized workout fields

#### Scenario: Structure string is parsed and polyline dropped

- **WHEN** the captured `structure` is a JSON string containing `structure`, `polyline`, `primaryLengthMetric` and `primaryIntensityMetric`
- **THEN** the stored `structure` SHALL be an object with `structure`, `primaryLengthMetric`, `primaryIntensityMetric` (and `primaryIntensityTargetOrRange` when present) and SHALL NOT contain `polyline`

#### Scenario: Duplicate create collapses

- **WHEN** a second `create` capture arrives for a key that already exists
- **THEN** the workout fields and `updatedAt` SHALL be refreshed and the existing `status`, `capturedAt`, `sentAt` and `planMyPeakWorkoutId` SHALL be preserved

#### Scenario: Same id on production and sandbox are distinct records

- **WHEN** a create capture with `workoutId: 123` arrives from the production host and another with `workoutId: 123` arrives from the sandbox host
- **THEN** two records SHALL exist with different keys, and marking one `sent` SHALL NOT change the other

#### Scenario: Invalid capture is rejected

- **WHEN** the capture fails schema validation (for example a missing `title` or a non-numeric `workoutId`)
- **THEN** nothing SHALL be stored and the failure SHALL be logged

#### Scenario: Unbounded count

- **WHEN** the coach creates more workouts than are already stored
- **THEN** each SHALL be stored; the extension SHALL NOT evict records on its own

#### Scenario: Malformed stored entries are skipped on read

- **WHEN** the stored map contains an entry that does not match the record schema
- **THEN** reads SHALL return the valid entries and omit the malformed one

### Requirement: Mutations of the captured-workout map are serialized

Every write to the `captured_workouts` map (store, update, remove) SHALL be a read-modify-write executed through a single queue in the background so that no write can overwrite another's change. The popup SHALL NOT write the map directly; it SHALL only send runtime messages.

#### Scenario: Concurrent captures both land

- **WHEN** two `WORKOUT_CAPTURED` messages for different keys are handled concurrently
- **THEN** both records SHALL be present afterwards

#### Scenario: Capture racing a status update loses neither

- **WHEN** a `WORKOUT_CAPTURED` message for a new key and an `UPDATE_CAPTURED_WORKOUT` marking an existing key `sent` are handled concurrently
- **THEN** the new record SHALL be present and the existing record SHALL be `sent`

#### Scenario: Popup never writes storage directly

- **WHEN** the popup dismisses, clears or marks a record
- **THEN** it SHALL do so through a runtime message and SHALL NOT call `chrome.storage.local.set` on the `captured_workouts` key

### Requirement: Edits to captured workouts refresh the stored copy

The extension SHALL detect a `PUT` to `/fitness/v6/athletes/{athleteId}/workouts/{workoutId}` and, when a record with that key exists, refresh its workout fields and `updatedAt` without changing its status. Edits to workouts that were never captured SHALL be ignored.

#### Scenario: Edit of a captured workout refreshes it

- **WHEN** a `PUT` capture arrives for a stored key with a changed `structure` and `title`
- **THEN** the stored workout fields SHALL reflect the new values, `updatedAt` SHALL advance, and `status` SHALL be unchanged

#### Scenario: Edit of an unknown workout is ignored

- **WHEN** a `PUT` capture arrives for a key that is not stored
- **THEN** nothing SHALL be stored

#### Scenario: Edit of a dismissed workout does not resurface it

- **WHEN** a `PUT` capture arrives for a record with `status: 'dismissed'`
- **THEN** the workout fields SHALL refresh and `status` SHALL remain `dismissed`

### Requirement: Captured workouts have a local lifecycle the popup can drive

The background SHALL expose runtime messages to list captured workouts, update one record's status, and remove records. Status transitions are `pending → sent`, `pending → dismissed`, `sent → pending` (re-send allowed) and removal of `sent` and `dismissed` records. Send outcomes SHALL be written by the background upload loop itself (see `captured-workout-send-to-planmypeak`), so a popup that closes mid-send does not lose them.

#### Scenario: List returns records newest first

- **WHEN** the popup sends `GET_CAPTURED_WORKOUTS`
- **THEN** the response SHALL contain all valid records ordered by `capturedAt` descending and the count of `pending` records

#### Scenario: Mark sent

- **WHEN** the popup sends `UPDATE_CAPTURED_WORKOUT` with `status: 'sent'` and a `planMyPeakWorkoutId`
- **THEN** the record SHALL store `status: 'sent'`, `sentAt`, `planMyPeakWorkoutId`, and SHALL clear `lastSendError`

#### Scenario: Record send error

- **WHEN** the popup sends `UPDATE_CAPTURED_WORKOUT` with `lastSendError` and no status change
- **THEN** the record SHALL keep `status: 'pending'` and store the error text

#### Scenario: Dismiss

- **WHEN** the popup sends `UPDATE_CAPTURED_WORKOUT` with `status: 'dismissed'`
- **THEN** the record SHALL store `status: 'dismissed'` and SHALL no longer count as pending

#### Scenario: Clear finished records

- **WHEN** the popup sends `REMOVE_CAPTURED_WORKOUTS` with `statuses: ['sent', 'dismissed']`
- **THEN** all records with those statuses SHALL be removed and pending records SHALL remain

### Requirement: Captured workouts never cross into a page

Captured workouts SHALL NOT be exposed through the PlanMyPeak site-control channel or any other page-bound message, and no capture message SHALL carry an `Authorization` header or any credential.

#### Scenario: Site-control unchanged

- **WHEN** a PlanMyPeak page sends `PING`
- **THEN** `supports` SHALL NOT list any captured-workout request type and no such request type SHALL be routed

#### Scenario: Capture payload carries no credentials

- **WHEN** a capture message is posted from the main world
- **THEN** it SHALL contain only the request body, response body, ids, kind and timestamp, never request headers

## Purpose

Defines the contract that lets the PlanMyPeak web application detect the browser extension, read the coach's TrainingPeaks workout libraries, workouts and training plans through it, and ask it to open the import experience — while guaranteeing that no authentication credential ever crosses into the page.

## ADDED Requirements

### Requirement: Control channel is restricted to allowlisted PlanMyPeak origins

The extension SHALL accept control requests only from pages whose origin appears in the PlanMyPeak origin allowlist. Requests originating from any other origin, from a cross-origin frame, or from a different window than the one hosting the page SHALL be ignored without a response and without any side effect.

#### Scenario: Request from the production portal origin

- **WHEN** a page served from `https://portal.planmypeak.com` sends a control request
- **THEN** the extension processes the request and returns a response

#### Scenario: Request from a configured local development origin

- **WHEN** a page served from a PlanMyPeak local development origin included in the allowlist sends a control request
- **THEN** the extension processes the request and returns a response

#### Scenario: Request from a non-allowlisted origin

- **WHEN** a page served from an origin that is not in the allowlist sends a control request
- **THEN** the extension ignores the request, returns no response, and performs no data access

#### Scenario: Request forged from a cross-origin frame

- **WHEN** a message arrives whose source window is not the top-level page window of an allowlisted origin
- **THEN** the extension ignores the message and performs no data access

### Requirement: Every control request is validated against a typed contract

The extension SHALL validate each inbound request against a schema before acting on it. A request MUST carry a protocol marker identifying it as a PlanMyPeak site-control request, a request identifier, a request type drawn from the supported request-type allowlist, and a payload matching that type. Any request that fails validation SHALL receive an error response identifying the failure, and SHALL NOT reach any data-access or import code path.

#### Scenario: Request with an unsupported type

- **WHEN** an allowlisted origin sends a request whose type is not in the supported request-type allowlist
- **THEN** the extension responds with an error identifying the request type as unsupported

#### Scenario: Request with a malformed payload

- **WHEN** an allowlisted origin sends a supported request type whose payload fails schema validation
- **THEN** the extension responds with a validation error and performs no data access

#### Scenario: Response correlation

- **WHEN** the extension responds to a request
- **THEN** the response carries the same request identifier as the request that produced it, so concurrent requests can be correlated by the page

### Requirement: Page can detect extension presence and readiness

The extension SHALL answer a presence request with its protocol version, its extension version, and the current readiness of each connection the import depends on: whether TrainingPeaks is authenticated and whether PlanMyPeak is authenticated. The presence response SHALL NOT contain any token, API key, or other credential material.

#### Scenario: Extension installed and both connections authenticated

- **WHEN** the page sends a presence request and both TrainingPeaks and PlanMyPeak are authenticated
- **THEN** the response reports the protocol version, the extension version, and both connections as authenticated

#### Scenario: Extension installed but TrainingPeaks not authenticated

- **WHEN** the page sends a presence request and no valid TrainingPeaks token is stored
- **THEN** the response reports TrainingPeaks as not authenticated so the page can prompt the coach to sign in to TrainingPeaks

#### Scenario: Extension not installed

- **WHEN** the page sends a presence request and no extension is installed
- **THEN** no response arrives, and the page treats the absence of a response within its timeout as "extension not available"

#### Scenario: Presence response carries no credentials

- **WHEN** the extension answers any presence request
- **THEN** the response contains no TrainingPeaks token, PlanMyPeak token, or Supabase key

### Requirement: Page can read TrainingPeaks workout libraries and workouts

The extension SHALL serve requests for the coach's TrainingPeaks workout libraries and for the workouts contained in a specified library, returning the same data the extension's own UI reads. When TrainingPeaks is not authenticated, the extension SHALL respond with an authentication-required error rather than empty data.

#### Scenario: Listing workout libraries

- **WHEN** an allowlisted page requests the workout libraries and TrainingPeaks is authenticated
- **THEN** the response contains the coach's libraries, each with its identifier, name, and item count

#### Scenario: Listing the workouts in a library

- **WHEN** an allowlisted page requests the items of a library by its identifier
- **THEN** the response contains the workouts in that library with the fields needed to preview and select them

#### Scenario: Reading data without TrainingPeaks authentication

- **WHEN** an allowlisted page requests libraries and no valid TrainingPeaks token is stored
- **THEN** the response is an authentication-required error, and the page can direct the coach to sign in

#### Scenario: Upstream TrainingPeaks failure

- **WHEN** the TrainingPeaks API returns an error while serving a data request
- **THEN** the response is an error carrying a message the page can display, and no partial or unvalidated data is returned

### Requirement: Page can read TrainingPeaks training plans and their contents

The extension SHALL serve requests for the coach's TrainingPeaks training plans, and for the workouts, notes and events belonging to a specified plan.

#### Scenario: Listing training plans

- **WHEN** an allowlisted page requests the training plans and TrainingPeaks is authenticated
- **THEN** the response contains the coach's training plans with the fields needed to identify and select them

#### Scenario: Reading the contents of a training plan

- **WHEN** an allowlisted page requests the contents of a training plan by its identifier
- **THEN** the response contains that plan's workouts, notes and events

#### Scenario: Requesting a plan that does not exist

- **WHEN** an allowlisted page requests the contents of a plan identifier the coach cannot access
- **THEN** the response is an error and no data from another coach or plan is returned

### Requirement: Credentials never cross into the page

The extension SHALL NOT include any TrainingPeaks token, PlanMyPeak token, Supabase key, or Intervals.icu API key in any response sent to the page, in any control-channel message, or in any overlay-to-page message.

#### Scenario: Data response contains no credentials

- **WHEN** the extension responds to any data or presence request
- **THEN** the response body contains no credential material of any kind

#### Scenario: Error response contains no credentials

- **WHEN** the extension responds with an error caused by an authentication failure
- **THEN** the error message describes the failure without echoing the token or key involved

### Requirement: Page can request the import experience

The extension SHALL support a request that opens the import experience, optionally pre-selecting a library or training plan the page names. The request SHALL be acknowledged with whether the import experience was opened, and SHALL be rejected when the requesting origin is not allowlisted.

#### Scenario: Opening the import experience

- **WHEN** an allowlisted page requests the import experience
- **THEN** the extension opens it on that page and responds that it was opened

#### Scenario: Opening the import experience pre-selected to a library

- **WHEN** an allowlisted page requests the import experience naming a library identifier
- **THEN** the import experience opens with that library already selected

#### Scenario: Import experience already open

- **WHEN** an allowlisted page requests the import experience while it is already open
- **THEN** the extension focuses the existing import experience rather than opening a second one

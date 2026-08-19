## ADDED Requirements

### Requirement: Raw athlete-groups response is retained

The system SHALL retain the raw JSON response returned by the TrainingPeaks athlete-groups endpoint (`GET /coaches/v2/coaches/{coachId}/tags`) and make it available to the popup alongside the validated `AthleteGroup[]`. The raw response is the single source payload that generates the entire athlete group screen.

#### Scenario: Raw response carried on successful fetch

- **WHEN** the background worker successfully fetches and validates the athlete-groups response
- **THEN** the successful `ApiResponse` returned to the popup SHALL include the raw parsed JSON (the exact array TrainingPeaks returned) in addition to the validated `AthleteGroup[]`

#### Scenario: Raw response absent on failure

- **WHEN** the athlete-groups fetch fails (HTTP error or validation error)
- **THEN** the response SHALL follow the existing error shape and the popup SHALL NOT display a source-JSON affordance for that failed load

#### Scenario: Existing callers are unaffected

- **WHEN** other TrainingPeaks fetches (user, libraries, plans, etc.) run through the shared request wrapper
- **THEN** their behavior and return shape SHALL remain unchanged (the raw payload is additive and optional)

### Requirement: View source JSON affordance on the group screen

The athlete group screen SHALL present a single, clearly labeled "View source JSON" icon button in its header area (near the group/athlete count and the Import control) whenever a raw response is available.

#### Scenario: Icon shown when data is loaded

- **WHEN** the athlete group screen has successfully loaded groups and a raw response is available
- **THEN** a source-JSON icon button SHALL be visible in the header, with an accessible label describing that it opens the source JSON

#### Scenario: Icon hidden without data

- **WHEN** the screen is loading, in an error state, or has no raw response
- **THEN** the source-JSON icon button SHALL NOT be shown

#### Scenario: Opening the viewer

- **WHEN** the user activates the source-JSON icon button
- **THEN** the source JSON viewer modal SHALL open showing the raw response

### Requirement: Source JSON viewer modal

The system SHALL provide a modal that displays the complete raw TrainingPeaks athlete-groups response, pretty-printed, and lets the user copy or download it and close the modal. The modal SHALL reuse the shared modal shell pattern used elsewhere in the popup.

#### Scenario: Pretty-printed payload displayed

- **WHEN** the source JSON viewer modal is open
- **THEN** it SHALL render the full raw response as pretty-printed (indented) JSON in a scrollable region, showing all groups from the single source array

#### Scenario: Copy to clipboard

- **WHEN** the user activates the modal's copy action
- **THEN** the full raw JSON string SHALL be written to the clipboard and the user SHALL receive visible confirmation

#### Scenario: Download JSON

- **WHEN** the user activates the modal's download action
- **THEN** the system SHALL download the raw response as a `.json` file using the existing JSON download utility

#### Scenario: Closing the modal

- **WHEN** the user activates the close control, clicks the backdrop, or presses Escape
- **THEN** the modal SHALL close and return focus to the group screen

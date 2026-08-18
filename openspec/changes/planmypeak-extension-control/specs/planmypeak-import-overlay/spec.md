## Purpose

Defines the in-page import experience the extension renders on PlanMyPeak pages: how the coach browses the TrainingPeaks libraries, workouts and training plans the extension exposes, selects what to bring across, triggers the import into PlanMyPeak, and sees the outcome — all without leaving the portal.

## ADDED Requirements

### Requirement: Overlay renders only on PlanMyPeak pages and only on request

The extension SHALL render the import overlay only on pages whose origin is in the PlanMyPeak origin allowlist, and only after the page has requested it or the coach has invoked it from the extension. The overlay SHALL NOT appear unprompted on page load.

#### Scenario: Overlay opens on request from an allowlisted page

- **WHEN** an allowlisted PlanMyPeak page requests the import experience
- **THEN** the overlay is mounted on that page and becomes visible

#### Scenario: Overlay does not auto-open

- **WHEN** an allowlisted PlanMyPeak page loads and makes no request
- **THEN** no overlay is visible and the page renders unchanged

#### Scenario: Overlay is dismissible

- **WHEN** the coach closes the overlay via its close control or the Escape key
- **THEN** the overlay is removed from view and the underlying page is left interactive and unmodified

### Requirement: Overlay does not disturb the host page

The overlay SHALL be visually and stylistically isolated from the PlanMyPeak page: its styles SHALL NOT apply to host-page elements, host-page styles SHALL NOT alter the overlay, and removing the overlay SHALL leave the host page's layout, scroll position and interactivity as they were.

#### Scenario: Style isolation

- **WHEN** the overlay is mounted on a PlanMyPeak page
- **THEN** the host page's existing elements keep their original appearance and layout

#### Scenario: Clean teardown

- **WHEN** the coach closes the overlay
- **THEN** no overlay markup, styles, or scroll locks remain on the host page

### Requirement: Overlay presents TrainingPeaks libraries, workouts and training plans

The overlay SHALL display the coach's TrainingPeaks workout libraries and training plans, and SHALL allow drilling into a library to see its workouts and into a training plan to see its scheduled contents. Loading, empty and error states SHALL each be represented distinctly.

#### Scenario: Browsing libraries

- **WHEN** the overlay opens and TrainingPeaks data is available
- **THEN** it lists the coach's workout libraries with their names and workout counts

#### Scenario: Drilling into a library

- **WHEN** the coach opens a library
- **THEN** the overlay lists that library's workouts with enough detail to identify them

#### Scenario: Browsing training plans

- **WHEN** the coach switches to training plans
- **THEN** the overlay lists the coach's training plans, and opening one shows its workouts, notes and events

#### Scenario: Library with no workouts

- **WHEN** the coach opens a library that contains no workouts
- **THEN** the overlay shows an empty state rather than an error or a blank panel

#### Scenario: Data fails to load

- **WHEN** a request for TrainingPeaks data fails
- **THEN** the overlay shows an error message with a retry action, and no partial data is presented as complete

### Requirement: Overlay blocks import when a required connection is missing

The overlay SHALL check that TrainingPeaks and PlanMyPeak are both authenticated before allowing an import, and SHALL explain which connection is missing and how to restore it rather than failing at upload time.

#### Scenario: TrainingPeaks not authenticated

- **WHEN** the overlay opens and no valid TrainingPeaks token is stored
- **THEN** the overlay explains that TrainingPeaks sign-in is required, offers a way to open TrainingPeaks and re-check, and disables the import action

#### Scenario: PlanMyPeak not authenticated

- **WHEN** the overlay opens and PlanMyPeak is not authenticated
- **THEN** the overlay explains that PlanMyPeak sign-in is required and disables the import action

#### Scenario: Both connections ready

- **WHEN** both TrainingPeaks and PlanMyPeak are authenticated
- **THEN** the import action is enabled once a selection has been made

### Requirement: Coach selects what to import

The overlay SHALL let the coach choose which libraries, workouts or training plans to import, SHALL show what the current selection covers before the import runs, and SHALL keep the import action disabled while the selection is empty.

#### Scenario: Selecting a whole library

- **WHEN** the coach selects a library
- **THEN** the overlay shows how many workouts will be imported from it

#### Scenario: Selecting individual workouts

- **WHEN** the coach selects individual workouts inside a library
- **THEN** only those workouts are counted in the summary and included in the import

#### Scenario: Empty selection

- **WHEN** nothing is selected
- **THEN** the import action is disabled

#### Scenario: Unsupported workout types in the selection

- **WHEN** the selection contains workouts whose type PlanMyPeak does not support
- **THEN** the overlay warns which workouts will be skipped before the import starts

### Requirement: Coach triggers the import into PlanMyPeak

The overlay SHALL import the selected content into PlanMyPeak using the same transformation and upload behavior as the extension's existing PlanMyPeak export, so that content imported from the overlay is indistinguishable from content imported from the extension popup.

#### Scenario: Importing a library

- **WHEN** the coach triggers an import of a selected library
- **THEN** the workouts are transformed and uploaded into the corresponding PlanMyPeak workout library

#### Scenario: Importing a training plan

- **WHEN** the coach triggers an import of a selected training plan
- **THEN** the plan and its workouts, notes and events are created in PlanMyPeak

#### Scenario: Parity with the popup import

- **WHEN** the same library is imported from the overlay and from the extension popup
- **THEN** the resulting PlanMyPeak content is equivalent

### Requirement: Duplicate destination containers are resolved before upload

Before uploading, the overlay SHALL check whether a PlanMyPeak library or plan with the target name already exists, and when one does SHALL pause and require the coach to choose `Replace`, `Append`, or `Ignore Upload`, matching the existing preflight behavior of the extension's export dialog.

#### Scenario: Target name is free

- **WHEN** no PlanMyPeak container matches the target name
- **THEN** the import proceeds without prompting

#### Scenario: Duplicate found

- **WHEN** a PlanMyPeak container already uses the target name
- **THEN** the import pauses and the coach is offered `Replace`, `Append`, and `Ignore Upload`

#### Scenario: Coach chooses Replace

- **WHEN** the coach chooses `Replace`
- **THEN** the existing container is removed and recreated before the selected content is uploaded

#### Scenario: Coach chooses Append

- **WHEN** the coach chooses `Append`
- **THEN** the selected content is uploaded into the existing container

#### Scenario: Coach chooses Ignore Upload

- **WHEN** the coach chooses `Ignore Upload`
- **THEN** nothing is uploaded and the overlay returns to the selection state

### Requirement: Import progress and outcome are reported

The overlay SHALL show progress while an import runs and SHALL report the outcome when it finishes, including how many items succeeded and how many failed with the reason for each failure. A partial failure SHALL NOT be reported as a success.

#### Scenario: Progress during import

- **WHEN** an import is running
- **THEN** the overlay shows which phase is in progress and how many items have been processed out of the total

#### Scenario: Successful import

- **WHEN** every selected item imports successfully
- **THEN** the overlay reports success with the number of items imported and the destination container

#### Scenario: Partial failure

- **WHEN** some items fail to import
- **THEN** the overlay reports the successful count and lists each failed item with its reason

#### Scenario: Import cannot start

- **WHEN** the import fails before any item is uploaded
- **THEN** the overlay reports the failure and leaves the selection intact so the coach can retry

### Requirement: Import outcome is communicated to the PlanMyPeak page

When an import that the page requested completes, the extension SHALL notify the requesting page of the outcome — success or failure, and the number of items imported — so the page can refresh its own view. The notification SHALL contain no credential material.

#### Scenario: Page is notified of a completed import

- **WHEN** an import requested by an allowlisted page finishes
- **THEN** that page receives a completion message reporting the outcome and the number of items imported

#### Scenario: Page is notified of a failed import

- **WHEN** an import requested by an allowlisted page fails
- **THEN** that page receives a completion message reporting the failure without credential material

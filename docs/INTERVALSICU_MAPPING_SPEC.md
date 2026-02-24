# Intervals.icu Mapping Specification (TrainingPeaks -> Intervals.icu)

Status: Draft for review (spec only, no code changes)

Date: 2026-02-24

Owner: Intervals.icu integration redesign (Issue #75)

## 1. Purpose

Define a strict, testable mapping from TrainingPeaks workout data to Intervals.icu workout library templates.

This spec covers:

- confirmed TrainingPeaks type ID table (project source-of-truth for TP type taxonomy)
- Intervals.icu target type table (exact API strings)
- field-by-field transformation rules
- structured-workout conversion decision tree (`zwo` vs `workout_doc` vs description fallback)

This spec is intentionally conservative:

- It prefers officially documented Intervals.icu API behavior
- It treats opaque `workout_doc` JSON as an advanced mode
- It treats native textual workout syntax in `description` as a first-class path because Intervals.icu uses a text workout editor in the UI

## 2. Sources of Truth

### 2.1 Intervals.icu API (authoritative)

- OpenAPI docs endpoint: `https://intervals.icu/api/v1/docs`
- `/api/v1/athlete/{id}/workouts` description explicitly states it accepts:
  - native Intervals.icu workout format in `description`
  - `zwo`, `mrc`, `erg`, `fit` via `file_contents` / `file_contents_base64`
- `WorkoutEx` is the POST schema for `/workouts`
- `WorkoutEx.workout_doc` is present but schema is opaque (`object`)
- `WorkoutEx.type` is a free string in the schema, so canonical values must come from the sport enum (`SportInfo.type`)

### 2.2 Intervals.icu forum guidance (supporting)

- API cookbook confirms `/athlete/0` is valid for current-athlete lookup and gives examples for workout creation
- Planned workouts thread and UI examples reinforce that Intervals.icu uses textual workout definitions in the editor

### 2.3 TrainingPeaks type IDs in this project (project source-of-truth)

Confirmed local mapping exists in `src/popup/components/CalendarDayCell.tsx` for TrainingPeaks `workoutTypeValueId`:

- `1=Swim`, `2=Bike`, `3=Run`, `9/29=Strength`, `11=XC-Ski`, `12=Rowing`, `13=Walk`, etc.

Important note:

- `LibraryItem.workoutTypeId` and `PlanWorkout.workoutTypeValueId` are assumed to share the same TP taxonomy for this spec.
- This must be validated once with real `LibraryItem` payload samples and then locked in tests.

## 3. Confirmed TrainingPeaks Type ID Table (Project TP Taxonomy)

Source: `src/popup/components/CalendarDayCell.tsx`

This table is the plugin's current TP type taxonomy reference and should be used as the source-of-truth for mapping logic unless real `LibraryItem` payloads prove otherwise.

| TP Type ID | TrainingPeaks Label (project) | Confirmation Source        |
| ---------- | ----------------------------- | -------------------------- |
| 1          | Swim                          | `CalendarDayCell` icon map |
| 2          | Bike                          | `CalendarDayCell` icon map |
| 3          | Run                           | `CalendarDayCell` icon map |
| 4          | Brick                         | `CalendarDayCell` icon map |
| 5          | Crosstrain                    | `CalendarDayCell` icon map |
| 6          | Race                          | `CalendarDayCell` icon map |
| 7          | Day Off                       | `CalendarDayCell` icon map |
| 8          | Mountain Bike                 | `CalendarDayCell` icon map |
| 9          | Strength                      | `CalendarDayCell` icon map |
| 10         | Custom                        | `CalendarDayCell` icon map |
| 11         | XC-Ski                        | `CalendarDayCell` icon map |
| 12         | Rowing                        | `CalendarDayCell` icon map |
| 13         | Walk                          | `CalendarDayCell` icon map |
| 29         | Strength (duplicate)          | `CalendarDayCell` icon map |
| 100        | Other                         | `CalendarDayCell` icon map |

Validation gate before code rollout:

- Capture and store redacted `LibraryItem` examples for at least bike/run/swim/strength/walk (or row/ski) and confirm `workoutTypeId` matches this table.

## 4. Intervals.icu Type Table (Canonical API Strings)

Source: OpenAPI `SportInfo.type` enum (`/api/v1/docs`)

The integration only needs a subset today, but mapping must use exact enum strings.

### 4.1 Core types used by this integration

| Intervals Type   | Use                                                          |
| ---------------- | ------------------------------------------------------------ |
| `Ride`           | Road/general cycling workouts                                |
| `Run`            | Running workouts                                             |
| `Swim`           | Pool/open-water workouts when generic swim mapping is needed |
| `WeightTraining` | Strength/weights templates                                   |
| `Walk`           | Walking workouts                                             |
| `Rowing`         | Rowing workouts                                              |
| `NordicSki`      | XC ski / nordic ski                                          |
| `Other`          | Safe fallback for unsupported/unknown TP types               |

### 4.2 Additional valid types (not required for MVP but valid)

Examples from enum include `MountainBikeRide`, `TrailRun`, `OpenWaterSwim`, `GravelRide`, `VirtualRide`, `VirtualRun`, `Workout`, etc.

Policy:

- Start with stable generic types above.
- Do not overfit TP IDs to specialized Intervals types without explicit user value and tests.

## 5. TP -> Intervals Sport Type Mapping (Strict Rules)

This mapping replaces the current incorrect hardcoded table in:

- `src/background/api/intervalsicu.ts`
- `src/utils/constants.ts`

### 5.1 Mapping table

| TP Type ID | TP Label       | Intervals Type   | Rule Type         | Notes                                                         |
| ---------- | -------------- | ---------------- | ----------------- | ------------------------------------------------------------- |
| 1          | Swim           | `Swim`           | direct            | Fixes current run/swim inversion                              |
| 2          | Bike           | `Ride`           | direct            | Generic cycling                                               |
| 3          | Run            | `Run`            | direct            | Fixes current run/swim inversion                              |
| 4          | Brick          | `Other`          | fallback-specific | Multi-sport brick not represented as one library workout type |
| 5          | Crosstrain     | `Other`          | fallback-specific | Generic crosstrain                                            |
| 6          | Race           | `Other`          | fallback-specific | Event concept, not template sport                             |
| 7          | Day Off        | `Other` or skip  | policy-based      | Prefer skip in batch exports if user enables "skip rest days" |
| 8          | Mountain Bike  | `Ride`           | normalized        | Could later upgrade to `MountainBikeRide`                     |
| 9          | Strength       | `WeightTraining` | direct            | Strength template                                             |
| 10         | Custom         | `Other`          | fallback-specific | Unknown custom                                                |
| 11         | XC-Ski         | `NordicSki`      | normalized        | Exact enum available                                          |
| 12         | Rowing         | `Rowing`         | direct            | Exact enum available                                          |
| 13         | Walk           | `Walk`           | direct            | Current code incorrectly maps 13 to strength                  |
| 29         | Strength (dup) | `WeightTraining` | direct            | Duplicate strength code                                       |
| 100        | Other          | `Other`          | direct            | Explicit other                                                |
| unknown    | Unknown        | `Other`          | default           | Never default to `Ride`                                       |

### 5.2 Non-negotiable mapping policies

- Unknown TP type IDs must map to `Other`, not `Ride`.
- `13` must map to `Walk`, not `WeightTraining`.
- Strength must include both `9` and `29`.
- Run/Swim must not be inverted.

## 6. Field-by-Field Transformation Rules (LibraryItem -> WorkoutEx)

Target endpoint: `POST /api/v1/athlete/{id}/workouts`

Target request schema: `WorkoutEx` (OpenAPI)

### 6.1 Required/primary output fields

| TrainingPeaks Source                    | Intervals Field | Rule                                                                                                                    |
| --------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `itemName`                              | `name`          | Trim whitespace; fallback to `"Untitled Workout {exerciseLibraryItemId}"` if empty                                      |
| `workoutTypeId`                         | `type`          | Use TP->Intervals mapping table in Section 5                                                                            |
| (constant)                              | `category`      | Not in current `WorkoutEx` OpenAPI schema, but safe to include if API accepts; otherwise omit for `/workouts` templates |
| export context (folder creation result) | `folder_id`     | Include only when folder creation succeeded and user selected folder organization                                       |

Note:

- `/workouts` OpenAPI schema does not require `category`; templates are already "workouts". Keep this optional in implementation to avoid schema mismatch risk.

### 6.2 Duration/load/intensity fields

| TrainingPeaks Source               | Intervals Field     | Transform                                     | Validation Rule                                   |
| ---------------------------------- | ------------------- | --------------------------------------------- | ------------------------------------------------- |
| `totalTimePlanned` (decimal hours) | `moving_time`       | `round(hours * 3600)`                         | Include only if > 0                               |
| `tssPlanned`                       | `icu_training_load` | direct numeric copy                           | Include only if > 0                               |
| `ifPlanned`                        | `icu_intensity`     | optional direct copy (future)                 | Only include when confirmed desired for templates |
| `distancePlanned`                  | `distance`          | defer native mapping unless unit is confirmed | Do not map natively yet (unit ambiguity)          |

Rationale:

- `moving_time` and `icu_training_load` are already high confidence.
- `distancePlanned` unit in TP data is not consistently documented in current code/tests, so native `distance` mapping is deferred until unit is confirmed.

### 6.3 Description and notes (text-first strategy)

Intervals.icu uses a textual workout editor in the UI. Therefore:

- The integration must always produce a readable textual workout body.
- Structured payload modes (`zwo` / `workout_doc`) do not eliminate the need for human-readable notes.

Define description content as:

1. Workout script (Intervals text syntax) when generated
2. Blank line
3. Notes section (TP description + coach comments)
4. Blank line
5. Metadata footer (IF, distance, elevation, calories, pace, TP IDs)

#### 6.3.1 Notes section assembly

| TrainingPeaks Source | Description Output Rule                          |
| -------------------- | ------------------------------------------------ |
| `description`        | Primary notes paragraph                          |
| `coachComments`      | Append under `Coach Notes:` heading if non-empty |

#### 6.3.2 Metadata footer (always safe, textual)

Include only non-null values:

- `TP Library Item ID: {exerciseLibraryItemId}`
- `TP Library ID: {exerciseLibraryId}`
- `IF: {ifPlanned.toFixed(2)}`
- `Duration: {moving_time}s` (optional if no script generated)
- `Distance (TP raw): {distancePlanned}`
- `Elevation Gain: {elevationGainPlanned} m`
- `Calories: {caloriesPlanned}`
- `Velocity/Pace (TP raw): {velocityPlanned}`
- `Energy (TP raw): {energyPlanned}`

Policy:

- Mark ambiguous unit fields as `TP raw` until units are confirmed.

### 6.4 Fields intentionally not mapped natively (current spec)

| TrainingPeaks Source                   | Status      | Reason                                                        |
| -------------------------------------- | ----------- | ------------------------------------------------------------- |
| `structure`                            | conditional | Mapped via decision tree (Section 7), not direct scalar field |
| `exerciseLibraryItemType`              | ignore      | No Intervals equivalent for template semantics                |
| `distancePlanned` -> `distance`        | deferred    | TP unit ambiguity                                             |
| `velocityPlanned` -> pace/speed fields | deferred    | Unit and sport semantics ambiguous                            |
| `energyPlanned` -> `joules`            | deferred    | Unit mismatch risk (kJ/calories ambiguity)                    |
| `caloriesPlanned` -> `joules`          | deferred    | Not equivalent                                                |
| `elevationGainPlanned` -> native field | deferred    | Workout template `WorkoutEx` is not activity result data      |

### 6.5 Fields available in WorkoutEx but not used by default

These should remain opt-in until product behavior is specified:

- `indoor`
- `color`
- `tags`
- `sub_type`
- `target` / `targets` (`AUTO`, `POWER`, `HR`, `PACE`)
- `carbs_per_hour`
- `hide_from_athlete`
- `time`

## 7. Structured Workout Conversion Decision Tree (zwo vs workout_doc vs description fallback)

This section defines how to choose the payload mode when TP workout structure is present.

### 7.1 Inputs to the decision

- sport type (`workoutTypeId` -> Intervals type)
- TP structure presence (`LibraryItem.structure`)
- TP structure complexity (repeats, nested blocks, target types)
- converter availability (ZWO generator, `workout_doc` serializer)
- parser compatibility confidence

### 7.2 Decision tree (strict)

```text
START
  |
  |-- Is structured data present? (LibraryItem.structure for classic TP workout)
  |      |
  |      |-- NO --> Description fallback mode (notes + metadata only)
  |      |
  |      `-- YES
  |            |
  |            |-- Sport maps to Ride or Run?
  |            |      |
  |            |      |-- YES
  |            |      |     |
  |            |      |     |-- Can convert TP structure to ZWO losslessly enough?
  |            |      |     |      |
  |            |      |     |      |-- YES --> ZWO mode (filename + file_contents_base64)
  |            |      |     |      |
  |            |      |     |      `-- NO
  |            |      |     |             |
  |            |      |     |             |-- Can serialize supported subset to workout_doc safely?
  |            |      |     |             |      |
  |            |      |     |             |      |-- YES --> workout_doc mode
  |            |      |     |             |      |
  |            |      |     |             |      `-- NO --> Description fallback mode (generate text script if possible)
  |            |      |
  |            |      `-- NO
  |            |            |
  |            |            |-- Sport = Swim? --> Description fallback mode (structured text, no parser/workout_doc by default)
  |            |            |
  |            |            |-- Sport = WeightTraining? --> Description fallback mode (RxBuilder/strength summary text)
  |            |            |
  |            |            `-- Other sports --> Description fallback mode
  |
  `-- (Future) RxBuilder structured strength source available?
         |
         `-- Use description fallback mode first; add dedicated strength serializer only after format is confirmed
```

### 7.3 Mode definitions

#### Mode A: ZWO mode (preferred for structured endurance when supported)

Use when:

- Sport is `Ride` or `Run` (if run support is verified for the chosen parser path)
- TP structure uses constructs we can convert reliably
- Converter supports targets and repeats needed by the workout

Payload strategy:

- `name`
- `type`
- `folder_id` (optional)
- `filename` (e.g., `tp_{exerciseLibraryItemId}.zwo`)
- `file_contents_base64`
- `description` (notes + metadata, and optionally a human-readable script preview)

Why preferred:

- Intervals officially documents file parsing support
- Avoids relying on opaque `workout_doc` schema

#### Mode B: `workout_doc` mode (advanced, subset-only)

Use when:

- ZWO conversion is unavailable/inadequate
- The workout uses a simple subset we can serialize and test
- We have fixture-backed tests proving Intervals accepts the generated `workout_doc`

Payload strategy:

- `name`
- `type`
- `folder_id` (optional)
- `workout_doc` (subset serializer output)
- `description` (notes + metadata)

Restrictions:

- Do not use `workout_doc` as default for all workouts
- Do not emit undocumented fields without fixture-based validation
- Treat `workout_doc` as opaque; only generate fields we explicitly own in tests

#### Mode C: Description fallback mode (text-first, always available)

Use when:

- No TP structure exists
- Structured conversion fails
- Sport is swim/strength/other and parser or `workout_doc` support is not proven

Payload strategy:

- `name`
- `type`
- `folder_id` (optional)
- `description` containing:
  - Intervals-style textual workout script if we can generate one
  - else notes + metadata only
- `moving_time`
- `icu_training_load`

Important:

- This is called "fallback" in the decision tree, but it is not low quality.
- It aligns with Intervals.icu's text-based workout editing UX and preserves editability.

## 8. Classic TP Structure Conversion Rules (for future serializer/converters)

Observed TP classic structure shape (from project tests and transformer code):

- blocks contain `type`, `length`, `steps`
- step entries contain `name`, `intensityClass`, `length`, `targets`
- nested repetition blocks are possible

### 8.1 Convertible subset (MVP for structured conversion)

- step durations in seconds
- repetition counts
- power targets with min/max percentages (`percentOfFtp`)
- warmup / active / rest / cooldown step classes

### 8.2 Non-MVP / fallback triggers

Trigger description fallback mode when any of the following is present and unsupported:

- unsupported target types (HR/pace combinations not implemented)
- unsupported length units
- deeply nested/complex structures not covered by converter tests
- swim-specific constructs we cannot map safely

## 9. RxBuilder Strength Mapping Rules (spec-first)

Issue #75 requires strength support. Current Intervals export path uses `LibraryItem[]`, while RxBuilder uses a different schema (`RxBuilderWorkout`).

### 9.1 Strength target type

- Intervals type: `WeightTraining`

### 9.2 Initial strength transformation (required baseline)

When exporting RxBuilder workouts (future path):

- `name` <- `title`
- `type` <- `WeightTraining`
- `moving_time` <- `prescribedDurationInSeconds` (if present)
- `description` <- assembled text containing:
  - instructions
  - sequence summary (order + exercise names)
  - total blocks / sets / prescriptions
  - compliance metrics if relevant

### 9.3 Strength structure serialization policy

- Do not emit `workout_doc` for RxBuilder until a tested Intervals-compatible strength structure format is confirmed.
- Use text-first fallback mode as the default.

## 10. Required Tests Before Implementation Is Accepted

### 10.1 Sport mapping unit tests

Cover all TP IDs in Section 5.1, especially:

- `1 -> Swim`
- `3 -> Run`
- `9 -> WeightTraining`
- `13 -> Walk`
- `29 -> WeightTraining`
- unknown -> `Other`

### 10.2 Field mapping unit tests

- `moving_time` hours->seconds conversion
- `icu_training_load` copy
- null/zero omission behavior
- description assembly (notes + coach + metadata)
- no fallback to `Ride` for unknown types

### 10.3 Structured conversion decision tests

Test decision outcomes, not just payloads:

- ride with simple structure -> `zwo` mode (if converter exists)
- unsupported structured bike/run -> `workout_doc` or description fallback per capability flags
- swim structured -> description fallback
- strength -> description fallback
- no structure -> description fallback

### 10.4 One-time TP library parity validation test/data fixture

Add redacted fixtures from real `LibraryItem` API payloads to prove `workoutTypeId` uses the same TP taxonomy as the plan UI mapping.

## 11. Implementation Notes (Non-code)

- Move sport mapping into a dedicated module (`sportTypeMapper.ts`) with exhaustive tests.
- Remove duplicate `WORKOUT_TYPE_MAP` definitions (`src/background/api/intervalsicu.ts` and `src/utils/constants.ts`).
- Keep the API client focused on request orchestration; mapping and mode selection should live in transformer/mapping modules.

## 12. References

Project code:

- `src/background/api/intervalsicu.ts`
- `src/utils/constants.ts`
- `src/popup/components/CalendarDayCell.tsx`
- `src/schemas/library.schema.ts`
- `src/schemas/rxBuilder.schema.ts`

Intervals.icu:

- API docs page: `https://intervals.icu/api-docs.html`
- OpenAPI spec: `https://intervals.icu/api/v1/docs`
- API cookbook: `https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090`
- Planned workouts discussion: `https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624`

Issue tracking:

- Issue #75: `https://github.com/eduardoarantes/cycling_coach_browser_plugin/issues/75`
- Issue #75 wiki (implementation plan): raw wiki page
- Issue #75 wiki (redesign plan): raw wiki page

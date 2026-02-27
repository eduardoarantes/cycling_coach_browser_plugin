# PlanMyPeak Schema and TP Mapping (SQL-Derived + API/PR-Extended)

## Source Used

PlanMyPeak workout examples were derived from:

- `/Users/eduardo/Documents/projects/cycling-ai-management/web/supabase/migrations/20260223000004_migrate_workout_library_data.sql`

Schema compatibility was additionally extended based on:

- `PlanMyPeak/workouts-openapi.yaml` (local API doc in this plugin repo)
- `athlete_ai_analysis` PR `#337` (multi-sport workout schema/type support)

The migration contains a long set of SQL inserts for public PlanMyPeak workouts. The key field used here is `structure` (`jsonb`).

## What We Observed in Real PlanMyPeak `structure` Data

From the SQL migration examples (118 workouts):

- `primaryIntensityMetric`: `percentOfFtp`
- `primaryLengthMetric`: `duration`
- Segment `type`: `step`, `repetition`
- Length units used in structure: `second`, `repetition`
- Step `intensityClass`: `active`, `warmUp`, `coolDown`, `rest`, `recovery`
- Target `type`: `power`, `cadence`
- Target `unit`: `percentOfFtp`, `rpm`
- `openDuration`: always `null`

Practical implication:

- The current PlanMyPeak workout library schema is cycling-oriented and duration-based
- Distance-based TP structures (meters/km) are not a safe direct mapping to the observed PlanMyPeak schema

## PlanMyPeak Workout Schema (Current Export Contract)

Updated in:

- `src/types/planMyPeak.types.ts`
- `src/schemas/planMyPeak.schema.ts`

### Structure rules (exporter support in this plugin)

- `primaryIntensityMetric` supports:
  - `percentOfFtp`
  - `heartRate` (used for TP HR workouts: `%MaxHr`, `%ThresholdHr`)
  - `percentOfThresholdPace` (used for TP run/swim threshold pace workouts)
  - `pace`
  - `speed` (schema-compatible; TP mapping not yet exercised with samples)
  - `watts` / `resistance` (schema-compatible; TP mapping for strength pending)
- `primaryLengthMetric` supports `duration` and `distance`
- Blocks are `step` or `repetition`
- Step lengths support time and distance units (`second`, `minute`, `hour`, `meter`, `kilometer`, `mile`)
- Repetition lengths use `repetition`
- Targets support:
  - `power` / `percentOfFtp`
  - `power` / `watts` (schema/API-compatible)
  - `heartRate` / `percentOfMaxHr`
  - `heartRate` / `percentOfThresholdHr`
  - `heartRate` / `bpm` (schema-compatible; TP mapper currently focuses on %HR and `bpm`)
  - `cadence` / `rpm`
  - `cadence` / `roundOrStridePerMinute`
  - `pace` (with explicit pace units, or no unit for TP `%ThresholdPace` targets)
  - `speed` (`kilometersPerHour`, `milesPerHour`) when present

### Metadata enums (aligned to observed SQL + current API usage)

- Workout `type` now supports cycling + running + swimming + strength categories (exporter currently maps cycling/running/swimming from TP)
- Workout `intensity`: `easy`, `moderate`, `hard`, `very_hard`
- `suitable_phases`: `Foundation`, `Base`, `Build`, `Peak`, `Recovery`, `Taper`

## TP -> PlanMyPeak Mapping (Current)

Implementation files:

- `src/export/adapters/planMyPeak/workoutMapping.ts`
- `src/export/adapters/planMyPeak/transformer.ts`
- `src/export/adapters/planMyPeak/PlanMyPeakAdapter.ts`

### 1. Supported TP sport types

PlanMyPeak export currently supports cycling, running, and swimming workouts.

Supported `TrainingPeaks workoutTypeId`:

- `1` -> Swim
- `2` -> Ride
- `3` -> Run
- `8` -> Mountain Bike (treated as cycling)

Skipped:

- Strength and other unsupported TP types (pending examples/mapping)

Skipped workouts are not exported and are surfaced as warnings in the PlanMyPeak export result.

### 2. TP structure compatibility checks

The transformer skips TP workouts when the structure is incompatible with the supported PlanMyPeak schema path, including:

- unsupported `primaryLengthMetric` (currently supports `duration`, `distance`)
- unsupported `primaryIntensityMetric` (currently supports TP `percentOfFtp`, `percentOfMaxHr`, `percentOfThresholdHr`, `percentOfThresholdPace`)
- unsupported step length units (for example unsupported/custom units not in `second|minute|hour|meter|kilometer|mile|repetition`)
- unsupported/missing step targets after mapping

Reason:

- We prefer a safe skip + warning over silently producing an incorrect PlanMyPeak structure.

### 3. TP target mapping

TP targets often omit an explicit unit for the primary target. The mapping uses TP structure context:

- target with no unit + TP `primaryIntensityMetric = percentOfFtp`
  - -> PlanMyPeak `power` target (`percentOfFtp`)
- target with no unit + TP `primaryIntensityMetric = percentOfMaxHr`
  - -> PlanMyPeak `heartRate` target (`percentOfMaxHr`)
- target with no unit + TP `primaryIntensityMetric = percentOfThresholdHr`
  - -> PlanMyPeak `heartRate` target (`percentOfThresholdHr`)
- target with no unit + TP `primaryIntensityMetric = percentOfThresholdPace`
  - -> PlanMyPeak `pace` target (unit omitted; values are % threshold pace)
- target with no unit + TP `primaryIntensityMetric = pace`
  - -> PlanMyPeak `pace` target (unit omitted)
- target with `unit = roundOrStridePerMinute` (or `rpm`)
  - -> PlanMyPeak `cadence` target (`roundOrStridePerMinute` or `rpm`)
- target with `unit = bpm` / `beatsPerMinute`
  - -> PlanMyPeak `heartRate` target (`bpm`)
- target with pace units (`secondsPerKilometer`, `secondsPerMile`, etc.)
  - -> PlanMyPeak `pace` target with the same unit

Target value normalization:

- If only `minValue` is provided, `maxValue` is set to the same value
- If only `maxValue` is provided, `minValue` is set to the same value

This matches the single-value target style seen in many TP workouts and prevents invalid `maxValue: 0` outputs.

### 4. TP step intensity mapping

TP step intensity classes are normalized to the PlanMyPeak set:

- `active` -> `active`
- `warmUp` -> `warmUp`
- `coolDown` -> `coolDown`
- `rest` -> `rest`
- `recovery` -> `recovery`

Fallback mapping by step name (when TP intensity is inconsistent/missing):

- names containing `warm` -> `warmUp`
- names containing `cool` -> `coolDown`
- names containing `recover` -> `recovery`
- names containing `rest` / `easy` -> `rest`
- otherwise -> `active`

### 5. TP workout metadata inference

PlanMyPeak workout metadata is inferred from TP `IF` / `TSS` + workout content:

- `WorkoutType` inferred from `IF` (includes `sweet_spot`)
- `IntensityLevel` inferred from `IF` (no `very_easy`; low IF maps to `easy`)
- `suitable_phases` inferred from workout type (includes `Foundation`/`Taper` where appropriate)

## Current Limitations (Intentional)

These are intentionally skipped for now:

- TP `rpe`-based structures
- TP strength workouts (until TP strength examples + mapping rules are validated)
- TP workouts missing/invalid `structure`

These can be added later when PlanMyPeak support is expanded and validated with real examples.

## Why This Approach

The previous TP -> PlanMyPeak mapping was too permissive and could silently mistranslate workouts (especially targets and distance-based structures).

The updated approach is:

- stricter schema
- explicit TP mapping rules
- safe skipping with warnings

This is better for correctness while PlanMyPeak multi-sport export support is rolling out incrementally.

## OpenAPI Alignment Update (Issue #326)

After the PlanMyPeak OpenAPI update (`PlanMyPeak/workouts-openapi.yaml`) and backend multi-sport work in PR `#337`, the plugin exporter aligns with:

- `WorkoutStructure.primaryIntensityMetric`: `heartRate`
- `StepTarget.type`: backend PR uses `heartrate` (plugin internal transformer uses `heartRate` and normalizes on API upload)
- `StepTarget.unit`: `percentOfMaxHr`, `percentOfThresholdHr`
- Run/swim pace-oriented structures (`percentOfThresholdPace`, `distance` lengths)

This enables TP cycling HR workouts and TP run/swim pace workouts to be exported via the PlanMyPeak API without converting them to power targets.

## Current Coverage Snapshot (Sample TP Files)

Using the TP sample files in `TP_API_Responses/`, expected exporter coverage is now approximately:

- Cycling samples: fully supported except `rpe`
- Running samples: mostly supported except `rpe`
- Swimming samples: mostly supported except `rpe` and malformed/missing structures
- Mixed training-plan sample `training_plans_workouts_624432.json`: all but the `rpe` workout

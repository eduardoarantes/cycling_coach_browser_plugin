# Intervals.icu DSL Mapping (With Examples)

Status: Draft (schema + mapping examples)

Date: 2026-02-24

Related schema definitions:

- `src/schemas/intervalsicuDsl.schema.ts`
- `src/schemas/intervalsicu.schema.ts`

## 1. Purpose

This document defines how we map workout concepts into the richer Intervals.icu text/workout-builder model introduced in:

- `IntervalsWorkoutBuilderDocumentSchema` (normalized workout AST)
- `IntertoolsPlanGuideDocumentSchema` (normalized multi-week plan guide AST)

This is provider-specific to Intervals.icu.

Other export providers must define their own mapping rules and schemas.

## 2. Scope

This document covers:

- normalized schema object shapes (AST-style)
- mapping rules from TrainingPeaks-style workout structures to Intervals AST
- rendering expectations for Intervals textual workout syntax in `description`
- cadence / RPM support
- Intertools weekly plan guide examples

This document does not define:

- a raw text parser implementation (Intervals text -> AST)
- a final TP parser for every edge case
- `zwo` generation rules

## 3. Terminology

- `Intervals text`: the workout syntax written in the Intervals.icu workout editor
- `AST`: normalized object form validated by Zod in `src/schemas/intervalsicuDsl.schema.ts`
- `Section`: a logical block of workout lines (optionally repeated)
- `Target`: intensity/cadence/pace/HR/zone goal for a step

## 4. Mapping Layers

We use three layers for Intervals export:

1. Source workout model (e.g. TrainingPeaks `structure`)
2. Intervals normalized AST (`IntervalsWorkoutBuilderDocumentSchema`)
3. Intervals text in `description`

This separation allows:

- provider-specific expressiveness (RPM, ramps, prompts)
- validation before rendering
- future parser/round-trip support

## 5. Core Mapping Rules (TP-like Structure -> Intervals AST)

## 5.1 Step duration mapping

| TP-like length                    | Intervals AST `duration`                             | Example |
| --------------------------------- | ---------------------------------------------------- | ------- |
| `{ unit: 'second', value: 90 }`   | `{ kind: 'time', value: 90, unit: 'seconds' }`       | `90s`   |
| `{ unit: 'minute', value: 3 }`    | `{ kind: 'time', value: 3, unit: 'minutes' }`        | `3m`    |
| `{ unit: 'hour', value: 1 }`      | `{ kind: 'time', value: 1, unit: 'hours' }`          | `1h`    |
| `{ unit: 'meter', value: 400 }`   | `{ kind: 'distance', value: 400, unit: 'meters' }`   | `400m`  |
| `{ unit: 'kilometer', value: 5 }` | `{ kind: 'distance', value: 5, unit: 'kilometers' }` | `5km`   |

Notes:

- Normalize source unit aliases before validation.
- `press_lap` is supported in the schema as `{ kind: 'press_lap' }` for manual transitions.

## 5.2 Intensity/tag mapping

| TP-like `intensityClass` | Intervals AST `intensityTag` | Render suffix        |
| ------------------------ | ---------------------------- | -------------------- |
| `warmUp`                 | `warmup`                     | `intensity=warmup`   |
| `active`                 | `active` or omitted          | usually omitted      |
| `rest`                   | `rest`                       | `intensity=rest`     |
| `coolDown`               | `cooldown`                   | `intensity=cooldown` |

Policy:

- `active` is allowed in AST but may be omitted in text rendering to reduce noise.

## 5.3 Repetition block mapping

| TP-like block                                                  | Intervals AST             | Render |
| -------------------------------------------------------------- | ------------------------- | ------ |
| `type: 'repetition', length: { unit: 'repetition', value: 3 }` | `section.repeatCount = 3` | `3x`   |

## 5.4 Step label mapping

Source step names map to AST `label` and render inline:

- TP-like: `name: "Hard"` + `3 min` + `75-85%`
- Intervals text: `- Hard 3m 75-85%`

## 5.5 Target mapping

### Power

| Source meaning | AST target                             | Example    |
| -------------- | -------------------------------------- | ---------- |
| % FTP          | `{ kind: 'power_percent_ftp', value }` | `75-85%`   |
| watts          | `{ kind: 'power_watts', value }`       | `220-260w` |

### Pace

| Source meaning   | AST target                                          | Example              |
| ---------------- | --------------------------------------------------- | -------------------- |
| % threshold pace | `{ kind: 'pace_percent_threshold', value }`         | `90-95% Pace`        |
| absolute pace    | `{ kind: 'pace_absolute', value, denominatorUnit }` | `7:15-7:00 Pace /mi` |

Important:

- Absolute pace ranges are not ordered numerically in the schema because faster pace is a smaller time value.

### Heart rate

| Source meaning | AST target                           |
| -------------- | ------------------------------------ |
| % max HR       | `{ kind: 'hr_percent_max', value }`  |
| % LTHR         | `{ kind: 'hr_percent_lthr', value }` |

### Zone

| Source meaning | AST target                                           |
| -------------- | ---------------------------------------------------- |
| Power zone     | `{ kind: 'zone', zone: 'Z2', metric: 'power' }`      |
| HR zone        | `{ kind: 'zone', zone: 'Z2', metric: 'heart_rate' }` |
| Pace zone      | `{ kind: 'zone', zone: 'Z2', metric: 'pace' }`       |

### Cadence / RPM (new support)

| Source meaning | AST target                                              | Example      |
| -------------- | ------------------------------------------------------- | ------------ |
| exact cadence  | `{ kind: 'cadence_rpm', value: 85 }`                    | `85 rpm`     |
| cadence range  | `{ kind: 'cadence_rpm', value: { min: 90, max: 100 } }` | `90-100 rpm` |

## 5.6 Ramp mapping

If a source step is a ramp (or equivalent progression), map:

- `targetMode: 'ramp'`

Otherwise:

- `targetMode: 'steady'`

## 5.7 Timed prompts mapping

Intervals supports timed prompts during a step.

AST shape:

- `{ offsetSeconds, message, priority }`

Example:

- `33^ Settle in<!>` (render syntax may vary by parser/renderer implementation)

## 6. Rendering Rules (Intervals AST -> Intervals Text)

Canonical line shape for steps:

```text
- {Label?} {Duration} {Target(s)} {intensity=tag?}
```

Section rendering:

- repeated section starts with `{repeatCount}x`
- blank line between top-level sections
- blank line around repeated blocks when they are adjacent to warmup/cooldown sections

Examples:

```text
- 20m 40-50% intensity=warmup

3x
- Hard 3m 75-85% 90-100 rpm
- Easy 1m 50-60% 85 rpm intensity=rest

- 10m 40-50% intensity=cooldown
```

## 7. Example 1: Bike Workout (Power + Cadence RPM)

## 7.1 Source (TP-like structure concept)

```json
{
  "structure": [
    {
      "type": "step",
      "steps": [
        {
          "name": "Warm up",
          "intensityClass": "warmUp",
          "length": { "unit": "minute", "value": 20 },
          "targets": [{ "minValue": 40, "maxValue": 50 }]
        }
      ]
    },
    {
      "type": "repetition",
      "length": { "unit": "repetition", "value": 3 },
      "steps": [
        {
          "name": "Hard",
          "intensityClass": "active",
          "length": { "unit": "minute", "value": 3 },
          "targets": [{ "minValue": 75, "maxValue": 85 }],
          "cadence": { "minRpm": 90, "maxRpm": 100 }
        },
        {
          "name": "Easy",
          "intensityClass": "rest",
          "length": { "unit": "minute", "value": 1 },
          "targets": [{ "minValue": 50, "maxValue": 60 }],
          "cadence": { "rpm": 85 }
        }
      ]
    }
  ],
  "primaryIntensityMetric": "percentOfFtp"
}
```

## 7.2 Normalized Intervals AST

Validated by `IntervalsWorkoutBuilderDocumentSchema`.

```json
{
  "source": "intervals_workout_builder_text",
  "sportHint": "Ride",
  "sections": [
    {
      "kind": "section",
      "items": [
        {
          "kind": "step",
          "duration": { "kind": "time", "value": 20, "unit": "minutes" },
          "targets": [
            { "kind": "power_percent_ftp", "value": { "min": 40, "max": 50 } }
          ],
          "intensityTag": "warmup"
        }
      ]
    },
    {
      "kind": "section",
      "repeatCount": 3,
      "items": [
        {
          "kind": "step",
          "label": "Hard",
          "duration": { "kind": "time", "value": 3, "unit": "minutes" },
          "targets": [
            { "kind": "power_percent_ftp", "value": { "min": 75, "max": 85 } },
            { "kind": "cadence_rpm", "value": { "min": 90, "max": 100 } }
          ]
        },
        {
          "kind": "step",
          "label": "Easy",
          "duration": { "kind": "time", "value": 1, "unit": "minutes" },
          "targets": [
            { "kind": "power_percent_ftp", "value": { "min": 50, "max": 60 } },
            { "kind": "cadence_rpm", "value": 85 }
          ],
          "intensityTag": "rest"
        }
      ]
    }
  ]
}
```

## 7.3 Rendered Intervals Text (description)

```text
- 20m 40-50% intensity=warmup

3x
- Hard 3m 75-85% 90-100 rpm
- Easy 1m 50-60% 85 rpm intensity=rest
```

## 8. Example 2: Run Tempo With Absolute Pace + Ramp + Prompt

## 8.1 Normalized Intervals AST

```json
{
  "source": "intervals_workout_builder_text",
  "sportHint": "Run",
  "sections": [
    {
      "kind": "section",
      "heading": "Main Set",
      "items": [
        {
          "kind": "step",
          "label": "Tempo",
          "duration": { "kind": "time", "value": 10, "unit": "minutes" },
          "targetMode": "ramp",
          "targets": [
            {
              "kind": "pace_absolute",
              "value": { "min": 7.25, "max": 7.0 },
              "denominatorUnit": "mi"
            },
            {
              "kind": "cadence_rpm",
              "value": { "min": 88, "max": 94 }
            }
          ],
          "prompts": [
            {
              "offsetSeconds": 33,
              "message": "Settle in",
              "priority": "alert"
            }
          ]
        }
      ]
    }
  ]
}
```

## 8.2 Rendered Intervals Text (illustrative)

```text
Main Set
- Tempo 10m ramp 7:15-7:00 Pace /mi 88-94 rpm
33^ Settle in<!>
```

Notes:

- Exact prompt rendering syntax is parser/renderer-specific.
- The schema preserves prompt semantics even if the renderer format evolves.

## 9. Example 3: Swim (Distance + % Threshold Pace)

## 9.1 Normalized Intervals AST

```json
{
  "source": "intervals_workout_builder_text",
  "sportHint": "Swim",
  "sections": [
    {
      "kind": "section",
      "items": [
        {
          "kind": "step",
          "duration": { "kind": "distance", "value": 600, "unit": "meters" },
          "targets": [
            {
              "kind": "pace_percent_threshold",
              "value": { "min": 70, "max": 80 }
            }
          ],
          "intensityTag": "warmup"
        }
      ]
    },
    {
      "kind": "section",
      "repeatCount": 4,
      "items": [
        {
          "kind": "step",
          "duration": { "kind": "distance", "value": 100, "unit": "meters" },
          "targets": [
            {
              "kind": "pace_percent_threshold",
              "value": { "min": 95, "max": 105 }
            }
          ]
        },
        {
          "kind": "step",
          "duration": { "kind": "time", "value": 10, "unit": "seconds" },
          "targets": [{ "kind": "free_text", "text": "0% Pace" }],
          "intensityTag": "rest"
        }
      ]
    }
  ]
}
```

## 9.2 Rendered Intervals Text (illustrative)

```text
- 600m 70-80% Pace intensity=warmup

4x
- 100m 95-105% Pace
- 10s 0% Pace intensity=rest
```

## 10. Example 4: Unsupported Syntax Fallback

When a source concept cannot yet be represented structurally, preserve it without blocking export:

1. Keep the main step in structured form when possible
2. Add unsupported fragments as `free_text` target or `text` line
3. Preserve the raw source text in `rawLine` for debugging/round-trip support

Example AST fragment:

```json
{
  "kind": "step",
  "label": "Drills",
  "duration": { "kind": "time", "value": 5, "unit": "minutes" },
  "targets": [{ "kind": "free_text", "text": "choice of drills" }],
  "rawLine": "Warm up 5 min with drills"
}
```

## 11. Intertools Plan Guide Mapping (Multi-Week Plan)

The Intertools thread shows a compact week/day planning syntax with criteria like:

- `z5:120:90:95`

We model that as a normalized weekly guide document.

## 11.1 Raw token semantics (conceptual)

```text
zone : load : time : intensity
z5   : 120  : 90   : 95
```

## 11.2 Normalized Intertools AST day

```json
{
  "kind": "workout",
  "zone": "z5",
  "load": { "kind": "exact", "value": 120 },
  "duration": { "kind": "exact", "value": 90 },
  "intensity": { "kind": "exact", "value": 95 },
  "notes": "Equivalent to z5:120:90:95"
}
```

## 11.3 Full 1-week example (7 days required)

Validated by `IntertoolsPlanGuideDocumentSchema`.

```json
{
  "source": "intertools_multi_week_plan_guide",
  "weeks": [
    {
      "weekIndex": 1,
      "days": [
        {
          "kind": "workout",
          "zone": "z2",
          "load": { "kind": "exact", "value": 60 },
          "duration": { "kind": "exact", "value": 45 },
          "intensity": { "kind": "exact", "value": 70 }
        },
        { "kind": "rest" },
        {
          "kind": "workout",
          "zone": "z5",
          "load": { "kind": "exact", "value": 120 },
          "duration": { "kind": "exact", "value": 90 },
          "intensity": { "kind": "exact", "value": 95 }
        },
        {
          "kind": "workout",
          "zone": "z3",
          "load": { "kind": "gte", "value": 70 },
          "duration": { "kind": "range", "min": 40, "max": 60 },
          "intensity": { "kind": "min" }
        },
        { "kind": "rest", "label": "Recovery" },
        {
          "kind": "workout",
          "zone": "z1",
          "load": { "kind": "any" },
          "duration": { "kind": "max" },
          "intensity": { "kind": "lte", "value": 60 }
        },
        {
          "kind": "workout",
          "zone": "z4",
          "load": { "kind": "range", "min": 80, "max": 100 },
          "duration": { "kind": "exact", "value": 50 },
          "intensity": { "kind": "exact", "value": 90 }
        }
      ]
    }
  ]
}
```

## 12. Validation Examples (Zod)

## 12.1 Workout-builder AST with RPM

```ts
import { IntervalsWorkoutBuilderDocumentSchema } from '@/schemas/intervalsicuDsl.schema';

const parsed = IntervalsWorkoutBuilderDocumentSchema.parse(doc);
```

## 12.2 Intertools plan guide

```ts
import { IntertoolsPlanGuideDocumentSchema } from '@/schemas/intervalsicuDsl.schema';

const guide = IntertoolsPlanGuideDocumentSchema.parse(planGuideDoc);
```

## 13. Implementation Guidance (Next Steps)

Recommended sequence:

1. Implement Intervals text parser -> `IntervalsWorkoutBuilderDocumentSchema`
2. Implement AST renderer (stable formatting rules)
3. Add TP structure -> AST mapper (provider-specific)
4. Extend TP mapping to cadence/RPM when source fields are confirmed
5. Add snapshot tests for AST + rendered text pairs

## 14. Sources

- Intervals workout builder thread: `https://forum.intervals.icu/t/workout-builder/1163`
- Intertools multi-week plan creator thread: `https://forum.intervals.icu/t/multi-week-training-plan-creator-intertools/52495`
- Intervals DSL schemas in this repo: `src/schemas/intervalsicuDsl.schema.ts`
- Related Intervals export mapping spec: `docs/INTERVALSICU_MAPPING_SPEC.md`

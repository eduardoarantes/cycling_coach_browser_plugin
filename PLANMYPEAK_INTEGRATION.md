# PlanMyPeak Integration Guide

This document explains how to export TrainingPeaks workouts to PlanMyPeak format using the export adapter.

## Overview

The PlanMyPeak export adapter transforms TrainingPeaks workout data into the PlanMyPeak JSON format, enabling seamless migration of workout libraries between platforms.

### Key Features

- ✅ **Automatic transformation** of TrainingPeaks structured workouts
- ✅ **Type-safe** with TypeScript and Zod validation
- ✅ **Configurable** workout types, intensity, and training phases
- ✅ **Validation** with detailed error and warning messages
- ✅ **Export** to JSON files for manual upload
- ✅ **Mock API** for testing (real API integration ready)

---

## Data Structure Mapping

### TrainingPeaks → PlanMyPeak

| TrainingPeaks Field     | PlanMyPeak Field       | Transformation                           |
| ----------------------- | ---------------------- | ---------------------------------------- |
| `exerciseLibraryItemId` | `id`                   | Converted to base-36 string              |
| `itemName`              | `name`                 | Direct copy                              |
| `description`           | `detailed_description` | Merged with `coachComments` when present |
| `tssPlanned`            | `base_tss`             | Direct copy                              |
| `totalTimePlanned`      | `base_duration_min`    | Converted from hours to minutes          |
| `ifPlanned`             | `type`, `intensity`    | Inferred from IF value                   |
| `structure`             | `structure`            | Transformed (see below)                  |

### Structure Transformation

**Removed from TrainingPeaks:**

- `polyline` array (visualization data)
- `begin` and `end` timestamps on structure blocks

**Added to PlanMyPeak:**

- `type` field on targets (`"power"`)
- `unit` field on targets (`"percentOfFtp"`)
- Top-level metadata: `suitable_phases`, `signature`, `source_file`

**Example:**

```typescript
// TrainingPeaks target
{
  "minValue": 40,
  "maxValue": 50
}

// PlanMyPeak target
{
  "type": "power",
  "minValue": 40,
  "maxValue": 50,
  "unit": "percentOfFtp"
}
```

---

## Usage

### Basic Export

```typescript
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import type { LibraryItem } from '@/types';

async function exportWorkouts(tpWorkouts: LibraryItem[]) {
  // 1. Transform
  const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {});

  // 2. Validate
  const validation = await planMyPeakAdapter.validate(pmpWorkouts);
  if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  // 3. Export to JSON file
  const result = await planMyPeakAdapter.export(pmpWorkouts, {
    fileName: 'my_workouts',
  });

  // 4. Download
  if (result.success && result.fileUrl) {
    const link = document.createElement('a');
    link.href = result.fileUrl;
    link.download = result.fileName;
    link.click();
  }
}
```

### With Configuration

```typescript
const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {
  // Custom defaults for workout classification
  defaultWorkoutType: 'tempo',
  defaultIntensity: 'moderate',
  defaultSuitablePhases: ['Base', 'Build'],

  // Export options
  fileName: 'my_custom_export',
  includeMetadata: true,
});
```

---

## Configuration Options

### `PlanMyPeakExportConfig`

```typescript
interface PlanMyPeakExportConfig {
  /** Output file name (without extension) */
  fileName?: string;

  /** Whether to include metadata in export */
  includeMetadata?: boolean;

  /** Default workout type if not specified */
  defaultWorkoutType?: WorkoutType;

  /** Default intensity if not specified */
  defaultIntensity?: IntensityLevel;

  /** Default suitable phases */
  defaultSuitablePhases?: TrainingPhase[];
}
```

### Workout Type Inference

If not specified in config, workout types are inferred from Intensity Factor (IF):

| IF Range | Workout Type |
| -------- | ------------ |
| ≥ 1.05   | `vo2max`     |
| ≥ 0.95   | `threshold`  |
| ≥ 0.85   | `tempo`      |
| ≥ 0.70   | `endurance`  |
| < 0.70   | `recovery`   |

### Intensity Level Inference

| IF Range | Intensity Level |
| -------- | --------------- |
| ≥ 1.05   | `very_hard`     |
| ≥ 0.95   | `hard`          |
| ≥ 0.85   | `moderate`      |
| ≥ 0.70   | `easy`          |
| < 0.70   | `very_easy`     |

### Training Phases

Suitable training phases are inferred from workout type:

| Workout Type          | Suitable Phases |
| --------------------- | --------------- |
| `vo2max`, `anaerobic` | Build, Peak     |
| `threshold`           | Build, Peak     |
| `tempo`               | Base, Build     |
| `endurance`           | Base, Build     |
| `recovery`            | Recovery        |

---

## Validation

The adapter performs comprehensive validation:

### Required Fields

- `name` - Must not be empty
- `structure` - Must contain at least one block
- `base_duration_min` - Should be > 0
- `base_tss` - Should be ≥ 0

### Schema Validation

All fields are validated against Zod schemas to ensure type safety:

```typescript
const validation = await planMyPeakAdapter.validate(workouts);

if (!validation.isValid) {
  console.error('Errors:', validation.errors);
  // [{
  //   field: 'workouts[0].name',
  //   message: 'Workout name is required',
  //   severity: 'error'
  // }]
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
  // [{
  //   field: 'workouts[0].base_tss',
  //   message: 'TSS should not be negative',
  //   severity: 'warning'
  // }]
}
```

---

## Current Integration Surface

The active PlanMyPeak integration now lives in the background API client:

- `src/background/api/planMyPeak.ts`
- `tests/unit/background/api/planMyPeak.test.ts`

That code path is what the popup and export flows actually use.

---

## Site-Control Channel (PlanMyPeak → Extension)

The PlanMyPeak web app can drive the extension directly: detect that it is
installed, read the coach's TrainingPeaks libraries, workouts and training
plans through it, and open the import overlay on the page.

### Transport

The page posts a message on its own window; a content script
(`src/content/siteControlBridge.ts`), injected only on PlanMyPeak origins,
validates it and relays it to the background worker. Responses come back the
same way. The web app needs no knowledge of the extension ID.

### Rules the channel enforces

- **Origin.** Only origins in `PLANMYPEAK_CONTROL_ORIGINS` are served —
  `https://portal.planmypeak.com` in production, plus the local dev origins in
  local-target builds. Checked in the content script _and_ re-checked in the
  background against `sender.origin`, which the page cannot forge.
- **Silence for everyone else.** A non-allowlisted origin gets _no response at
  all_, not an error. Treat "no response within your timeout" as "extension not
  available" — this is the supported way to feature-detect.
- **Top-level only.** An allowlisted portal embedded as a frame inside another
  site is not treated as a control surface.
- **Closed request list.** The page names _site-control_ request types, never
  internal `RuntimeMessage` types. Anything outside the list below is refused.
- **No credentials, ever.** No response, notification, or error message
  contains a TrainingPeaks token, PlanMyPeak token, Supabase key, or
  Intervals.icu API key.

### Envelope

Page → extension:

```ts
{
  source: 'planmypeak-site-control',
  version: 1,               // PLANMYPEAK_SITE_CONTROL_VERSION
  requestId: string,        // your id, echoed back verbatim
  type: SiteControlRequestType,
  payload: object,          // may be omitted for no-argument requests
}
```

Extension → page:

```ts
{ source: 'planmypeak-extension', version: 1, requestId, ok: true,  data }
{ source: 'planmypeak-extension', version: 1, requestId, ok: false, error: { code, message } }
```

Error codes: `INVALID_REQUEST`, `UNSUPPORTED_REQUEST_TYPE`,
`UNSUPPORTED_VERSION`, `AUTH_REQUIRED`, `API_ERROR`, `INTERNAL_ERROR`.
`AUTH_REQUIRED` means the coach is not signed in to TrainingPeaks — prompt them
rather than retrying.

### Request types

| Type                 | Payload                                   | `data` on success                                                                                        |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `PING`               | —                                         | `{ protocolVersion, extensionVersion, trainingPeaks: { authenticated }, planMyPeak: { authenticated } }` |
| `GET_LIBRARIES`      | —                                         | `Library[]`                                                                                              |
| `GET_LIBRARY_ITEMS`  | `{ libraryId: number }`                   | `LibraryItem[]`                                                                                          |
| `GET_TRAINING_PLANS` | —                                         | `TrainingPlan[]`                                                                                         |
| `GET_PLAN_CONTENTS`  | `{ planId: number }`                      | `{ planId, workouts, notes, events, rxWorkouts }`                                                        |
| `OPEN_IMPORTER`      | `{ libraryId?: number, planId?: number }` | `{ opened: boolean, focused: boolean }`                                                                  |

`GET_PLAN_CONTENTS` fetches all four legs of a plan in one round trip and fails
as a whole if any leg fails, so a partially-loaded plan never renders as a
complete one. `OPEN_IMPORTER` focuses an already-open overlay rather than
mounting a second one (`focused: true`).

### Import completion notification

When an import started from an `OPEN_IMPORTER` request finishes, the extension
posts an unsolicited event carrying counts only:

```ts
{
  source: 'planmypeak-extension',
  version: 1,
  type: 'IMPORT_COMPLETED',
  requestId,                                  // the OPEN_IMPORTER request id
  payload: { ok: boolean, importedCount: number, failedCount: number },
}
```

Use it to refresh the portal's own view of the coach's libraries.

### Page-side helper

```js
const SITE_CONTROL_VERSION = 1;

function callExtension(type, payload = {}, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();

    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      // No response means the extension is not installed, or this origin is
      // not allowlisted. Both are "not available".
      resolve(null);
    }, timeoutMs);

    function onMessage(event) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'planmypeak-extension') return;
      if (data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(data);
    }

    window.addEventListener('message', onMessage);
    window.postMessage(
      {
        source: 'planmypeak-site-control',
        version: SITE_CONTROL_VERSION,
        requestId,
        type,
        payload,
      },
      window.location.origin
    );
  });
}

// Feature-detect before showing an "Import from TrainingPeaks" affordance.
const ping = await callExtension('PING');
const available = ping?.ok === true;
const canImport = available && ping.data.trainingPeaks.authenticated;

// Open the importer, optionally pre-selecting a library.
if (available) {
  await callExtension('OPEN_IMPORTER', { libraryId: 1234 }, 8000);
}

// Listen for the result.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (
    data?.source === 'planmypeak-extension' &&
    data.type === 'IMPORT_COMPLETED'
  ) {
    refreshLibraries(data.payload);
  }
});
```

### The import overlay

`OPEN_IMPORTER` mounts a React overlay into a shadow root on the PlanMyPeak
page (`src/content/overlay/`). It is loaded with a dynamic `import()`, so pages
that never open it do not pay for React or the export machinery. Imports run
through the same PlanMyPeak adapter, duplicate preflight
(`Replace` / `Append` / `Ignore Upload`) and progress reporting as the popup, so
overlay imports and popup imports produce equivalent PlanMyPeak content.

---

## Real API Integration (Future)

When PlanMyPeak expands its API surface, extend `src/background/api/planMyPeak.ts`:

```typescript
// TODO: Replace with real API implementation
export async function uploadWorkout(
  workout: PlanMyPeakWorkout
): Promise<UploadWorkoutResponse> {
  const response = await fetch('https://api.planmypeak.com/workouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(workout),
  });

  return await response.json();
}
```

---

## Testing

Comprehensive unit tests are provided:

```bash
# Run PlanMyPeak adapter tests
npm run test:unit tests/unit/export/adapters/planMyPeak

# Run with coverage
npm run coverage
```

### Test Coverage

- ✅ Transformation logic (workout types, intensity, phases)
- ✅ Structure transformation (remove polyline, add target types)
- ✅ Duration and TSS calculations
- ✅ Validation (schema, business rules)
- ✅ Export functionality (JSON file generation)
- ✅ End-to-end workflow (transform → validate → export)

---

## Example Workouts

See `workout_examples/` directory for sample workouts:

- `tp_30sx4m_interval_repeats.json` - TrainingPeaks format
- `workout_library_30sx4m_interval_repeats.json` - PlanMyPeak format

These examples show the exact data structure transformations.

---

## Architecture

### Adapter Pattern

The PlanMyPeak adapter implements the `ExportAdapter` interface:

```typescript
interface ExportAdapter<TConfig, TOutput> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly supportedFormats: string[];

  transform(items: LibraryItem[], config: TConfig): Promise<TOutput>;
  validate(output: TOutput): Promise<ValidationResult>;
  export(output: TOutput, config: TConfig): Promise<ExportResult>;
}
```

This allows for easy addition of new export destinations (Zwift, Garmin, TrainerRoad, etc.) without modifying core logic.

### Files

```
src/export/adapters/planMyPeak/
├── PlanMyPeakAdapter.ts    # Main adapter implementation
├── transformer.ts          # Transformation logic
├── example.ts              # Usage examples
└── index.ts                # Public exports
```

---

## Troubleshooting

### Validation Errors

**Problem**: "Workout name is required"
**Solution**: Ensure all workouts have non-empty `itemName` in TrainingPeaks data

**Problem**: "Workout must have at least one structure block"
**Solution**: Check that `structure.structure` array is not empty

### Type Errors

**Problem**: TypeScript errors when importing
**Solution**: Ensure `@/types/planMyPeak.types` is imported correctly

### Export Issues

**Problem**: File download not working
**Solution**: Ensure you're calling this in a browser context with DOM access

---

## Future Enhancements

- [ ] Direct upload to PlanMyPeak API (when available)
- [ ] Batch processing with progress tracking
- [ ] Custom mapping rules for workout types
- [ ] Support for additional metadata fields
- [ ] Export presets (save configurations)
- [ ] Export history tracking

---

## Related Documentation

- [Issue #51: Export Libraries & Workouts](https://github.com/eduardoarantes/cycling_coach_browser_plugin/issues/51)
- [CLAUDE.md](./CLAUDE.md) - Project development guide
- [TESTING.md](./TESTING.md) - Testing guide

---

**Questions?** See `tests/unit/background/api/planMyPeak.test.ts`

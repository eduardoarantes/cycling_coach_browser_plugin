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

## Mock API Service

For testing purposes, a mock PlanMyPeak API service is provided:

```typescript
import {
  uploadWorkout,
  uploadWorkoutBatch,
  checkApiHealth,
} from '@/services/planMyPeakApiService';

// Upload single workout
const result = await uploadWorkout(pmpWorkout, {
  delay: 500, // Simulate network delay (ms)
  successRate: 1.0, // 100% success rate
  verbose: true, // Detailed logging
});

// Batch upload
const batchResult = await uploadWorkoutBatch(pmpWorkouts, {
  delay: 100,
  successRate: 0.95, // 95% success rate
});

console.log(`Uploaded: ${batchResult.uploaded}`);
console.log(`Failed: ${batchResult.failed}`);
```

### Mock Configuration

```typescript
interface MockConfig {
  /** Simulate network delay (ms) */
  delay?: number;

  /** Simulate success rate (0-1) */
  successRate?: number;

  /** Enable detailed logging */
  verbose?: boolean;
}
```

---

## Real API Integration (Future)

When PlanMyPeak provides real API endpoints, replace the mock service in `src/services/planMyPeakApiService.ts`:

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

**Questions?** See the example usage in `src/export/adapters/planMyPeak/example.ts`

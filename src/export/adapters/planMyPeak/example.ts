/**
 * Example: Using the PlanMyPeak Export Adapter
 *
 * This file demonstrates how to use the PlanMyPeak adapter to transform
 * TrainingPeaks workouts to PlanMyPeak format.
 */

import type { LibraryItem } from '@/types';
import { planMyPeakAdapter } from './PlanMyPeakAdapter';
import {
  uploadWorkoutBatch,
  exportToJsonFile,
  downloadFile,
} from '@/services/planMyPeakApiService';

/**
 * Example 1: Transform a single workout
 */
export async function exampleTransformSingle(): Promise<void> {
  // Sample TrainingPeaks workout
  const tpWorkout: LibraryItem = {
    exerciseLibraryId: 2550514,
    exerciseLibraryItemId: 12684302,
    exerciseLibraryItemType: 'WorkoutTemplate',
    itemName: '30 s x 4m interval repeats',
    workoutTypeId: 2,
    distancePlanned: null,
    totalTimePlanned: 1.1083333333333334,
    caloriesPlanned: null,
    tssPlanned: 51.7,
    ifPlanned: 0.68,
    velocityPlanned: null,
    energyPlanned: null,
    elevationGainPlanned: null,
    description: 'Interval workout',
    coachComments: null,
    structure: {
      structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp',
              length: { unit: 'second', value: 300 },
              openDuration: false,
              targets: [{ minValue: 40, maxValue: 50 }],
            },
          ],
          begin: 0,
          end: 300,
        },
      ],
      primaryIntensityMetric: 'percentOfFtp',
      primaryLengthMetric: 'duration',
    },
  };

  // Transform using the adapter
  const workouts = await planMyPeakAdapter.transform([tpWorkout], {
    defaultWorkoutType: 'vo2max',
  });

  console.log('Transformed workout:', workouts[0]);
}

/**
 * Example 2: Transform, validate, and export
 */
export async function exampleFullWorkflow(
  tpWorkouts: LibraryItem[]
): Promise<void> {
  // Step 1: Transform TrainingPeaks workouts to PlanMyPeak format
  const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {
    defaultIntensity: 'hard',
    defaultSuitablePhases: ['Build', 'Peak'],
  });

  console.log(`Transformed ${pmpWorkouts.length} workouts`);

  // Step 2: Validate transformed workouts
  const validation = await planMyPeakAdapter.validate(pmpWorkouts);

  if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:', validation.warnings);
  }

  console.log('✅ All workouts validated successfully');

  // Step 3: Export to JSON file
  const exportResult = await planMyPeakAdapter.export(pmpWorkouts, {
    fileName: 'my_workouts',
  });

  if (exportResult.success) {
    console.log(
      `✅ Export successful: ${exportResult.fileName} (${exportResult.itemsExported} workouts)`
    );
    console.log(`Download URL: ${exportResult.fileUrl}`);

    // Trigger download in browser
    if (exportResult.fileUrl) {
      const link = document.createElement('a');
      link.href = exportResult.fileUrl;
      link.download = exportResult.fileName;
      link.click();
    }
  } else {
    console.error('❌ Export failed:', exportResult.errors);
  }
}

/**
 * Example 3: Upload to PlanMyPeak API (mock)
 */
export async function exampleUploadToApi(
  tpWorkouts: LibraryItem[]
): Promise<void> {
  // Transform workouts
  const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {});

  // Validate
  const validation = await planMyPeakAdapter.validate(pmpWorkouts);
  if (!validation.isValid) {
    throw new Error('Validation failed');
  }

  // Upload to API (mock implementation)
  console.log('Uploading workouts to PlanMyPeak API...');

  const batchResult = await uploadWorkoutBatch(pmpWorkouts, {
    delay: 100,
    successRate: 1.0,
    verbose: true,
  });

  console.log(
    `✅ Upload complete: ${batchResult.uploaded} succeeded, ${batchResult.failed} failed`
  );

  // Show individual results
  batchResult.results.forEach((result) => {
    if (result.success) {
      console.log(`  ✅ ${result.workoutId}: uploaded`);
    } else {
      console.log(`  ❌ ${result.workoutId}: ${result.error}`);
    }
  });
}

/**
 * Example 4: Export to JSON file for manual upload
 */
export async function exampleExportForManualUpload(
  tpWorkouts: LibraryItem[]
): Promise<void> {
  // Transform workouts
  const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {});

  // Validate
  const validation = await planMyPeakAdapter.validate(pmpWorkouts);
  if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  // Export to JSON file
  const blobUrl = exportToJsonFile(pmpWorkouts, 'planmypeak_export.json');

  // Download the file
  downloadFile(blobUrl, 'planmypeak_export.json');

  console.log('✅ Workouts exported to JSON file for manual upload');
}

/**
 * Example 5: Use with configuration options
 */
export async function exampleWithConfig(): Promise<void> {
  const tpWorkouts: LibraryItem[] = [
    /* ... your workouts ... */
  ];

  // Transform with custom configuration
  const pmpWorkouts = await planMyPeakAdapter.transform(tpWorkouts, {
    fileName: 'my_custom_export',
    includeMetadata: true,
    defaultWorkoutType: 'tempo',
    defaultIntensity: 'moderate',
    defaultSuitablePhases: ['Base'],
  });

  // Export with custom file name
  const exportResult = await planMyPeakAdapter.export(pmpWorkouts, {
    fileName: 'my_custom_export',
  });

  console.log(`Exported to: ${exportResult.fileName}`);
}

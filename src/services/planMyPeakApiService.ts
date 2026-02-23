/**
 * PlanMyPeak API Service (Mock Implementation)
 *
 * This is a mock implementation of the PlanMyPeak API service.
 * It simulates API calls that would be made to PlanMyPeak when the real API is available.
 *
 * TODO: Replace with real API implementation when PlanMyPeak provides API endpoints
 */

import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import { PlanMyPeakWorkoutSchema } from '@/schemas/planMyPeak.schema';
import { logger } from '@/utils/logger';

/**
 * API response for workout upload
 */
export interface UploadWorkoutResponse {
  success: boolean;
  workoutId?: string;
  message: string;
  errors?: string[];
}

/**
 * API response for batch upload
 */
export interface BatchUploadResponse {
  success: boolean;
  uploaded: number;
  failed: number;
  results: Array<{
    workoutId: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Mock configuration for API behavior
 */
interface MockConfig {
  /** Simulate network delay (ms) */
  delay?: number;
  /** Simulate success rate (0-1) */
  successRate?: number;
  /** Enable detailed logging */
  verbose?: boolean;
}

const DEFAULT_MOCK_CONFIG: MockConfig = {
  delay: 500,
  successRate: 1.0,
  verbose: true,
};

/**
 * Simulate network delay
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock API: Upload a single workout to PlanMyPeak
 *
 * @param workout - PlanMyPeak workout object
 * @param config - Mock configuration
 * @returns Upload response
 */
export async function uploadWorkout(
  workout: PlanMyPeakWorkout,
  config: MockConfig = {}
): Promise<UploadWorkoutResponse> {
  const mockConfig = { ...DEFAULT_MOCK_CONFIG, ...config };

  logger.info(
    `[PlanMyPeakAPI] Uploading workout: ${workout.name} (${workout.id})`
  );

  // Simulate network delay
  if (mockConfig.delay && mockConfig.delay > 0) {
    await delay(mockConfig.delay);
  }

  try {
    // Validate workout format
    PlanMyPeakWorkoutSchema.parse(workout);

    // Simulate random failures based on success rate
    const shouldSucceed = Math.random() < (mockConfig.successRate ?? 1.0);

    if (!shouldSucceed) {
      logger.warn(`[PlanMyPeakAPI] Mock failure for workout: ${workout.name}`);
      return {
        success: false,
        message: 'Mock API simulated failure',
        errors: ['Simulated network error'],
      };
    }

    if (mockConfig.verbose) {
      logger.info(
        `[PlanMyPeakAPI] Successfully uploaded workout: ${workout.name}`
      );
      logger.debug(`[PlanMyPeakAPI] Workout details:`, {
        id: workout.id,
        type: workout.type,
        intensity: workout.intensity,
        duration: workout.base_duration_min,
        tss: workout.base_tss,
      });
    }

    return {
      success: true,
      workoutId: workout.id,
      message: `Workout "${workout.name}" uploaded successfully`,
    };
  } catch (error) {
    logger.error('[PlanMyPeakAPI] Validation error:', error);
    return {
      success: false,
      message: 'Workout validation failed',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Mock API: Upload multiple workouts in batch
 *
 * @param workouts - Array of PlanMyPeak workouts
 * @param config - Mock configuration
 * @returns Batch upload response
 */
export async function uploadWorkoutBatch(
  workouts: PlanMyPeakWorkout[],
  config: MockConfig = {}
): Promise<BatchUploadResponse> {
  const mockConfig = { ...DEFAULT_MOCK_CONFIG, ...config };

  logger.info(`[PlanMyPeakAPI] Uploading batch of ${workouts.length} workouts`);

  const results = await Promise.all(
    workouts.map(async (workout) => {
      const response = await uploadWorkout(workout, {
        ...mockConfig,
        verbose: false, // Reduce logging for batch operations
      });

      return {
        workoutId: workout.id,
        success: response.success,
        error: response.errors?.[0],
      };
    })
  );

  const uploaded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (mockConfig.verbose) {
    logger.info(
      `[PlanMyPeakAPI] Batch upload complete: ${uploaded} succeeded, ${failed} failed`
    );
  }

  return {
    success: failed === 0,
    uploaded,
    failed,
    results,
  };
}

/**
 * Mock API: Check if PlanMyPeak API is available
 *
 * @returns Always returns true for mock implementation
 */
export async function checkApiHealth(): Promise<boolean> {
  logger.info('[PlanMyPeakAPI] Checking API health (mock)');
  await delay(100);
  return true;
}

/**
 * Export workouts to a JSON file for later manual upload
 * This is a fallback when the real API is not available
 *
 * @param workouts - Array of PlanMyPeak workouts
 * @param fileName - Output file name
 * @returns Blob URL for download
 */
export function exportToJsonFile(
  workouts: PlanMyPeakWorkout[],
  fileName = 'planmypeak_export.json'
): string {
  logger.info(`[PlanMyPeakAPI] Exporting ${workouts.length} workouts to JSON`);

  const jsonContent = JSON.stringify(workouts, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  logger.info(`[PlanMyPeakAPI] Export file ready: ${fileName}`);

  return url;
}

/**
 * Trigger a download of the exported file
 *
 * @param blobUrl - Blob URL from exportToJsonFile
 * @param fileName - File name for download
 */
export function downloadFile(blobUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up blob URL after download
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

  logger.info(`[PlanMyPeakAPI] Download triggered: ${fileName}`);
}

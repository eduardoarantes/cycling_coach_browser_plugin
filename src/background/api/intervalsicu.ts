/**
 * Intervals.icu API Client
 *
 * Handles direct upload of TrainingPeaks workouts to Intervals.icu
 * via bulk events API with Basic Authentication
 *
 * API Documentation: https://intervals.icu/api-docs.html
 */

import type { LibraryItem } from '@/schemas/library.schema';
import type {
  IntervalsEventPayload,
  IntervalsEventResponse,
} from '@/types/intervalsicu.types';
import { IntervalsBulkResponseSchema } from '@/schemas/intervalsicu.schema';
import { getIntervalsApiKey } from '@/services/intervalsApiKeyService';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types/api.types';
import {
  generateCurlCommand,
  formatCurlForConsole,
} from '@/utils/curlGenerator';

/**
 * Intervals.icu API base URL
 */
const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

/**
 * Workout type mapping: TrainingPeaks workoutTypeId → Intervals.icu type
 */
const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'Run',
  2: 'Ride',
  3: 'Swim',
  13: 'WeightTraining', // Strength/RxBuilder workouts
  4: 'Other',
} as const;

/**
 * Build comprehensive workout description with all available metadata
 *
 * @param workout - TrainingPeaks library item
 * @returns Formatted description with main text, coach notes, and metadata
 */
function buildDescription(workout: LibraryItem): string {
  const parts: string[] = [];

  // Main description
  if (workout.description) {
    parts.push(workout.description);
  }

  // Coach comments section
  if (workout.coachComments) {
    parts.push(`\n**Coach Notes:**\n${workout.coachComments}`);
  }

  // Additional metadata (not natively supported by bulk API)
  const metadata: string[] = [];
  if (workout.ifPlanned) {
    metadata.push(`IF: ${workout.ifPlanned.toFixed(2)}`);
  }
  if (workout.distancePlanned) {
    metadata.push(`Distance: ${workout.distancePlanned}`);
  }
  if (workout.elevationGainPlanned) {
    metadata.push(`Elevation: ${workout.elevationGainPlanned}m`);
  }
  if (workout.caloriesPlanned) {
    metadata.push(`Calories: ${workout.caloriesPlanned}`);
  }
  if (workout.velocityPlanned) {
    metadata.push(`Pace: ${workout.velocityPlanned}`);
  }

  if (metadata.length > 0) {
    parts.push(`\n**Workout Details:**\n${metadata.join(' • ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Workout from TrainingPeaks';
}

/**
 * Transform TrainingPeaks workout to Intervals.icu event payload
 *
 * @param workout - TrainingPeaks library item
 * @param startDate - Start date in YYYY-MM-DD format
 * @returns Intervals.icu event payload
 */
function transformWorkout(
  workout: LibraryItem,
  startDate: string
): IntervalsEventPayload {
  return {
    category: 'WORKOUT',
    start_date_local: `${startDate}T00:00:00`, // ISO 8601
    type: WORKOUT_TYPE_MAP[workout.workoutTypeId] ?? 'Ride',
    name: workout.itemName,
    description: buildDescription(workout),
    moving_time: workout.totalTimePlanned
      ? Math.round(workout.totalTimePlanned * 3600)
      : undefined,
    icu_training_load: workout.tssPlanned ?? undefined,
    external_id: `tp_${workout.exerciseLibraryItemId}`,
  };
}

/**
 * Export workouts to Intervals.icu via bulk events API
 *
 * Makes a single batch API call to upload one or more workouts.
 * Uses Basic Auth with API_KEY prefix.
 *
 * @param workouts - Array of TrainingPeaks library items to export
 * @param startDates - Array of start dates (YYYY-MM-DD) for each workout
 * @returns API response with created event data or error
 */
export async function exportToIntervals(
  workouts: LibraryItem[],
  startDates: string[]
): Promise<ApiResponse<IntervalsEventResponse[]>> {
  try {
    logger.debug('Exporting workouts to Intervals.icu:', workouts.length);

    // Get API key
    const apiKey = await getIntervalsApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: {
          message: 'Intervals.icu API key not configured',
          code: 'NO_API_KEY',
        },
      };
    }

    // Build payloads
    const payloads = workouts.map((workout, index) =>
      transformWorkout(workout, startDates[index])
    );

    // Prepare request parameters
    const url = `${INTERVALS_API_BASE}/athlete/0/events/bulk?upsert=true`;
    const auth = btoa(`API_KEY:${apiKey}`);
    const requestOptions: {
      method: string;
      headers: Record<string, string>;
      body: string;
    } = {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads, null, 2),
    };

    // Generate and log cURL command for debugging
    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

    // Make API request (Basic Auth with API_KEY:apiKey)
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          error: {
            message: 'Invalid Intervals.icu API key',
            code: 'INVALID_API_KEY',
            status: 401,
          },
        };
      }

      const errorText = await response.text();
      logger.error('Intervals.icu API error:', response.status, errorText);
      return {
        success: false,
        error: {
          message: `Intervals.icu API error: ${response.status}`,
          code: 'API_ERROR',
          status: response.status,
        },
      };
    }

    // Validate response
    const json = await response.json();
    const validated = IntervalsBulkResponseSchema.parse(json);

    logger.info(
      'Successfully exported workouts to Intervals.icu:',
      validated.length
    );
    return { success: true, data: validated };
  } catch (error) {
    logger.error('Failed to export to Intervals.icu:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXPORT_ERROR',
      },
    };
  }
}

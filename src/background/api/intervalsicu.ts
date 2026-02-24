/**
 * Intervals.icu API Client (Redesigned)
 *
 * Creates folders and exports workouts as LIBRARY TEMPLATES (not calendar events).
 * Uses /folders and /workouts endpoints, NOT /events/bulk.
 *
 * API Documentation: https://intervals.icu/api-docs.html
 */

import type { LibraryItem } from '@/schemas/library.schema';
import type {
  IntervalsFolderPayload,
  IntervalsFolderResponse,
  IntervalsWorkoutPayload,
  IntervalsWorkoutResponse,
  IntervalsAthleteResponse,
} from '@/types/intervalsicu.types';
import {
  IntervalsFolderResponseSchema,
  IntervalsWorkoutResponseSchema,
  IntervalsAthleteResponseSchema,
} from '@/schemas/intervalsicu.schema';
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
 * Intervals.icu may accept athlete `0` as "current user" in GET requests, but
 * mutating endpoints (folders/workouts) can require the concrete athlete ID.
 * This extracts a real positive athlete ID from common response shapes.
 */
function extractIntervalsAthleteId(response: unknown): string | number | null {
  const parseAthleteId = (value: unknown): string | number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed === '0') {
        return null;
      }

      // Intervals.icu can return string athlete IDs like "i346347".
      if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
        return trimmed;
      }
    }

    return null;
  };

  if (!response || typeof response !== 'object') {
    return null;
  }

  const record = response as Record<string, unknown>;

  return (
    parseAthleteId(record.id) ??
    parseAthleteId(record.athlete_id) ??
    parseAthleteId(record.athleteId) ??
    (record.athlete && typeof record.athlete === 'object'
      ? parseAthleteId((record.athlete as Record<string, unknown>).id)
      : null)
  );
}

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

  // Additional metadata (not natively supported by workout API)
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
 * Transform TrainingPeaks workout to Intervals.icu workout template payload
 *
 * IMPORTANT: This creates LIBRARY TEMPLATES (not scheduled events).
 * NO start_date_local field is included.
 *
 * @param workout - TrainingPeaks library item
 * @param folderId - Optional folder ID to organize workout
 * @returns Intervals.icu workout payload
 */
function buildWorkoutPayload(
  workout: LibraryItem,
  folderId?: number
): IntervalsWorkoutPayload {
  const payload: IntervalsWorkoutPayload = {
    category: 'WORKOUT',
    type: WORKOUT_TYPE_MAP[workout.workoutTypeId] ?? 'Ride',
    name: workout.itemName,
    description: buildDescription(workout),
  };

  // Add optional fields only if they exist
  if (folderId !== undefined) {
    payload.folder_id = folderId;
  }

  if (workout.totalTimePlanned) {
    payload.moving_time = Math.round(workout.totalTimePlanned * 3600);
  }

  if (workout.tssPlanned) {
    payload.icu_training_load = workout.tssPlanned;
  }

  return payload;
}

/**
 * Get current athlete information from Intervals.icu
 *
 * GET /api/v1/athlete/0
 *
 * @returns API response with athlete data including athlete ID
 */
export async function getCurrentAthlete(): Promise<
  ApiResponse<IntervalsAthleteResponse>
> {
  try {
    logger.debug('Fetching current Intervals.icu athlete');

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

    // Prepare request
    const url = `${INTERVALS_API_BASE}/athlete/0`;
    const auth = btoa(`API_KEY:${apiKey}`);
    const requestOptions: {
      method: string;
      headers: Record<string, string>;
    } = {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    // Generate and log cURL command for debugging
    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

    // Make API request
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
    const resolvedAthleteId = extractIntervalsAthleteId(json);

    if (!resolvedAthleteId) {
      logger.error(
        'Intervals.icu athlete response missing valid athlete ID:',
        json
      );
      return {
        success: false,
        error: {
          message: 'Intervals.icu athlete response missing a valid athlete ID',
          code: 'API_ERROR',
          status: response.status,
        },
      };
    }

    const normalizedJson =
      json && typeof json === 'object'
        ? { ...(json as Record<string, unknown>), id: resolvedAthleteId }
        : { id: resolvedAthleteId };

    const validated = IntervalsAthleteResponseSchema.parse(normalizedJson);

    logger.info('Successfully fetched athlete info, ID:', validated.id);
    return { success: true, data: validated };
  } catch (error) {
    logger.error('Failed to fetch athlete info:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXPORT_ERROR',
      },
    };
  }
}

/**
 * Create a folder on Intervals.icu for library organization
 *
 * POST /api/v1/athlete/{athleteId}/folders
 *
 * @param libraryName - Name of the library/folder to create
 * @param description - Optional description
 * @returns API response with folder metadata or error
 */
export async function createIntervalsFolder(
  libraryName: string,
  description?: string
): Promise<ApiResponse<IntervalsFolderResponse>> {
  try {
    logger.debug('Creating Intervals.icu folder:', libraryName);

    // Get athlete ID first
    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    // Build payload
    const payload: IntervalsFolderPayload = {
      name: libraryName,
    };

    if (description) {
      payload.description = description;
    }

    // Prepare request with real athlete ID
    const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/folders`;
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
      body: JSON.stringify(payload, null, 2),
    };

    // Generate and log cURL command for debugging
    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

    // Make API request
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
    const validated = IntervalsFolderResponseSchema.parse(json);

    logger.info('Successfully created Intervals.icu folder:', validated.id);
    return { success: true, data: validated };
  } catch (error) {
    logger.error('Failed to create Intervals.icu folder:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXPORT_ERROR',
      },
    };
  }
}

/**
 * Export workouts to Intervals.icu as library templates (NOT calendar events)
 *
 * Makes individual POST requests to /api/v1/athlete/{athleteId}/workouts for each workout.
 * Uses Basic Auth with API_KEY prefix.
 *
 * IMPORTANT: This creates LIBRARY TEMPLATES, not scheduled events.
 * NO start_date_local field is included.
 *
 * @param workouts - Array of TrainingPeaks library items to export
 * @param folderId - Optional folder ID to organize workouts
 * @returns API response with created workout data or error
 */
export async function exportWorkoutsToLibrary(
  workouts: LibraryItem[],
  folderId?: number
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  try {
    logger.debug(
      'Exporting workouts to Intervals.icu library:',
      workouts.length
    );

    // Get athlete ID first
    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    const results: IntervalsWorkoutResponse[] = [];
    const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/workouts`;
    const auth = btoa(`API_KEY:${apiKey}`);

    // Process each workout individually
    for (const workout of workouts) {
      try {
        // Build payload
        const payload = buildWorkoutPayload(workout, folderId);

        // Prepare request
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
          body: JSON.stringify(payload, null, 2),
        };

        // Generate and log cURL command for debugging
        const curlCommand = generateCurlCommand(url, requestOptions);
        console.log(formatCurlForConsole(curlCommand));
        logger.debug('Generated cURL command:', curlCommand);

        // Make API request
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
              message: `Failed to export workout "${workout.itemName}": ${response.status}`,
              code: 'API_ERROR',
              status: response.status,
            },
          };
        }

        // Validate response
        const json = await response.json();
        const validated = IntervalsWorkoutResponseSchema.parse(json);
        results.push(validated);

        logger.debug(`Successfully exported workout: ${workout.itemName}`);
      } catch (error) {
        logger.error(`Failed to export workout "${workout.itemName}":`, error);
        return {
          success: false,
          error: {
            message: `Failed to export workout "${workout.itemName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'EXPORT_ERROR',
          },
        };
      }
    }

    logger.info(
      'Successfully exported workouts to Intervals.icu library:',
      results.length
    );
    return { success: true, data: results };
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

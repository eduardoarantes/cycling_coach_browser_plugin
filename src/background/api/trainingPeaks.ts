/**
 * TrainingPeaks API client for background service worker
 *
 * Handles authenticated requests to TrainingPeaks API with Zod validation
 */

import {
  API_BASE_URL,
  RX_API_BASE_URL,
  STORAGE_KEYS,
  PLAN_DATE_RANGE,
  createApiHeaders,
} from '@/utils/constants';
import { logger } from '@/utils/logger';
import { addLog } from '@/services/debugLogService';
import {
  UserApiResponseSchema,
  LibrariesApiResponseSchema,
  LibraryItemsApiResponseSchema,
  TrainingPlansApiResponseSchema,
  PlanWorkoutsApiResponseSchema,
  CalendarNotesApiResponseSchema,
  CalendarEventsApiResponseSchema,
} from '@/schemas';
import { RxBuilderWorkoutsApiResponseSchema } from '@/schemas/rxBuilder.schema';
import type {
  ApiResponse,
  UserProfile,
  Library,
  LibraryItem,
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
  RxBuilderWorkout,
} from '@/types/api.types';
import type { z } from 'zod';

const MAX_VALIDATION_INPUT_LENGTH = 300;

interface ValidationErrorDetails {
  path: string;
  message: string;
  inputPreview: string;
}

/**
 * Get authentication token from storage
 */
async function getAuthToken(): Promise<string | null> {
  const { auth_token } = await chrome.storage.local.get([
    STORAGE_KEYS.AUTH_TOKEN,
  ]);
  return (auth_token as string | undefined) || null;
}

/**
 * Clear stored TrainingPeaks auth token and timestamp.
 *
 * The popup auth panel listens to storage changes and will immediately reflect
 * the unauthenticated state when these keys are removed.
 */
async function clearAuthToken(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ]);
    logger.warn('Cleared TrainingPeaks auth token after 401 response');
  } catch (error) {
    logger.error('Failed to clear TrainingPeaks auth token after 401:', error);
  }
}

/**
 * Make authenticated API request
 *
 * @param endpoint - API endpoint path
 * @param baseUrl - Base URL (defaults to API_BASE_URL, use RX_API_BASE_URL for RxBuilder)
 */
async function makeApiRequest(
  endpoint: string,
  baseUrl: string = API_BASE_URL
): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: createApiHeaders(token),
  });

  // Handle 401 Unauthorized - clear invalid token
  if (response.status === 401) {
    logger.warn(`401 Unauthorized on ${endpoint} - Token may be expired`);
    console.warn(
      `[TP Extension - Background] ⚠️ 401 on ${endpoint} - clearing token to update auth UI`
    );
    await clearAuthToken();
  }

  return response;
}

function formatValidationPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'response';
  }

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }

      const key = String(segment);
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        return index === 0 ? key : `.${key}`;
      }

      return `[${JSON.stringify(key)}]`;
    })
    .join('');
}

function getValueAtPath(input: unknown, path: PropertyKey[]): unknown {
  let cursor: unknown = input;

  for (const segment of path) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        return undefined;
      }

      cursor = cursor[segment];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }

    cursor = (cursor as Record<PropertyKey, unknown>)[segment];
  }

  return cursor;
}

function stringifyValidationInput(input: unknown): string {
  if (input === undefined) {
    return 'undefined';
  }

  if (typeof input === 'string') {
    return input;
  }

  try {
    const serialized = JSON.stringify(input);
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // Ignore serialization errors and fall back to String().
  }

  return String(input);
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function extractValidationErrorDetails(
  error: z.ZodError,
  responseJson: unknown
): ValidationErrorDetails {
  const firstIssue = error.issues[0];

  if (!firstIssue) {
    return {
      path: 'response',
      message: 'Unknown validation error',
      inputPreview: 'undefined',
    };
  }

  const issueInput =
    firstIssue.input ?? getValueAtPath(responseJson, firstIssue.path);

  return {
    path: formatValidationPath(firstIssue.path),
    message: firstIssue.message,
    inputPreview: truncateForLog(
      stringifyValidationInput(issueInput),
      MAX_VALIDATION_INPUT_LENGTH
    ),
  };
}

/**
 * Generic API request handler with Zod validation
 *
 * @template T - The expected response type
 * @param endpoint - API endpoint path
 * @param schema - Zod schema for response validation
 * @param operationName - Description for logging (e.g., "user profile", "libraries")
 * @param baseUrl - Optional base URL (defaults to API_BASE_URL)
 * @returns Type-safe API response with success/error discriminated union
 */
async function apiRequest<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  operationName: string,
  baseUrl?: string
): Promise<ApiResponse<T>> {
  const startTime = performance.now();
  const effectiveBaseUrl = baseUrl ?? API_BASE_URL;

  try {
    logger.debug(`Fetching ${operationName}`);

    const response = await makeApiRequest(endpoint, baseUrl);
    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      // Log HTTP error
      void addLog({
        timestamp: Date.now(),
        endpoint,
        method: 'GET',
        baseUrl: effectiveBaseUrl,
        status: response.status,
        success: false,
        durationMs,
        errorMessage: `HTTP ${response.status}`,
        operationName,
      });

      return {
        success: false,
        error: {
          message: `HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    const json = await response.json();

    const validationResult = schema.safeParse(json);

    if (!validationResult.success) {
      const details = extractValidationErrorDetails(
        validationResult.error,
        json
      );
      const errorMessage = `Response validation failed at ${details.path}: ${details.message}`;

      logger.error(`${operationName} validation failed:`, {
        path: details.path,
        message: details.message,
        input: details.inputPreview,
        issues: validationResult.error.issues,
      });

      void addLog({
        timestamp: Date.now(),
        endpoint,
        method: 'GET',
        baseUrl: effectiveBaseUrl,
        status: response.status,
        success: false,
        durationMs,
        errorMessage,
        errorCode: 'VALIDATION_ERROR',
        validationPath: details.path,
        validationIssue: details.message,
        validationInput: details.inputPreview,
        operationName,
      });

      return {
        success: false,
        error: {
          message: `${errorMessage}. Input: ${details.inputPreview}`,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    const validated = validationResult.data;

    // Log success
    void addLog({
      timestamp: Date.now(),
      endpoint,
      method: 'GET',
      baseUrl: effectiveBaseUrl,
      status: response.status,
      success: true,
      durationMs,
      operationName,
    });

    logger.info(`${operationName} fetched successfully`);
    return { success: true, data: validated };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);

    if (error instanceof Error && error.message === 'NO_TOKEN') {
      // Log NO_TOKEN error
      void addLog({
        timestamp: Date.now(),
        endpoint,
        method: 'GET',
        baseUrl: effectiveBaseUrl,
        status: null,
        success: false,
        durationMs,
        errorMessage: 'Not authenticated',
        errorCode: 'NO_TOKEN',
        operationName,
      });

      return {
        success: false,
        error: {
          message: 'Not authenticated',
          code: 'NO_TOKEN',
        },
      };
    }

    logger.error(`Error fetching ${operationName}:`, error);

    // Log unknown error
    void addLog({
      timestamp: Date.now(),
      endpoint,
      method: 'GET',
      baseUrl: effectiveBaseUrl,
      status: null,
      success: false,
      durationMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      operationName,
    });

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Fetch user profile from TrainingPeaks API
 *
 * @returns User profile data or error
 */
export async function fetchUser(): Promise<ApiResponse<UserProfile>> {
  const result = await apiRequest(
    '/users/v3/user',
    UserApiResponseSchema,
    'user profile'
  );

  // Extract user from wrapper response
  if (result.success) {
    return { success: true, data: result.data.user };
  }

  return result;
}

/**
 * Fetch libraries list from TrainingPeaks API
 *
 * @returns Array of libraries or error
 */
export async function fetchLibraries(): Promise<ApiResponse<Library[]>> {
  return apiRequest(
    '/exerciselibrary/v2/libraries',
    LibrariesApiResponseSchema,
    'libraries'
  );
}

/**
 * Fetch library items (workouts) from TrainingPeaks API
 *
 * @param libraryId - ID of the library to fetch items from
 * @returns Array of library items or error
 */
export async function fetchLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  return apiRequest(
    `/exerciselibrary/v2/libraries/${libraryId}/items`,
    LibraryItemsApiResponseSchema,
    `library ${libraryId} items`
  );
}

/**
 * Fetch training plans from TrainingPeaks API
 *
 * @returns Array of training plans or error
 */
export async function fetchTrainingPlans(): Promise<
  ApiResponse<TrainingPlan[]>
> {
  return apiRequest(
    '/plans/v1/plansWithAccess',
    TrainingPlansApiResponseSchema,
    'training plans'
  );
}

/**
 * Fetch workouts for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch workouts from
 * @returns Array of plan workouts or error
 */
export async function fetchPlanWorkouts(
  planId: number
): Promise<ApiResponse<PlanWorkout[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/workouts/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    PlanWorkoutsApiResponseSchema,
    `plan ${planId} workouts`
  );
}

/**
 * Fetch calendar notes for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch notes from
 * @returns Array of calendar notes or error
 */
export async function fetchPlanNotes(
  planId: number
): Promise<ApiResponse<CalendarNote[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/calendarNote/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    CalendarNotesApiResponseSchema,
    `plan ${planId} notes`
  );
}

/**
 * Fetch events for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch events from
 * @returns Array of calendar events or error
 */
export async function fetchPlanEvents(
  planId: number
): Promise<ApiResponse<CalendarEvent[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/events/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    CalendarEventsApiResponseSchema,
    `plan ${planId} events`
  );
}

/**
 * Fetch RxBuilder (structured strength) workouts for a specific training plan
 *
 * RxBuilder is TrainingPeaks' new structured strength workout builder.
 * These workouts use exercise sequences instead of traditional interval structures.
 *
 * @param planId - ID of the training plan to fetch RxBuilder workouts from
 * @returns Array of RxBuilder workouts or error
 */
export async function fetchRxBuilderWorkouts(
  planId: number
): Promise<ApiResponse<RxBuilderWorkout[]>> {
  return apiRequest(
    `/rx/activity/v1/plans/${planId}/workouts/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    RxBuilderWorkoutsApiResponseSchema,
    `plan ${planId} rx builder workouts`,
    RX_API_BASE_URL // Use RxBuilder API domain
  );
}

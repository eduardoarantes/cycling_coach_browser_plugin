/**
 * PlanMyPeak API client for background service worker
 *
 * Handles authenticated requests to PlanMyPeak workout and training-plan endpoints.
 */

import { MYPEAK_APP_URL, STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';
import {
  PlanMyPeakCreateWorkoutResponseSchema,
  PlanMyPeakLibrariesResponseSchema,
  PlanMyPeakLibrarySchema,
  PlanMyPeakWorkoutLibraryResponseSchema,
  type PlanMyPeakLibrary,
  type PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import {
  PlanMyPeakCreatePlanNoteRequestSchema,
  PlanMyPeakCreatePlanNoteResponseSchema,
  PlanMyPeakCreateTrainingPlanRequestSchema,
  PlanMyPeakSaveTrainingPlanResponseSchema,
  type PlanMyPeakCreatePlanNoteRequest,
  type PlanMyPeakCreateTrainingPlanRequest,
  type PlanMyPeakSaveTrainingPlanResponse,
  type PlanMyPeakTrainingPlanNote,
} from '@/schemas/planMyPeak.schema';
import type {
  PlanMyPeakLength,
  PlanMyPeakStep,
  PlanMyPeakStructureBlock,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import type { ApiResponse } from '@/types/api.types';
import { ZodError, z } from 'zod';

const PLANMYPEAK_API_BASE_URL = `${MYPEAK_APP_URL}/api`;
const WORKOUT_LIBRARIES_ENDPOINT = '/v1/workouts/libraries';
const WORKOUT_LIBRARY_ITEMS_ENDPOINT = '/v1/workouts/library';
const TRAINING_PLANS_ENDPOINT = '/training-plans';

type PlanMyPeakApiWorkoutType =
  | 'endurance'
  | 'tempo'
  | 'sweet_spot'
  | 'threshold'
  | 'vo2max'
  | 'recovery'
  | 'mixed'
  | 'easy'
  | 'interval'
  | 'long_run'
  | 'fartlek'
  | 'progression'
  | 'hill_repeats'
  | 'technique'
  | 'sprint'
  | 'strength'
  | 'hypertrophy'
  | 'power'
  | 'circuit';

type PlanMyPeakApiSportType = 'cycling' | 'running' | 'swimming' | 'strength';

type PlanMyPeakApiIntensity = 'easy' | 'moderate' | 'hard' | 'very_hard';

type PlanMyPeakApiStepIntensityClass =
  | 'warmUp'
  | 'active'
  | 'rest'
  | 'coolDown';

interface PlanMyPeakApiStepLength {
  unit:
    | 'second'
    | 'minute'
    | 'hour'
    | 'meter'
    | 'kilometer'
    | 'mile'
    | 'repetition';
  value: number;
}

interface PlanMyPeakApiStepTarget {
  type:
    | 'power'
    | 'heartrate'
    | 'pace'
    | 'cadence'
    | 'speed'
    | 'strokeRate'
    | 'resistance';
  minValue?: number;
  maxValue?: number;
  unit?:
    | 'percentOfFtp'
    | 'watts'
    | 'bpm'
    | 'percentOfMaxHr'
    | 'percentOfThresholdHr'
    | 'rpm'
    | 'roundOrStridePerMinute'
    | 'secondsPerKilometer'
    | 'secondsPerMile'
    | 'secondsPer100Meters'
    | 'secondsPer100Yards'
    | 'kilometersPerHour'
    | 'milesPerHour'
    | 'kilograms'
    | 'pounds'
    | 'percentOf1RM';
}

interface PlanMyPeakApiWorkoutStep {
  name: string;
  intensityClass: PlanMyPeakApiStepIntensityClass;
  length: PlanMyPeakApiStepLength;
  targets: PlanMyPeakApiStepTarget[];
}

interface PlanMyPeakApiWorkoutSegment {
  type: 'step' | 'repetition';
  length: {
    unit: 'repetition';
    value: number;
  };
  steps?: PlanMyPeakApiWorkoutStep[];
}

interface PlanMyPeakCreateWorkoutRequest {
  name: string;
  detailed_description?: string | null;
  sport_type: PlanMyPeakApiSportType;
  type: PlanMyPeakApiWorkoutType;
  intensity: PlanMyPeakApiIntensity;
  suitable_phases?: string[];
  suitable_weekdays?: number[];
  structure: {
    primaryIntensityMetric:
      | 'percentOfFtp'
      | 'watts'
      | 'heartrate'
      | 'percentOfThresholdPace'
      | 'pace'
      | 'speed'
      | 'resistance';
    primaryLengthMetric: 'duration' | 'distance';
    structure: PlanMyPeakApiWorkoutSegment[];
  };
  base_duration_min: number;
  base_tss: number;
  variable_components?: unknown | null;
  is_public?: boolean;
  library_id: string;
  source_id?: string | null;
}

const PlanMyPeakTrainingPlanSummarySchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    source_id: z.string().nullable().optional(),
    sourceId: z.string().nullable().optional(),
  })
  .passthrough();

const PlanMyPeakTrainingPlansListResponseSchema = z
  .object({
    plans: z.array(PlanMyPeakTrainingPlanSummarySchema),
  })
  .passthrough();

function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : '';
}

async function getAuthToken(): Promise<string | null> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.MYPEAK_AUTH_TOKEN]);
  return (data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] as string | undefined) ?? null;
}

async function clearAuthToken(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
      STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
    ]);
    logger.warn('Cleared PlanMyPeak auth token after 401 response');
  } catch (error) {
    logger.error('Failed to clear PlanMyPeak auth token after 401:', error);
  }
}

async function makeApiRequest(
  endpoint: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('accept', 'application/json');
  headers.set('authorization', `Bearer ${token}`);

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${PLANMYPEAK_API_BASE_URL}${endpoint}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    logger.warn(
      `[PlanMyPeak API] 401 on ${endpoint} - clearing token to update auth UI`
    );
    await clearAuthToken();
  }

  return response;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return json.error || json.message || `HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

function isDuplicateTrainingPlanSourceIdError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes('source_id') &&
    normalized.includes('already exists') &&
    normalized.includes('training plan')
  );
}

async function findPlanMyPeakTrainingPlanBySourceId(
  sourceId: string
): Promise<ApiResponse<{ id: string; name?: string } | null>> {
  const trimmedSourceId = sourceId.trim();
  if (!trimmedSourceId) {
    return { success: true, data: null };
  }

  try {
    logger.debug(
      `[PlanMyPeak API] Looking up training plan by source_id "${trimmedSourceId}"`
    );

    const response = await makeApiRequest(TRAINING_PLANS_ENDPOINT);
    if (!response.ok) {
      const message = await parseErrorMessage(response);
      return {
        success: false,
        error: {
          message,
          status: response.status,
        },
      };
    }

    const json = await response.json();
    const parsed = PlanMyPeakTrainingPlansListResponseSchema.parse(json);
    const match = parsed.plans.find(
      (plan) => (plan.source_id ?? plan.sourceId ?? null) === trimmedSourceId
    );

    if (!match) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: match.id,
        name: match.name,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_TOKEN') {
      return {
        success: false,
        error: {
          message: 'PlanMyPeak authentication required',
          code: 'NO_TOKEN',
        },
      };
    }

    if (error instanceof ZodError) {
      logger.error(
        '[PlanMyPeak API] Training plan lookup response validation failed:',
        error
      );
      return {
        success: false,
        error: {
          message: 'Response validation failed while listing training plans',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error(
      '[PlanMyPeak API] Failed to lookup training plan by source_id:',
      error
    );
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

function updatePlanMyPeakTrainingPlan(
  planId: string,
  payload: PlanMyPeakCreateTrainingPlanRequest
): Promise<ApiResponse<PlanMyPeakSaveTrainingPlanResponse>> {
  const trimmedPlanId = planId.trim();
  if (!trimmedPlanId) {
    return Promise.resolve({
      success: false,
      error: {
        message: 'Plan id is required',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  return apiRequest(
    `${TRAINING_PLANS_ENDPOINT}/${encodeURIComponent(trimmedPlanId)}`,
    PlanMyPeakSaveTrainingPlanResponseSchema,
    `Updating PlanMyPeak training plan "${payload.metadata.name}" (${trimmedPlanId})`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

function normalizeWorkoutType(
  type: PlanMyPeakWorkout['type']
): PlanMyPeakApiWorkoutType {
  switch (type) {
    case 'easy':
    case 'interval':
    case 'long_run':
    case 'fartlek':
    case 'progression':
    case 'hill_repeats':
    case 'technique':
    case 'sprint':
    case 'strength':
    case 'hypertrophy':
    case 'power':
    case 'vo2max':
    case 'threshold':
    case 'sweet_spot':
    case 'tempo':
    case 'endurance':
    case 'recovery':
    case 'mixed':
    case 'circuit':
      return type;
    default:
      return 'mixed';
  }
}

function normalizeSportType(
  sportType: PlanMyPeakWorkout['sport_type']
): PlanMyPeakApiSportType {
  switch (sportType) {
    case 'running':
    case 'swimming':
    case 'strength':
      return sportType;
    case 'cycling':
    default:
      return 'cycling';
  }
}

function normalizeWorkoutIntensity(
  intensity: PlanMyPeakWorkout['intensity']
): PlanMyPeakApiIntensity {
  if (
    intensity === 'easy' ||
    intensity === 'moderate' ||
    intensity === 'hard' ||
    intensity === 'very_hard'
  ) {
    return intensity;
  }

  return 'moderate';
}

function isLegacyBlock(value: unknown): value is PlanMyPeakStructureBlock {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    'steps' in value &&
    Array.isArray((value as { steps?: unknown[] }).steps)
  );
}

function isLegacyStep(value: unknown): value is PlanMyPeakStep {
  return (
    !!value &&
    typeof value === 'object' &&
    'name' in value &&
    'length' in value &&
    'targets' in value
  );
}

function normalizeStepIntensityClass(
  intensityClass: PlanMyPeakStep['intensityClass']
): PlanMyPeakApiStepIntensityClass {
  switch (intensityClass) {
    case 'warmUp':
      return 'warmUp';
    case 'coolDown':
      return 'coolDown';
    case 'rest':
    case 'recovery':
      return 'rest';
    case 'active':
      return 'active';
    default:
      return 'active';
  }
}

function normalizeStepLength(
  length: PlanMyPeakLength
): PlanMyPeakApiStepLength {
  const normalizedUnit = (() => {
    switch (length.unit) {
      case 'second':
      case 'minute':
      case 'hour':
      case 'meter':
      case 'kilometer':
      case 'mile':
      case 'repetition':
        return length.unit;
      default:
        return 'second';
    }
  })();
  return {
    unit: normalizedUnit,
    value:
      typeof length.value === 'number' && Number.isFinite(length.value)
        ? Math.max(1, length.value)
        : 1,
  };
}

function normalizeTargets(
  targets: PlanMyPeakStep['targets']
): PlanMyPeakApiStepTarget[] {
  return targets.map((target) => {
    switch (target.type) {
      case 'cadence':
        return {
          type: 'cadence',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit:
            target.unit === 'roundOrStridePerMinute'
              ? 'roundOrStridePerMinute'
              : 'rpm',
        };
      case 'heartRate':
        return {
          type: 'heartrate',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit,
        };
      case 'pace':
        return {
          type: 'pace',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit,
        };
      case 'speed':
        return {
          type: 'speed',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit,
        };
      case 'strokeRate':
        return {
          type: 'strokeRate',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit,
        };
      case 'resistance':
        return {
          type: 'resistance',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit,
        };
      case 'power':
      default:
        return {
          type: 'power',
          minValue: target.minValue,
          maxValue: target.maxValue,
          unit: target.unit === 'watts' ? 'watts' : 'percentOfFtp',
        };
    }
  });
}

function flattenLegacySteps(
  steps: Array<PlanMyPeakStep | PlanMyPeakStructureBlock>
): PlanMyPeakApiWorkoutStep[] {
  const flattened: PlanMyPeakApiWorkoutStep[] = [];

  for (const step of steps) {
    if (isLegacyStep(step)) {
      flattened.push({
        name: step.name?.trim() || 'Step',
        intensityClass: normalizeStepIntensityClass(step.intensityClass),
        length: normalizeStepLength(step.length),
        targets: normalizeTargets(step.targets),
      });
      continue;
    }

    if (isLegacyBlock(step)) {
      const nested = flattenLegacySteps(step.steps);
      const repetitions =
        step.length.unit === 'repetition'
          ? Math.max(1, Math.round(step.length.value || 1))
          : 1;
      for (let i = 0; i < repetitions; i += 1) {
        flattened.push(...nested);
      }
    }
  }

  return flattened;
}

function normalizeWorkoutStructure(
  workout: PlanMyPeakWorkout
): PlanMyPeakCreateWorkoutRequest['structure'] {
  const primaryIntensityMetric = (() => {
    switch (workout.structure.primaryIntensityMetric) {
      case 'heartRate':
        return 'heartrate' as const;
      case 'watts':
      case 'percentOfThresholdPace':
      case 'pace':
      case 'speed':
      case 'resistance':
      case 'percentOfFtp':
        return workout.structure.primaryIntensityMetric;
      default:
        return 'percentOfFtp' as const;
    }
  })();

  return {
    primaryIntensityMetric,
    primaryLengthMetric:
      workout.structure.primaryLengthMetric === 'distance'
        ? 'distance'
        : 'duration',
    structure: workout.structure.structure.map((block) => ({
      type: block.type === 'repetition' ? 'repetition' : 'step',
      length: {
        unit: 'repetition',
        value:
          block.type === 'repetition' && block.length.unit === 'repetition'
            ? Math.max(1, Math.round(block.length.value || 1))
            : 1,
      },
      steps: flattenLegacySteps(block.steps),
    })),
  };
}

function toCreateWorkoutRequest(
  workout: PlanMyPeakWorkout,
  libraryId: string
): PlanMyPeakCreateWorkoutRequest {
  const suitablePhases =
    Array.isArray(workout.suitable_phases) && workout.suitable_phases.length > 0
      ? workout.suitable_phases
      : undefined;

  const suitableWeekdays = (() => {
    if (!Array.isArray(workout.suitable_weekdays)) {
      return undefined;
    }

    const weekdayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const normalized = workout.suitable_weekdays
      .map((value) => String(value).trim().toLowerCase())
      .map((value) => {
        if (value in weekdayMap) {
          return weekdayMap[value];
        }

        const asNumber = Number.parseInt(value, 10);
        if (Number.isFinite(asNumber) && asNumber >= 0 && asNumber <= 6) {
          return asNumber;
        }

        return null;
      })
      .filter((value): value is number => value !== null);

    return normalized.length > 0 ? normalized : undefined;
  })();

  return {
    name: workout.name,
    detailed_description: workout.detailed_description ?? null,
    sport_type: normalizeSportType(workout.sport_type),
    type: normalizeWorkoutType(workout.type),
    intensity: normalizeWorkoutIntensity(workout.intensity),
    suitable_phases: suitablePhases,
    suitable_weekdays: suitableWeekdays,
    structure: normalizeWorkoutStructure(workout),
    base_duration_min: Math.max(1, Math.round(workout.base_duration_min || 1)),
    base_tss: Math.max(0, Math.round(workout.base_tss || 0)),
    variable_components: workout.variable_components ?? null,
    is_public: false,
    library_id: libraryId,
    source_id: workout.source_id ?? null,
  };
}

async function apiRequest<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  operationName: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    logger.debug(`[PlanMyPeak API] ${operationName}`);

    const response = await makeApiRequest(endpoint, init);

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      return {
        success: false,
        error: {
          message,
          status: response.status,
        },
      };
    }

    const json = await response.json();
    const validated = schema.parse(json);

    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_TOKEN') {
      return {
        success: false,
        error: {
          message: 'PlanMyPeak authentication required',
          code: 'NO_TOKEN',
        },
      };
    }

    if (error instanceof ZodError) {
      logger.error('[PlanMyPeak API] Response validation failed:', error);
      const firstIssue = error.issues[0];
      const issuePath =
        firstIssue && firstIssue.path.length > 0
          ? firstIssue.path.join('.')
          : 'response';
      const issueMessage = firstIssue?.message || 'Unknown validation error';
      return {
        success: false,
        error: {
          message: `Response validation failed (${issuePath}: ${issueMessage})`,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error(`[PlanMyPeak API] ${operationName} failed:`, error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Fetch PlanMyPeak workout libraries
 */
export async function fetchPlanMyPeakLibraries(): Promise<
  ApiResponse<PlanMyPeakLibrary[]>
> {
  const result = await apiRequest(
    WORKOUT_LIBRARIES_ENDPOINT,
    PlanMyPeakLibrariesResponseSchema,
    'Fetching PlanMyPeak libraries'
  );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.libraries,
  };
}

/**
 * Fetch PlanMyPeak workouts with optional filters
 */
export async function fetchPlanMyPeakWorkouts(filters?: {
  libraryId?: string;
  sourceId?: string;
}): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem[]>> {
  const query = buildQuery({
    library_id: filters?.libraryId,
    source_id: filters?.sourceId,
  });

  const result = await apiRequest(
    `${WORKOUT_LIBRARY_ITEMS_ENDPOINT}${query}`,
    PlanMyPeakWorkoutLibraryResponseSchema,
    `Fetching PlanMyPeak workouts${query}`
  );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.workouts,
  };
}

/**
 * Find a single workout by source_id (optionally scoped to a library)
 */
export async function fetchPlanMyPeakWorkoutBySourceId(
  sourceId: string,
  libraryId?: string
): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem | null>> {
  const trimmedSourceId = sourceId.trim();
  if (!trimmedSourceId) {
    return {
      success: false,
      error: {
        message: 'source_id is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const result = await fetchPlanMyPeakWorkouts({
    libraryId,
    sourceId: trimmedSourceId,
  });

  if (!result.success) {
    return result;
  }

  const match = result.data.find(
    (workout) => workout.source_id === trimmedSourceId
  );
  return { success: true, data: match ?? null };
}

/**
 * Create a PlanMyPeak workout library
 */
export async function createPlanMyPeakLibrary(
  name: string,
  sourceId?: string | null
): Promise<ApiResponse<PlanMyPeakLibrary>> {
  const trimmedName = name.trim();
  const trimmedSourceId = sourceId?.trim() || null;

  if (!trimmedName) {
    return {
      success: false,
      error: {
        message: 'Library name is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  return apiRequest(
    WORKOUT_LIBRARIES_ENDPOINT,
    PlanMyPeakLibrarySchema,
    `Creating PlanMyPeak library "${trimmedName}"`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: trimmedName,
        source_id: trimmedSourceId,
      }),
    }
  );
}

/**
 * Delete a PlanMyPeak workout library
 */
export async function deletePlanMyPeakLibrary(
  libraryId: string
): Promise<ApiResponse<null>> {
  const trimmedLibraryId = libraryId.trim();

  if (!trimmedLibraryId) {
    return {
      success: false,
      error: {
        message: 'Library id is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  try {
    logger.debug(`[PlanMyPeak API] Deleting library ${trimmedLibraryId}`);

    const response = await makeApiRequest(
      `${WORKOUT_LIBRARIES_ENDPOINT}/${encodeURIComponent(trimmedLibraryId)}`,
      {
        method: 'DELETE',
      }
    );

    if (response.status === 204 || response.status === 200) {
      return { success: true, data: null };
    }

    const message = await parseErrorMessage(response);
    return {
      success: false,
      error: {
        message,
        status: response.status,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_TOKEN') {
      return {
        success: false,
        error: {
          message: 'PlanMyPeak authentication required',
          code: 'NO_TOKEN',
        },
      };
    }

    logger.error('[PlanMyPeak API] Delete library failed:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Upload transformed workouts to a specific PlanMyPeak library
 */
export async function exportWorkoutsToPlanMyPeakLibrary(
  workouts: PlanMyPeakWorkout[],
  libraryId: string
): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem[]>> {
  const trimmedLibraryId = libraryId.trim();

  if (!trimmedLibraryId) {
    return {
      success: false,
      error: {
        message: 'PlanMyPeak library id is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const uploaded: PlanMyPeakWorkoutLibraryItem[] = [];

  for (const workout of workouts) {
    const requestBody = toCreateWorkoutRequest(workout, trimmedLibraryId);

    const result = await apiRequest(
      WORKOUT_LIBRARY_ITEMS_ENDPOINT,
      PlanMyPeakCreateWorkoutResponseSchema,
      `Uploading PlanMyPeak workout "${workout.name}"`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: {
          ...result.error,
          message: `Failed to upload "${workout.name}": ${result.error.message}`,
        },
      };
    }

    uploaded.push(result.data);
  }

  return {
    success: true,
    data: uploaded,
  };
}

/**
 * Create a training plan template.
 */
export async function createPlanMyPeakTrainingPlan(
  payload: PlanMyPeakCreateTrainingPlanRequest
): Promise<ApiResponse<PlanMyPeakSaveTrainingPlanResponse>> {
  const parsedPayload =
    PlanMyPeakCreateTrainingPlanRequestSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      success: false,
      error: {
        message: 'Invalid training plan payload',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const createResult = await apiRequest(
    TRAINING_PLANS_ENDPOINT,
    PlanMyPeakSaveTrainingPlanResponseSchema,
    `Creating PlanMyPeak training plan "${parsedPayload.data.metadata.name}"`,
    {
      method: 'POST',
      body: JSON.stringify(parsedPayload.data),
    }
  );

  if (createResult.success) {
    return createResult;
  }

  const sourceId = parsedPayload.data.metadata.source_id?.trim();
  if (
    !sourceId ||
    !isDuplicateTrainingPlanSourceIdError(createResult.error.message)
  ) {
    return createResult;
  }

  logger.warn(
    `[PlanMyPeak API] Duplicate training plan source_id "${sourceId}" detected. Attempting update fallback.`
  );

  const existingPlanResult =
    await findPlanMyPeakTrainingPlanBySourceId(sourceId);
  if (!existingPlanResult.success) {
    return {
      success: false,
      error: {
        ...existingPlanResult.error,
        message: `Failed to resolve existing training plan for source_id "${sourceId}": ${existingPlanResult.error.message}`,
      },
    };
  }

  if (!existingPlanResult.data) {
    return createResult;
  }

  const updateResult = await updatePlanMyPeakTrainingPlan(
    existingPlanResult.data.id,
    parsedPayload.data
  );

  if (!updateResult.success) {
    return {
      success: false,
      error: {
        ...updateResult.error,
        message: `Failed to update existing training plan for source_id "${sourceId}": ${updateResult.error.message}`,
      },
    };
  }

  logger.info(
    `[PlanMyPeak API] Updated existing training plan ${existingPlanResult.data.id} for source_id "${sourceId}"`
  );
  return updateResult;
}

/**
 * Create a note on an existing training plan template.
 */
export async function createPlanMyPeakTrainingPlanNote(
  planId: string,
  payload: PlanMyPeakCreatePlanNoteRequest
): Promise<ApiResponse<PlanMyPeakTrainingPlanNote>> {
  const trimmedPlanId = planId.trim();
  if (!trimmedPlanId) {
    return {
      success: false,
      error: {
        message: 'Plan id is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const parsedPayload =
    PlanMyPeakCreatePlanNoteRequestSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      success: false,
      error: {
        message: 'Invalid plan note payload',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const result = await apiRequest(
    `${TRAINING_PLANS_ENDPOINT}/${encodeURIComponent(trimmedPlanId)}/notes`,
    PlanMyPeakCreatePlanNoteResponseSchema,
    `Creating note on PlanMyPeak training plan ${trimmedPlanId}`,
    {
      method: 'POST',
      body: JSON.stringify(parsedPayload.data),
    }
  );

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: result.data.note,
  };
}

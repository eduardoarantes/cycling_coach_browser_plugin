/**
 * Intervals.icu API Client (Redesigned)
 *
 * Creates folders and exports workouts as LIBRARY TEMPLATES or PLAN folders.
 * Uses /folders and /workouts endpoints, NOT /events/bulk.
 *
 * API Documentation: https://intervals.icu/api-docs.html
 */

import type { LibraryItem } from '@/schemas/library.schema';
import type { RxBuilderWorkout } from '@/schemas/rxBuilder.schema';
import type {
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/schemas/trainingPlan.schema';
import type {
  IntervalsFolderPayload,
  IntervalsPlanFolderPayload,
  IntervalsPlanFolderCreationResult,
  IntervalsPlanConflictAction,
  IntervalsFolderResponse,
  IntervalsWorkoutPayload,
  IntervalsPlanWorkoutPayload,
  IntervalsPlanNotePayload,
  IntervalsPlanEventPayload,
  IntervalsTrainingPlanExportResult,
  IntervalsWorkoutResponse,
  IntervalsAthleteResponse,
} from '@/types/intervalsicu.types';
import type { TrainingPlanExportProgressPayload } from '@/types';
import {
  IntervalsFolderResponseSchema,
  IntervalsWorkoutResponseSchema,
  IntervalsAthleteResponseSchema,
  IntervalsPlanFolderPayloadSchema,
  IntervalsPlanNotePayloadSchema,
  IntervalsPlanEventPayloadSchema,
  IntervalsPlanWorkoutPayloadSchema,
  IntervalsFolderListResponseSchema,
} from '@/schemas/intervalsicu.schema';
import { getIntervalsApiKey } from '@/services/intervalsApiKeyService';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types/api.types';
import {
  generateCurlCommand,
  formatCurlForConsole,
} from '@/utils/curlGenerator';
import {
  buildIntervalsIcuDescription,
  buildIntervalsIcuDescriptionFromPlanWorkout,
  buildIntervalsIcuDescriptionFromRxBuilderWorkout,
  mapTpWorkoutTypeToIntervalsType,
} from '@/export/adapters/intervalsicu/workoutMapping';
import { normalizeToMonday } from '@/utils/dateUtils';

/**
 * Intervals.icu API base URL
 */
const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

type TrainingPlanExportProgressCallback = (
  progress: TrainingPlanExportProgressPayload
) => void | Promise<void>;

type PlanSectionItemProgressCallback = (progress: {
  current: number;
  total: number;
  itemName: string;
}) => void | Promise<void>;

async function notifyTrainingPlanExportProgress(
  callback: TrainingPlanExportProgressCallback | undefined,
  progress: TrainingPlanExportProgressPayload
): Promise<void> {
  if (!callback) {
    return;
  }
  await callback(progress);
}

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
  const name =
    typeof workout.itemName === 'string' && workout.itemName.trim().length > 0
      ? workout.itemName.trim()
      : `TrainingPeaks Workout ${workout.exerciseLibraryItemId}`;

  const payload: IntervalsWorkoutPayload = {
    category: 'WORKOUT',
    type: mapTpWorkoutTypeToIntervalsType(workout.workoutTypeId),
    name,
    description: buildIntervalsIcuDescription(workout),
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

function parseTpDateToUtcMidnight(
  dateStr: string | null | undefined
): Date | null {
  if (!dateStr) {
    return null;
  }

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIntervalsLocalMidnight(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00`;
}

function getIntervalsPlanAnchorMonday(
  trainingPlan: TrainingPlan,
  workouts: PlanWorkout[],
  rxWorkouts: RxBuilderWorkout[] = [],
  notes: CalendarNote[] = [],
  events: CalendarEvent[] = []
): Date {
  const classicWorkoutDates = workouts
    .map((workout) => parseTpDateToUtcMidnight(workout.workoutDay))
    .filter((date): date is Date => date !== null);
  const rxWorkoutDates = rxWorkouts
    .map((workout) => parseTpDateToUtcMidnight(workout.prescribedDate))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const workoutDates = [...classicWorkoutDates, ...rxWorkoutDates].sort(
    (a, b) => a.getTime() - b.getTime()
  );
  const noteDates = notes
    .map((note) => parseTpDateToUtcMidnight(note.noteDate))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const eventDates = events
    .map((event) => parseTpDateToUtcMidnight(event.eventDate))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const allDates = [...workoutDates, ...noteDates, ...eventDates].sort(
    (a, b) => a.getTime() - b.getTime()
  );

  const anchorSource =
    allDates[0] ?? parseTpDateToUtcMidnight(trainingPlan.startDate);

  if (!anchorSource) {
    throw new Error(
      `Unable to determine Intervals plan start date from TP plan ${trainingPlan.planId}`
    );
  }

  return normalizeToMonday(anchorSource);
}

export function buildIntervalsPlanStartDateLocal(
  trainingPlan: TrainingPlan,
  workouts: PlanWorkout[],
  rxWorkouts: RxBuilderWorkout[] = [],
  notes: CalendarNote[] = [],
  events: CalendarEvent[] = []
): string {
  return formatIntervalsLocalMidnight(
    getIntervalsPlanAnchorMonday(
      trainingPlan,
      workouts,
      rxWorkouts,
      notes,
      events
    )
  );
}

function buildIntervalsPlanFolderPayload(
  trainingPlan: TrainingPlan,
  startDateLocal: string
): IntervalsPlanFolderPayload {
  const planName =
    typeof trainingPlan.title === 'string' &&
    trainingPlan.title.trim().length > 0
      ? trainingPlan.title.trim()
      : `TrainingPeaks Plan ${trainingPlan.planId}`;

  const payload: IntervalsPlanFolderPayload = {
    type: 'PLAN',
    name: planName,
    start_date_local: startDateLocal,
    visibility: 'PRIVATE',
  };

  if (trainingPlan.description) {
    payload.description = trainingPlan.description;
  }

  if (Number.isInteger(trainingPlan.weekCount) && trainingPlan.weekCount > 0) {
    payload.duration_weeks = trainingPlan.weekCount;
  }

  if (
    Number.isInteger(trainingPlan.workoutCount) &&
    trainingPlan.workoutCount >= 0
  ) {
    payload.num_workouts = trainingPlan.workoutCount;
  }

  return IntervalsPlanFolderPayloadSchema.parse(payload);
}

function getPlanWorkoutDayOffset(
  workout: PlanWorkout,
  planAnchorMondayUtc: Date
): number {
  const workoutDate = parseTpDateToUtcMidnight(workout.workoutDay);
  if (!workoutDate) {
    throw new Error(
      `Plan workout ${workout.workoutId} has invalid workoutDay: ${workout.workoutDay}`
    );
  }

  const diffMs = workoutDate.getTime() - planAnchorMondayUtc.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    throw new Error(
      `Plan workout ${workout.workoutId} occurs before plan start (${workout.workoutDay})`
    );
  }

  return diffDays;
}

function getRxBuilderWorkoutDayOffset(
  workout: RxBuilderWorkout,
  planAnchorMondayUtc: Date
): number {
  const workoutDate = parseTpDateToUtcMidnight(workout.prescribedDate);
  if (!workoutDate) {
    throw new Error(
      `RxBuilder workout ${workout.id} has invalid prescribedDate: ${workout.prescribedDate}`
    );
  }

  const diffMs = workoutDate.getTime() - planAnchorMondayUtc.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    throw new Error(
      `RxBuilder workout ${workout.id} occurs before plan start (${workout.prescribedDate})`
    );
  }

  return diffDays;
}

function buildPlanWorkoutPayload(
  workout: PlanWorkout,
  folderId: number,
  planAnchorMondayUtc: Date
): IntervalsPlanWorkoutPayload {
  const name =
    typeof workout.title === 'string' && workout.title.trim().length > 0
      ? workout.title.trim()
      : `TrainingPeaks Workout ${workout.workoutId}`;

  const payload: IntervalsPlanWorkoutPayload = {
    category: 'WORKOUT',
    type: mapTpWorkoutTypeToIntervalsType(workout.workoutTypeValueId),
    name,
    description: buildIntervalsIcuDescriptionFromPlanWorkout(workout),
    folder_id: folderId,
    day: getPlanWorkoutDayOffset(workout, planAnchorMondayUtc),
    for_week: false,
  };

  if (workout.totalTimePlanned) {
    payload.moving_time = Math.round(workout.totalTimePlanned * 3600);
  }

  if (workout.tssPlanned) {
    payload.icu_training_load = workout.tssPlanned;
  }

  return IntervalsPlanWorkoutPayloadSchema.parse(payload);
}

function buildRxBuilderPlanWorkoutPayload(
  workout: RxBuilderWorkout,
  folderId: number,
  planAnchorMondayUtc: Date
): IntervalsPlanWorkoutPayload {
  const name =
    typeof workout.title === 'string' && workout.title.trim().length > 0
      ? workout.title.trim()
      : `TrainingPeaks Strength ${workout.id}`;

  const payload: IntervalsPlanWorkoutPayload = {
    category: 'WORKOUT',
    type: 'WeightTraining',
    name,
    description: buildIntervalsIcuDescriptionFromRxBuilderWorkout(workout),
    folder_id: folderId,
    day: getRxBuilderWorkoutDayOffset(workout, planAnchorMondayUtc),
    for_week: false,
  };

  if (
    typeof workout.prescribedDurationInSeconds === 'number' &&
    Number.isFinite(workout.prescribedDurationInSeconds) &&
    workout.prescribedDurationInSeconds > 0
  ) {
    payload.moving_time = Math.round(workout.prescribedDurationInSeconds);
  }

  return IntervalsPlanWorkoutPayloadSchema.parse(payload);
}

function buildPlanNotePayload(
  note: CalendarNote,
  folderId: number,
  planAnchorMondayUtc: Date
): IntervalsPlanNotePayload {
  const name =
    typeof note.title === 'string' && note.title.trim().length > 0
      ? note.title.trim()
      : `Note ${note.id}`;

  const payload: IntervalsPlanNotePayload = {
    name,
    description: typeof note.description === 'string' ? note.description : '',
    type: 'NOTE',
    color: 'green',
    day: getPlanNoteDayOffset(note, planAnchorMondayUtc),
    folder_id: folderId,
  };

  return IntervalsPlanNotePayloadSchema.parse(payload);
}

function buildPlanEventDescription(event: CalendarEvent): string {
  const parts = [
    typeof event.description === 'string' ? event.description.trim() : '',
    typeof event.comment === 'string' ? event.comment.trim() : '',
  ].filter((part) => part.length > 0);

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  if (
    typeof event.eventType === 'string' &&
    event.eventType.trim().length > 0
  ) {
    return event.eventType.trim();
  }

  return '';
}

const TP_PLAN_EVENT_TYPE_TO_INTERVALS_TYPE_MAP: Record<string, string> = {
  bike: 'Ride',
  ride: 'Ride',
  cycling: 'Ride',
  roadbike: 'Ride',
  roadcycling: 'Ride',
  mountainbike: 'Ride',
  mtb: 'Ride',
  gravel: 'Ride',
  cycle: 'Ride',

  run: 'Run',
  running: 'Run',
  trailrun: 'Run',
  roadrun: 'Run',

  swim: 'Swim',
  swimming: 'Swim',
  openwaterswim: 'Swim',

  rowing: 'Rowing',
  row: 'Rowing',

  xcski: 'XCSki',
  crosscountryski: 'XCSki',
  nordicski: 'XCSki',

  walk: 'Walk',
  walking: 'Walk',
  hike: 'Walk',
  hiking: 'Walk',

  strength: 'WeightTraining',
  weighttraining: 'WeightTraining',

  // Intervals category carries the race marker. Type still needs a sport and
  // Intervals does not expose a dedicated triathlon race sport in this flow.
  multisporttriathlon: 'Ride',
  triathlon: 'Ride',
  multisportduathlon: 'Ride',
  duathlon: 'Ride',
} as const;

function normalizeTpPlanEventTypeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapTpPlanEventTypeToIntervalsType(event: CalendarEvent): string {
  const raw = typeof event.eventType === 'string' ? event.eventType.trim() : '';
  const normalized = normalizeTpPlanEventTypeKey(raw);

  if (normalized) {
    const exactMapped = TP_PLAN_EVENT_TYPE_TO_INTERVALS_TYPE_MAP[normalized];
    if (exactMapped) {
      return exactMapped;
    }
  }

  // Defensive fallback for unexpected TP eventType strings.
  if (normalized.includes('bike') || normalized.includes('cycle'))
    return 'Ride';
  if (normalized.includes('run')) return 'Run';
  if (normalized.includes('swim')) return 'Swim';
  if (normalized.includes('row')) return 'Rowing';
  if (normalized.includes('ski')) return 'XCSki';
  if (normalized.includes('walk') || normalized.includes('hike')) return 'Walk';
  if (normalized.includes('strength') || normalized.includes('weight'))
    return 'WeightTraining';

  return 'Other';
}

function buildPlanEventPayload(
  event: CalendarEvent,
  folderId: number,
  planAnchorMondayUtc: Date
): IntervalsPlanEventPayload {
  const baseName =
    typeof event.name === 'string' && event.name.trim().length > 0
      ? event.name.trim()
      : `${event.id}`;

  const payload: IntervalsPlanEventPayload = {
    name: `Event: ${baseName}`,
    description: buildPlanEventDescription(event),
    type: mapTpPlanEventTypeToIntervalsType(event),
    category: 'RACE_A',
    day: getPlanEventDayOffset(event, planAnchorMondayUtc),
    folder_id: folderId,
  };

  return IntervalsPlanEventPayloadSchema.parse(payload);
}

function getPlanNoteDayOffset(
  note: CalendarNote,
  planAnchorMondayUtc: Date
): number {
  const noteDate = parseTpDateToUtcMidnight(note.noteDate);
  if (!noteDate) {
    throw new Error(
      `Plan note ${note.id} has invalid noteDate: ${note.noteDate}`
    );
  }

  const diffMs = noteDate.getTime() - planAnchorMondayUtc.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    throw new Error(
      `Plan note ${note.id} occurs before plan start (${note.noteDate})`
    );
  }

  return diffDays;
}

function getPlanEventDayOffset(
  event: CalendarEvent,
  planAnchorMondayUtc: Date
): number {
  const eventDate = parseTpDateToUtcMidnight(event.eventDate);
  if (!eventDate) {
    throw new Error(
      `Plan event ${event.id} has invalid eventDate: ${event.eventDate}`
    );
  }

  const diffMs = eventDate.getTime() - planAnchorMondayUtc.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    throw new Error(
      `Plan event ${event.id} occurs before plan start (${event.eventDate})`
    );
  }

  return diffDays;
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

function normalizeIntervalsFolderName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * List Intervals.icu folders for the current athlete.
 *
 * GET /api/v1/athlete/{athleteId}/folders
 */
export async function listIntervalsFolders(): Promise<
  ApiResponse<IntervalsFolderResponse[]>
> {
  try {
    logger.debug('Listing Intervals.icu folders');

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/folders`;
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

    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

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

    const json = await response.json();
    const folders = IntervalsFolderListResponseSchema.parse(json);
    logger.info('Successfully listed Intervals.icu folders:', folders.length);
    return { success: true, data: folders };
  } catch (error) {
    logger.error('Failed to list Intervals.icu folders:', error);
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
 * Find an existing Intervals PLAN folder by exact name (case-insensitive trim).
 */
export async function findIntervalsPlanFolderByName(
  planName: string
): Promise<ApiResponse<IntervalsFolderResponse | null>> {
  const targetName = normalizeIntervalsFolderName(planName);
  if (targetName.length === 0) {
    return { success: true, data: null };
  }

  const foldersResult = await listIntervalsFolders();
  if (!foldersResult.success) {
    return foldersResult;
  }

  const match =
    foldersResult.data.find((folder) => {
      const sameName = normalizeIntervalsFolderName(folder.name) === targetName;
      const isPlanFolder =
        typeof folder.type !== 'string' ||
        folder.type.trim().toUpperCase() === 'PLAN';
      return sameName && isPlanFolder;
    }) ?? null;

  logger.debug(
    'Intervals plan name lookup:',
    planName,
    match ? `found folder ${match.id}` : 'not found'
  );

  return { success: true, data: match };
}

/**
 * Find an existing Intervals library folder (non-PLAN) by exact name (case-insensitive trim).
 */
export async function findIntervalsLibraryFolderByName(
  folderName: string
): Promise<ApiResponse<IntervalsFolderResponse | null>> {
  const targetName = normalizeIntervalsFolderName(folderName);
  if (targetName.length === 0) {
    return { success: true, data: null };
  }

  const foldersResult = await listIntervalsFolders();
  if (!foldersResult.success) {
    return foldersResult;
  }

  const match =
    foldersResult.data.find((folder) => {
      const sameName = normalizeIntervalsFolderName(folder.name) === targetName;
      const folderType = folder.type?.trim().toUpperCase();
      const isLibraryFolder = !folderType || folderType === 'FOLDER';
      return sameName && isLibraryFolder;
    }) ?? null;

  logger.debug(
    'Intervals library folder name lookup:',
    folderName,
    match ? `found folder ${match.id}` : 'not found'
  );

  return { success: true, data: match };
}

/**
 * Delete an Intervals.icu folder/plan by ID.
 *
 * DELETE /api/v1/athlete/{athleteId}/folders/{folderId}
 */
export async function deleteIntervalsFolder(
  folderId: number
): Promise<ApiResponse<null>> {
  try {
    logger.debug('Deleting Intervals.icu folder:', folderId);

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    const url = `${INTERVALS_API_BASE}/athlete/${athleteId}/folders/${folderId}`;
    const auth = btoa(`API_KEY:${apiKey}`);
    const requestOptions: {
      method: string;
      headers: Record<string, string>;
    } = {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

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

    logger.info('Successfully deleted Intervals.icu folder:', folderId);
    return { success: true, data: null };
  } catch (error) {
    logger.error('Failed to delete Intervals.icu folder:', error);
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
 * Create a reusable Intervals.icu PLAN folder from a TrainingPeaks plan.
 *
 * - Plan name is mapped from TP `trainingPlan.title`
 * - `start_date_local` is required by Intervals and is anchored to the Monday
 *   of the earliest workout date (or TP plan start date if no workouts)
 */
export async function createIntervalsPlanFolder(
  trainingPlan: TrainingPlan,
  workouts: PlanWorkout[] = [],
  rxWorkouts: RxBuilderWorkout[] = [],
  notes: CalendarNote[] = [],
  events: CalendarEvent[] = []
): Promise<ApiResponse<IntervalsPlanFolderCreationResult>> {
  try {
    logger.debug(
      'Creating Intervals.icu PLAN folder from TP plan:',
      trainingPlan.planId,
      trainingPlan.title
    );

    const startDateLocal = buildIntervalsPlanStartDateLocal(
      trainingPlan,
      workouts,
      rxWorkouts,
      notes,
      events
    );
    const payload = buildIntervalsPlanFolderPayload(
      trainingPlan,
      startDateLocal
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

    const curlCommand = generateCurlCommand(url, requestOptions);
    console.log(formatCurlForConsole(curlCommand));
    logger.debug('Generated cURL command:', curlCommand);

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

    const json = await response.json();
    const folder = IntervalsFolderResponseSchema.parse(json);

    logger.info(
      'Successfully created Intervals.icu PLAN folder:',
      folder.id,
      'start:',
      startDateLocal
    );
    return {
      success: true,
      data: {
        folder,
        start_date_local: startDateLocal,
      },
    };
  } catch (error) {
    logger.error('Failed to create Intervals.icu PLAN folder:', error);
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

/**
 * Export TP plan workouts into an Intervals.icu PLAN folder.
 *
 * Intervals plan scheduling semantics observed:
 * - `day` is a zero-based offset from the plan `start_date_local` Monday
 * - fixed-day workouts use `for_week: false`
 * - `days` remains omitted until semantics are confirmed
 */
export async function exportPlanWorkoutsToIntervalsPlan(
  workouts: PlanWorkout[],
  planFolderId: number,
  planStartDateLocal: string,
  onItemExported?: PlanSectionItemProgressCallback
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  try {
    if (workouts.length === 0) {
      return { success: true, data: [] };
    }

    logger.debug(
      'Exporting TP plan workouts to Intervals PLAN folder:',
      workouts.length,
      'folder:',
      planFolderId
    );

    const planAnchorMondayUtc = parseTpDateToUtcMidnight(planStartDateLocal);
    if (!planAnchorMondayUtc) {
      return {
        success: false,
        error: {
          message: `Invalid planStartDateLocal: ${planStartDateLocal}`,
          code: 'EXPORT_ERROR',
        },
      };
    }

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    for (const workout of workouts) {
      try {
        const payload = buildPlanWorkoutPayload(
          workout,
          planFolderId,
          planAnchorMondayUtc
        );
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

        const curlCommand = generateCurlCommand(url, requestOptions);
        console.log(formatCurlForConsole(curlCommand));
        logger.debug('Generated cURL command:', curlCommand);

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
              message: `Failed to export plan workout "${workout.title}": ${response.status}`,
              code: 'API_ERROR',
              status: response.status,
            },
          };
        }

        const json = await response.json();
        const validated = IntervalsWorkoutResponseSchema.parse(json);
        results.push(validated);
        await onItemExported?.({
          current: results.length,
          total: workouts.length,
          itemName: payload.name,
        });
      } catch (error) {
        logger.error(
          `Failed to export plan workout "${workout.title}":`,
          error
        );
        return {
          success: false,
          error: {
            message: `Failed to export plan workout "${workout.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'EXPORT_ERROR',
          },
        };
      }
    }

    logger.info(
      'Successfully exported workouts to Intervals.icu PLAN folder:',
      results.length
    );
    return { success: true, data: results };
  } catch (error) {
    logger.error('Failed to export TP plan workouts to Intervals.icu:', error);
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
 * Export TP RxBuilder (structured strength) workouts into an Intervals.icu PLAN folder.
 *
 * MVP mapping:
 * - Intervals type: WeightTraining
 * - description: textual strength summary (exercises + instructions)
 * - day: zero-based offset from plan start date
 */
export async function exportRxBuilderWorkoutsToIntervalsPlan(
  workouts: RxBuilderWorkout[],
  planFolderId: number,
  planStartDateLocal: string,
  onItemExported?: PlanSectionItemProgressCallback
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  try {
    if (workouts.length === 0) {
      return { success: true, data: [] };
    }

    logger.debug(
      'Exporting TP RxBuilder workouts to Intervals PLAN folder:',
      workouts.length,
      'folder:',
      planFolderId
    );

    const planAnchorMondayUtc = parseTpDateToUtcMidnight(planStartDateLocal);
    if (!planAnchorMondayUtc) {
      return {
        success: false,
        error: {
          message: `Invalid planStartDateLocal: ${planStartDateLocal}`,
          code: 'EXPORT_ERROR',
        },
      };
    }

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    for (const workout of workouts) {
      try {
        const payload = buildRxBuilderPlanWorkoutPayload(
          workout,
          planFolderId,
          planAnchorMondayUtc
        );
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

        const curlCommand = generateCurlCommand(url, requestOptions);
        console.log(formatCurlForConsole(curlCommand));
        logger.debug('Generated cURL command:', curlCommand);

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
              message: `Failed to export RxBuilder workout "${workout.title}": ${response.status}`,
              code: 'API_ERROR',
              status: response.status,
            },
          };
        }

        const json = await response.json();
        const validated = IntervalsWorkoutResponseSchema.parse(json);
        results.push(validated);
        await onItemExported?.({
          current: results.length,
          total: workouts.length,
          itemName: payload.name,
        });
      } catch (error) {
        logger.error(
          `Failed to export RxBuilder workout "${workout.title}":`,
          error
        );
        return {
          success: false,
          error: {
            message: `Failed to export RxBuilder workout "${workout.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'EXPORT_ERROR',
          },
        };
      }
    }

    logger.info(
      'Successfully exported RxBuilder workouts to Intervals.icu PLAN folder:',
      results.length
    );
    return { success: true, data: results };
  } catch (error) {
    logger.error(
      'Failed to export TP RxBuilder workouts to Intervals.icu:',
      error
    );
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
 * Export TP plan notes into an Intervals.icu PLAN folder as NOTE items.
 *
 * Observed Intervals payload shape (same /workouts endpoint):
 * { name, description, type: "NOTE", color, day, folder_id }
 */
export async function exportPlanNotesToIntervalsPlan(
  notes: CalendarNote[],
  planFolderId: number,
  planStartDateLocal: string,
  onItemExported?: PlanSectionItemProgressCallback
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  try {
    if (notes.length === 0) {
      return { success: true, data: [] };
    }

    logger.debug(
      'Exporting TP plan notes to Intervals PLAN folder:',
      notes.length,
      'folder:',
      planFolderId
    );

    const planAnchorMondayUtc = parseTpDateToUtcMidnight(planStartDateLocal);
    if (!planAnchorMondayUtc) {
      return {
        success: false,
        error: {
          message: `Invalid planStartDateLocal: ${planStartDateLocal}`,
          code: 'EXPORT_ERROR',
        },
      };
    }

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    for (const note of notes) {
      try {
        const payload = buildPlanNotePayload(
          note,
          planFolderId,
          planAnchorMondayUtc
        );
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

        const curlCommand = generateCurlCommand(url, requestOptions);
        console.log(formatCurlForConsole(curlCommand));
        logger.debug('Generated cURL command:', curlCommand);

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
              message: `Failed to export plan note "${note.title}": ${response.status}`,
              code: 'API_ERROR',
              status: response.status,
            },
          };
        }

        const json = await response.json();
        const validated = IntervalsWorkoutResponseSchema.parse(json);
        results.push(validated);
        await onItemExported?.({
          current: results.length,
          total: notes.length,
          itemName: payload.name,
        });
      } catch (error) {
        logger.error(`Failed to export plan note "${note.title}":`, error);
        return {
          success: false,
          error: {
            message: `Failed to export plan note "${note.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'EXPORT_ERROR',
          },
        };
      }
    }

    logger.info(
      'Successfully exported plan notes to Intervals.icu:',
      results.length
    );
    return { success: true, data: results };
  } catch (error) {
    logger.error('Failed to export TP plan notes to Intervals.icu:', error);
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
 * Export TP plan events into an Intervals.icu PLAN folder as race markers.
 *
 * Payload uses the same /workouts endpoint with category "RACE_A".
 */
export async function exportPlanEventsToIntervalsPlan(
  events: CalendarEvent[],
  planFolderId: number,
  planStartDateLocal: string,
  onItemExported?: PlanSectionItemProgressCallback
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  try {
    if (events.length === 0) {
      return { success: true, data: [] };
    }

    logger.debug(
      'Exporting TP plan events to Intervals PLAN folder:',
      events.length,
      'folder:',
      planFolderId
    );

    const planAnchorMondayUtc = parseTpDateToUtcMidnight(planStartDateLocal);
    if (!planAnchorMondayUtc) {
      return {
        success: false,
        error: {
          message: `Invalid planStartDateLocal: ${planStartDateLocal}`,
          code: 'EXPORT_ERROR',
        },
      };
    }

    const athleteResponse = await getCurrentAthlete();
    if (!athleteResponse.success) {
      return athleteResponse;
    }
    const athleteId = athleteResponse.data.id;
    logger.debug('Using athlete ID:', athleteId);

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

    for (const event of events) {
      try {
        const payload = buildPlanEventPayload(
          event,
          planFolderId,
          planAnchorMondayUtc
        );
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

        const curlCommand = generateCurlCommand(url, requestOptions);
        console.log(formatCurlForConsole(curlCommand));
        logger.debug('Generated cURL command:', curlCommand);

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
              message: `Failed to export plan event "${event.name}": ${response.status}`,
              code: 'API_ERROR',
              status: response.status,
            },
          };
        }

        const json = await response.json();
        const validated = IntervalsWorkoutResponseSchema.parse(json);
        results.push(validated);
        await onItemExported?.({
          current: results.length,
          total: events.length,
          itemName: payload.name,
        });
      } catch (error) {
        logger.error(`Failed to export plan event "${event.name}":`, error);
        return {
          success: false,
          error: {
            message: `Failed to export plan event "${event.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'EXPORT_ERROR',
          },
        };
      }
    }

    logger.info(
      'Successfully exported plan events to Intervals.icu:',
      results.length
    );
    return { success: true, data: results };
  } catch (error) {
    logger.error('Failed to export TP plan events to Intervals.icu:', error);
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
 * End-to-end TP training plan -> Intervals reusable PLAN export.
 *
 * Creates the PLAN folder (using TP title as the plan name) and then uploads
 * the supplied classic TP plan workouts into that folder with zero-based day
 * offsets.
 */
export async function exportTrainingPlanToIntervalsPlan(
  trainingPlan: TrainingPlan,
  workouts: PlanWorkout[],
  rxWorkouts: RxBuilderWorkout[] = [],
  notes: CalendarNote[] = [],
  onProgress?: TrainingPlanExportProgressCallback,
  existingPlanAction?: IntervalsPlanConflictAction,
  events: CalendarEvent[] = []
): Promise<ApiResponse<IntervalsTrainingPlanExportResult>> {
  const overallTotal =
    1 + workouts.length + rxWorkouts.length + notes.length + events.length;
  let overallCurrent = 0;
  let classicExported = 0;
  let rxExported = 0;
  let notesExported = 0;
  let eventsExported = 0;

  const emit = async (
    progress: Omit<
      TrainingPlanExportProgressPayload,
      'overallCurrent' | 'overallTotal'
    >
  ): Promise<void> => {
    await notifyTrainingPlanExportProgress(onProgress, {
      ...progress,
      overallCurrent,
      overallTotal,
    });
  };

  await emit({
    phase: 'folder',
    status: 'started',
    current: 0,
    total: 1,
    message: 'Preparing Intervals.icu plan folder',
  });
  let folderResult: ApiResponse<IntervalsPlanFolderCreationResult>;
  const targetPlanName =
    typeof trainingPlan.title === 'string' &&
    trainingPlan.title.trim().length > 0
      ? trainingPlan.title.trim()
      : `TrainingPeaks Plan ${trainingPlan.planId}`;

  if (existingPlanAction === 'append' || existingPlanAction === 'replace') {
    await emit({
      phase: 'folder',
      status: 'progress',
      current: 0,
      total: 1,
      message: `Checking for existing Intervals plan named "${targetPlanName}"`,
    });

    const existingFolderResult =
      await findIntervalsPlanFolderByName(targetPlanName);
    if (!existingFolderResult.success) {
      await emit({
        phase: 'folder',
        status: 'failed',
        current: 0,
        total: 1,
        message: existingFolderResult.error.message,
      });
      return existingFolderResult;
    }

    const existingFolder = existingFolderResult.data;

    if (existingPlanAction === 'append' && existingFolder) {
      if (
        typeof existingFolder.start_date_local !== 'string' ||
        existingFolder.start_date_local.trim().length === 0
      ) {
        const errorResult: ApiResponse<IntervalsPlanFolderCreationResult> = {
          success: false,
          error: {
            message:
              'Cannot append to existing Intervals plan: missing start_date_local',
            code: 'EXPORT_ERROR',
          },
        };
        await emit({
          phase: 'folder',
          status: 'failed',
          current: 0,
          total: 1,
          message: errorResult.error.message,
        });
        return errorResult;
      }

      folderResult = {
        success: true,
        data: {
          folder: existingFolder,
          start_date_local: existingFolder.start_date_local,
        },
      };
      overallCurrent += 1;
      await emit({
        phase: 'folder',
        status: 'completed',
        current: 1,
        total: 1,
        itemName: existingFolder.name,
        message: 'Appending to existing Intervals plan',
      });
    } else {
      if (existingPlanAction === 'replace' && existingFolder) {
        await emit({
          phase: 'folder',
          status: 'progress',
          current: 0,
          total: 1,
          itemName: existingFolder.name,
          message: `Deleting existing plan before replace`,
        });

        const deleteResult = await deleteIntervalsFolder(existingFolder.id);
        if (!deleteResult.success) {
          await emit({
            phase: 'folder',
            status: 'failed',
            current: 0,
            total: 1,
            message: deleteResult.error.message,
          });
          return deleteResult;
        }
      }

      await emit({
        phase: 'folder',
        status: 'progress',
        current: 0,
        total: 1,
        message:
          existingPlanAction === 'append'
            ? 'No matching Intervals plan found, creating a new plan folder'
            : 'Creating Intervals.icu plan folder',
      });

      folderResult = await createIntervalsPlanFolder(
        trainingPlan,
        workouts,
        rxWorkouts,
        notes,
        events
      );
      if (!folderResult.success) {
        await emit({
          phase: 'folder',
          status: 'failed',
          current: 0,
          total: 1,
          message: folderResult.error.message,
        });
        return folderResult;
      }

      overallCurrent += 1;
      await emit({
        phase: 'folder',
        status: 'completed',
        current: 1,
        total: 1,
        itemName: folderResult.data.folder.name,
        message:
          existingPlanAction === 'replace'
            ? 'Existing plan replaced'
            : 'Plan folder created',
      });
    }
  } else {
    folderResult = await createIntervalsPlanFolder(
      trainingPlan,
      workouts,
      rxWorkouts,
      notes,
      events
    );
    if (!folderResult.success) {
      await emit({
        phase: 'folder',
        status: 'failed',
        current: 0,
        total: 1,
        message: folderResult.error.message,
      });
      return folderResult;
    }
    overallCurrent += 1;
    await emit({
      phase: 'folder',
      status: 'completed',
      current: 1,
      total: 1,
      itemName: folderResult.data.folder.name,
      message: 'Plan folder created',
    });
  }

  await emit({
    phase: 'classicWorkouts',
    status: workouts.length > 0 ? 'started' : 'completed',
    current: 0,
    total: workouts.length,
    message:
      workouts.length > 0
        ? 'Exporting classic workouts'
        : 'No classic workouts to export',
  });

  const workoutsResult = await exportPlanWorkoutsToIntervalsPlan(
    workouts,
    folderResult.data.folder.id,
    folderResult.data.start_date_local,
    async ({ current, total, itemName }) => {
      classicExported = current;
      overallCurrent += 1;
      await emit({
        phase: 'classicWorkouts',
        status: current === total ? 'completed' : 'progress',
        current,
        total,
        itemName,
      });
    }
  );
  if (!workoutsResult.success) {
    await emit({
      phase: 'classicWorkouts',
      status: 'failed',
      current: classicExported,
      total: workouts.length,
      message: workoutsResult.error.message,
    });
    return workoutsResult;
  }

  await emit({
    phase: 'rxWorkouts',
    status: rxWorkouts.length > 0 ? 'started' : 'completed',
    current: 0,
    total: rxWorkouts.length,
    message:
      rxWorkouts.length > 0
        ? 'Exporting RxBuilder strength workouts'
        : 'No RxBuilder strength workouts to export',
  });

  const rxWorkoutsResult = await exportRxBuilderWorkoutsToIntervalsPlan(
    rxWorkouts,
    folderResult.data.folder.id,
    folderResult.data.start_date_local,
    async ({ current, total, itemName }) => {
      rxExported = current;
      overallCurrent += 1;
      await emit({
        phase: 'rxWorkouts',
        status: current === total ? 'completed' : 'progress',
        current,
        total,
        itemName,
      });
    }
  );
  if (!rxWorkoutsResult.success) {
    await emit({
      phase: 'rxWorkouts',
      status: 'failed',
      current: rxExported,
      total: rxWorkouts.length,
      message: rxWorkoutsResult.error.message,
    });
    return rxWorkoutsResult;
  }

  await emit({
    phase: 'notes',
    status: notes.length > 0 ? 'started' : 'completed',
    current: 0,
    total: notes.length,
    message: notes.length > 0 ? 'Exporting notes' : 'No notes to export',
  });

  const notesResult = await exportPlanNotesToIntervalsPlan(
    notes,
    folderResult.data.folder.id,
    folderResult.data.start_date_local,
    async ({ current, total, itemName }) => {
      notesExported = current;
      overallCurrent += 1;
      await emit({
        phase: 'notes',
        status: current === total ? 'completed' : 'progress',
        current,
        total,
        itemName,
      });
    }
  );
  if (!notesResult.success) {
    await emit({
      phase: 'notes',
      status: 'failed',
      current: notesExported,
      total: notes.length,
      message: notesResult.error.message,
    });
    return notesResult;
  }

  await emit({
    phase: 'events',
    status: events.length > 0 ? 'started' : 'completed',
    current: 0,
    total: events.length,
    message: events.length > 0 ? 'Exporting events' : 'No events to export',
  });

  const eventsResult = await exportPlanEventsToIntervalsPlan(
    events,
    folderResult.data.folder.id,
    folderResult.data.start_date_local,
    async ({ current, total, itemName }) => {
      eventsExported = current;
      overallCurrent += 1;
      await emit({
        phase: 'events',
        status: current === total ? 'completed' : 'progress',
        current,
        total,
        itemName,
      });
    }
  );
  if (!eventsResult.success) {
    await emit({
      phase: 'events',
      status: 'failed',
      current: eventsExported,
      total: events.length,
      message: eventsResult.error.message,
    });
    return eventsResult;
  }

  await emit({
    phase: 'complete',
    status: 'completed',
    current: overallCurrent,
    total: overallTotal,
    message: 'Training plan export completed',
  });

  return {
    success: true,
    data: {
      folder: folderResult.data.folder,
      workouts: [
        ...workoutsResult.data,
        ...rxWorkoutsResult.data,
        ...notesResult.data,
        ...eventsResult.data,
      ],
      start_date_local: folderResult.data.start_date_local,
    },
  };
}

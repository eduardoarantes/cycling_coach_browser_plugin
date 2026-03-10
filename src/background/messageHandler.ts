/**
 * Message handler for background service worker
 *
 * Handles messages from content scripts and popup
 */

import type {
  RuntimeMessage,
  TrainingPlanExportProgressMessage,
  TrainingPlanExportProgressPayload,
} from '@/types';
import type {
  UserProfile,
  Library,
  LibraryItem,
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
  RxBuilderWorkout,
  ApiResponse,
} from '@/types/api.types';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import type {
  PlanMyPeakCreatePlanNoteRequest,
  PlanMyPeakCreateTrainingPlanRequest,
  PlanMyPeakSaveTrainingPlanResponse,
  PlanMyPeakTrainingPlanNote,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import { logger } from '@/utils/logger';
import {
  API_BASE_URL,
  STORAGE_KEYS,
  createApiHeaders,
} from '@/utils/constants';
import { getSupabaseUrl } from '@/services/portConfigService';
import {
  fetchUser,
  fetchLibraries,
  fetchLibraryItems,
  fetchTrainingPlans,
  fetchPlanWorkouts,
  fetchPlanNotes,
  fetchPlanEvents,
  fetchRxBuilderWorkouts,
} from './api/trainingPeaks';
import {
  fetchPlanMyPeakLibraries,
  fetchPlanMyPeakWorkoutBySourceId,
  createPlanMyPeakLibrary,
  deletePlanMyPeakLibrary,
  createPlanMyPeakTrainingPlan,
  createPlanMyPeakTrainingPlanNote,
  exportWorkoutsToPlanMyPeakLibrary,
} from './api/planMyPeak';
import {
  createIntervalsFolder,
  deleteIntervalsFolder,
  findIntervalsLibraryFolderByName,
  findIntervalsPlanFolderByName,
  exportTrainingPlanToIntervalsPlan,
  exportWorkoutsToLibrary,
} from './api/intervalsicu';
import {
  setIntervalsApiKey,
  getIntervalsApiKey,
  hasIntervalsApiKey,
  clearIntervalsApiKey,
} from '@/services/intervalsApiKeyService';
import {
  getLogs as getDebugLogs,
  clearLogs as clearDebugLogs,
} from '@/services/debugLogService';
import type { ApiLogEntry } from '@/types/debugLog.types';
import type {
  IntervalsFolderResponse,
  IntervalsTrainingPlanExportResult,
  IntervalsWorkoutResponse,
} from '@/types/intervalsicu.types';

type MessageResponse =
  | { success: true }
  | { success: false; error: string }
  | { token: string | null; timestamp: number | null }
  | { valid: boolean; userId?: number | string }
  | { apiKey: string | null }
  | { hasKey: boolean }
  | { logs: ApiLogEntry[] }
  | ApiResponse<UserProfile>
  | ApiResponse<Library[]>
  | ApiResponse<PlanMyPeakLibrary[]>
  | ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
  | ApiResponse<PlanMyPeakWorkoutLibraryItem | null>
  | ApiResponse<LibraryItem[]>
  | ApiResponse<TrainingPlan[]>
  | ApiResponse<PlanWorkout[]>
  | ApiResponse<CalendarNote[]>
  | ApiResponse<CalendarEvent[]>
  | ApiResponse<IntervalsFolderResponse>
  | ApiResponse<IntervalsFolderResponse | null>
  | ApiResponse<IntervalsTrainingPlanExportResult>
  | ApiResponse<IntervalsWorkoutResponse[]>
  | ApiResponse<PlanMyPeakLibrary>
  | ApiResponse<PlanMyPeakSaveTrainingPlanResponse>
  | ApiResponse<PlanMyPeakTrainingPlanNote>
  | ApiResponse<null>;

/**
 * Handle TOKEN_FOUND message from content script
 */
async function handleTokenFound(
  token: string,
  timestamp: number
): Promise<void> {
  try {
    logger.info('Storing TrainingPeaks authentication token');
    logger.debug('Token timestamp:', new Date(timestamp).toISOString());

    // Store token in chrome.storage.local
    await chrome.storage.local.set({
      auth_token: token,
      token_timestamp: timestamp,
    });

    logger.info('TrainingPeaks authentication token stored successfully');

    // Verify storage (debug)
    const stored = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    logger.debug('Stored token verification:', {
      hasToken: !!stored.auth_token,
      hasTimestamp: !!stored.token_timestamp,
    });
  } catch (error) {
    logger.error('❌ Failed to store token:', error);
    throw error;
  }
}

/**
 * Handle MY_PEAK_AUTH_FOUND message from content script
 *
 * Stores MyPeak/Supabase auth details observed in browser requests.
 * `apiKey` may be captured before an authenticated user token, so both fields
 * are stored independently and only updated when present.
 */
async function handleMyPeakAuthFound(
  token: string | null | undefined,
  apiKey: string | null | undefined,
  timestamp: number
): Promise<void> {
  try {
    const payload: Record<string, string | number> = {};

    if (typeof apiKey === 'string' && apiKey.length > 0) {
      payload[STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY] = apiKey;
      logger.info('Stored MyPeak Supabase API key from browser request');
    }

    if (typeof token === 'string' && token.length > 0) {
      payload[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] = token;
      payload[STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP] = timestamp;
      logger.info('Stored MyPeak authentication token from browser request');
      logger.debug(
        'MyPeak token timestamp:',
        new Date(timestamp).toISOString()
      );
    }

    if (Object.keys(payload).length === 0) {
      logger.debug('No MyPeak auth fields to store (message ignored)');
      return;
    }

    await chrome.storage.local.set(payload);
    logger.info('✅ MyPeak auth details stored successfully');
  } catch (error) {
    logger.error('❌ Failed to store MyPeak auth details:', error);
    throw error;
  }
}

/**
 * Handle GET_TOKEN message from popup
 */
async function handleGetToken(): Promise<{
  token: string | null;
  timestamp: number | null;
}> {
  try {
    const data = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    return {
      token: (data.auth_token as string) || null,
      timestamp: (data.token_timestamp as number) || null,
    };
  } catch (error) {
    logger.error('Failed to retrieve token:', error);
    throw error;
  }
}

/**
 * Handle CLEAR_TOKEN message from popup
 */
async function handleClearToken(): Promise<void> {
  try {
    await chrome.storage.local.remove(['auth_token', 'token_timestamp']);
    logger.info('Token cleared');
  } catch (error) {
    logger.error('Failed to clear token:', error);
    throw error;
  }
}

/**
 * Handle VALIDATE_TOKEN message from popup
 * Validates token by calling TrainingPeaks API from background context (bypasses CORS)
 */
async function handleValidateToken(): Promise<{
  valid: boolean;
  userId?: number;
}> {
  try {
    logger.debug('Starting token validation...');

    // Get token from storage
    const data = await chrome.storage.local.get(['auth_token']);
    const token = data.auth_token as string | undefined;

    logger.debug('Has token:', !!token);

    if (!token) {
      logger.debug('No token to validate');
      return { valid: false };
    }

    // Call TrainingPeaks API from background context (has host_permissions)
    const endpoint = `${API_BASE_URL}/users/v3/user`;
    logger.debug('Calling API:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: createApiHeaders(token),
    });

    logger.debug('Response status:', response.status);
    logger.debug('Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      logger.info('Token is valid, User ID:', data.user?.userId);
      return { valid: true, userId: data.user?.userId };
    }

    // Token validation failed
    if (response.status === 401) {
      logger.warn('Token validation returned 401 (token expired)');
    } else {
      logger.error('Token validation failed - Status:', response.status);
    }

    if (response.status === 401) {
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TOKEN_TIMESTAMP,
      ]);
      logger.warn('Cleared TrainingPeaks auth token after VALIDATE_TOKEN 401');
    }

    logger.warn('Token validation failed');

    return { valid: false };
  } catch (error) {
    logger.error('Error validating token:', error);
    // On network error, don't clear token (might be temporary)
    return { valid: false };
  }
}

/**
 * Handle VALIDATE_MY_PEAK_TOKEN message from popup
 *
 * Validates MyPeak auth by calling the local Supabase user endpoint.
 * Requires both a captured user access token and Supabase anon API key.
 */
async function handleValidateMyPeakToken(): Promise<{
  valid: boolean;
  userId?: string;
}> {
  try {
    logger.debug('Starting MyPeak/Supabase token validation...');

    const data = await chrome.storage.local.get([
      STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
      STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY,
    ]);

    const token = data[STORAGE_KEYS.MYPEAK_AUTH_TOKEN] as string | undefined;
    const apiKey = data[STORAGE_KEYS.MYPEAK_SUPABASE_API_KEY] as
      | string
      | undefined;

    if (!token) {
      logger.debug('No MyPeak auth token to validate');
      return { valid: false };
    }

    if (!apiKey) {
      logger.debug('No MyPeak Supabase API key captured yet');
      return { valid: false };
    }

    // Use dynamic Supabase URL based on configured port (for local development)
    const supabaseUrl = await getSupabaseUrl();
    const endpoint = `${supabaseUrl}/auth/v1/user`;
    logger.debug('Validating MyPeak token via Supabase endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        apikey: apiKey,
      },
    });

    if (response.ok) {
      const user = (await response.json()) as { id?: string };
      logger.info('MyPeak token is valid, Supabase user:', user?.id);
      return { valid: true, userId: user?.id };
    }

    const errorText = await response.text();
    logger.warn(
      'MyPeak token validation failed - Status:',
      response.status,
      'Response:',
      errorText
    );

    if (response.status === 401) {
      await chrome.storage.local.remove([
        STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
        STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
      ]);
      logger.warn('Cleared MyPeak auth token after VALIDATE_MY_PEAK_TOKEN 401');
    }

    return { valid: false };
  } catch (error) {
    logger.error('Error validating MyPeak token:', error);
    return { valid: false };
  }
}

/**
 * Handle GET_USER message from popup
 * Fetches user profile from TrainingPeaks API
 */
async function handleGetUser(): Promise<ApiResponse<UserProfile>> {
  logger.debug('Handling GET_USER message');
  return await fetchUser();
}

/**
 * Handle GET_LIBRARIES message from popup
 * Fetches libraries list from TrainingPeaks API
 */
async function handleGetLibraries(): Promise<ApiResponse<Library[]>> {
  logger.debug('Handling GET_LIBRARIES message');
  return await fetchLibraries();
}

/**
 * Handle GET_PLANMYPEAK_LIBRARIES message from popup
 * Fetches workout libraries from PlanMyPeak API
 */
async function handleGetPlanMyPeakLibraries(): Promise<
  ApiResponse<PlanMyPeakLibrary[]>
> {
  logger.debug('Handling GET_PLANMYPEAK_LIBRARIES message');
  return await fetchPlanMyPeakLibraries();
}

/**
 * Handle CREATE_PLANMYPEAK_LIBRARY message from popup
 * Creates a workout library in PlanMyPeak
 */
async function handleCreatePlanMyPeakLibrary(
  name: string,
  sourceId?: string | null
): Promise<ApiResponse<PlanMyPeakLibrary>> {
  logger.debug('Handling CREATE_PLANMYPEAK_LIBRARY message:', name);
  return await createPlanMyPeakLibrary(name, sourceId);
}

/**
 * Handle DELETE_PLANMYPEAK_LIBRARY message from popup
 * Deletes a workout library in PlanMyPeak
 */
async function handleDeletePlanMyPeakLibrary(
  libraryId: string
): Promise<ApiResponse<null>> {
  logger.debug('Handling DELETE_PLANMYPEAK_LIBRARY message:', libraryId);
  return await deletePlanMyPeakLibrary(libraryId);
}

/**
 * Handle EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY message from popup
 * Uploads transformed workouts to a PlanMyPeak library
 */
async function handleExportWorkoutsToPlanMyPeakLibrary(
  workouts: PlanMyPeakWorkout[],
  libraryId: string
): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem[]>> {
  logger.debug(
    'Handling EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY message:',
    workouts.length,
    'workouts -> library',
    libraryId
  );
  return await exportWorkoutsToPlanMyPeakLibrary(workouts, libraryId);
}

/**
 * Handle GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID message from popup
 * Finds a PlanMyPeak workout by source_id (optionally constrained to a library)
 */
async function handleGetPlanMyPeakWorkoutBySourceId(
  sourceId: string,
  libraryId?: string
): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem | null>> {
  logger.debug(
    'Handling GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID message:',
    sourceId,
    'library:',
    libraryId ?? '(any)'
  );
  return await fetchPlanMyPeakWorkoutBySourceId(sourceId, libraryId);
}

/**
 * Handle CREATE_PLANMYPEAK_TRAINING_PLAN message from popup
 * Creates a training plan template in PlanMyPeak
 */
async function handleCreatePlanMyPeakTrainingPlan(
  payload: PlanMyPeakCreateTrainingPlanRequest
): Promise<ApiResponse<PlanMyPeakSaveTrainingPlanResponse>> {
  logger.debug(
    'Handling CREATE_PLANMYPEAK_TRAINING_PLAN message:',
    payload.metadata.name
  );
  return await createPlanMyPeakTrainingPlan(payload);
}

/**
 * Handle CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE message from popup
 * Adds a note to a specific week/day in a PlanMyPeak training plan
 */
async function handleCreatePlanMyPeakTrainingPlanNote(
  planId: string,
  payload: PlanMyPeakCreatePlanNoteRequest
): Promise<ApiResponse<PlanMyPeakTrainingPlanNote>> {
  logger.debug(
    'Handling CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE message:',
    planId,
    payload.week_number,
    payload.day_of_week
  );
  return await createPlanMyPeakTrainingPlanNote(planId, payload);
}

/**
 * Handle GET_LIBRARY_ITEMS message from popup
 * Fetches library items from TrainingPeaks API
 */
async function handleGetLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  logger.debug('Handling GET_LIBRARY_ITEMS message for library:', libraryId);
  return await fetchLibraryItems(libraryId);
}

/**
 * Handle GET_TRAINING_PLANS message from popup
 * Fetches training plans list from TrainingPeaks API
 */
async function handleGetTrainingPlans(): Promise<ApiResponse<TrainingPlan[]>> {
  logger.debug('Handling GET_TRAINING_PLANS message');
  return await fetchTrainingPlans();
}

/**
 * Handle GET_PLAN_WORKOUTS message from popup
 * Fetches plan workouts from TrainingPeaks API
 */
async function handleGetPlanWorkouts(
  planId: number
): Promise<ApiResponse<PlanWorkout[]>> {
  logger.debug('Handling GET_PLAN_WORKOUTS message for plan:', planId);
  return await fetchPlanWorkouts(planId);
}

/**
 * Handle GET_PLAN_NOTES message from popup
 * Fetches plan notes from TrainingPeaks API
 */
async function handleGetPlanNotes(
  planId: number
): Promise<ApiResponse<CalendarNote[]>> {
  logger.debug('Handling GET_PLAN_NOTES message for plan:', planId);
  return await fetchPlanNotes(planId);
}

/**
 * Handle GET_PLAN_EVENTS message from popup
 * Fetches plan events from TrainingPeaks API
 */
async function handleGetPlanEvents(
  planId: number
): Promise<ApiResponse<CalendarEvent[]>> {
  logger.debug('Handling GET_PLAN_EVENTS message for plan:', planId);
  return await fetchPlanEvents(planId);
}

/**
 * Handle GET_RX_BUILDER_WORKOUTS message from popup
 * Fetches RxBuilder (structured strength) workouts from TrainingPeaks API
 */
async function handleGetRxBuilderWorkouts(
  planId: number
): Promise<ApiResponse<RxBuilderWorkout[]>> {
  logger.debug('Handling GET_RX_BUILDER_WORKOUTS message for plan:', planId);
  return await fetchRxBuilderWorkouts(planId);
}

/**
 * Handle CREATE_INTERVALS_FOLDER message from popup
 * Creates a folder on Intervals.icu for library organization
 */
async function handleCreateIntervalsFolder(
  libraryName: string,
  description?: string
): Promise<ApiResponse<IntervalsFolderResponse>> {
  logger.debug('Handling CREATE_INTERVALS_FOLDER message:', libraryName);
  return await createIntervalsFolder(libraryName, description);
}

/**
 * Handle EXPORT_WORKOUTS_TO_LIBRARY message from popup
 * Exports workouts to Intervals.icu as library templates (NOT calendar events)
 */
async function handleExportWorkoutsToLibrary(
  workouts: LibraryItem[],
  folderId?: number
): Promise<ApiResponse<IntervalsWorkoutResponse[]>> {
  logger.debug('Handling EXPORT_WORKOUTS_TO_LIBRARY message');
  return await exportWorkoutsToLibrary(workouts, folderId);
}

/**
 * Handle EXPORT_TRAINING_PLAN_TO_INTERVALS message from popup
 * Creates an Intervals reusable PLAN folder and exports TP plan items.
 */
async function handleExportTrainingPlanToIntervals(
  trainingPlan: TrainingPlan,
  workouts: PlanWorkout[],
  rxWorkouts: RxBuilderWorkout[] = [],
  notes: CalendarNote[] = [],
  events: CalendarEvent[] = [],
  exportId?: string,
  existingPlanAction?: 'replace' | 'append'
): Promise<ApiResponse<IntervalsTrainingPlanExportResult>> {
  logger.debug(
    'Handling EXPORT_TRAINING_PLAN_TO_INTERVALS message for plan:',
    trainingPlan.planId,
    trainingPlan.title,
    'workouts:',
    workouts.length,
    'rxWorkouts:',
    rxWorkouts.length,
    'notes:',
    notes.length,
    'events:',
    events.length
  );
  const emitProgress = async (
    progress: TrainingPlanExportProgressPayload
  ): Promise<void> => {
    if (!exportId) {
      return;
    }

    const progressMessage: TrainingPlanExportProgressMessage = {
      type: 'TRAINING_PLAN_EXPORT_PROGRESS',
      exportId,
      progress,
    };

    try {
      await chrome.runtime.sendMessage(progressMessage);
    } catch (error) {
      // Popup may close during export; progress updates are best-effort.
      logger.debug('Training plan export progress dispatch skipped:', error);
    }
  };

  return await exportTrainingPlanToIntervalsPlan(
    trainingPlan,
    workouts,
    rxWorkouts,
    notes,
    emitProgress,
    existingPlanAction,
    events
  );
}

async function handleFindIntervalsPlanFolderByName(
  planName: string
): Promise<ApiResponse<IntervalsFolderResponse | null>> {
  logger.debug('Handling FIND_INTERVALS_PLAN_FOLDER_BY_NAME:', planName);
  return await findIntervalsPlanFolderByName(planName);
}

async function handleFindIntervalsLibraryFolderByName(
  folderName: string
): Promise<ApiResponse<IntervalsFolderResponse | null>> {
  logger.debug('Handling FIND_INTERVALS_LIBRARY_FOLDER_BY_NAME:', folderName);
  return await findIntervalsLibraryFolderByName(folderName);
}

async function handleDeleteIntervalsFolder(
  folderId: number
): Promise<ApiResponse<null>> {
  logger.debug('Handling DELETE_INTERVALS_FOLDER:', folderId);
  return await deleteIntervalsFolder(folderId);
}

/**
 * Handle SET_INTERVALS_API_KEY message from popup
 * Stores Intervals.icu API key in chrome.storage
 */
async function handleSetIntervalsApiKey(
  apiKey: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await setIntervalsApiKey(apiKey);
    return { success: true };
  } catch (error) {
    logger.error('Failed to set Intervals.icu API key:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle GET_INTERVALS_API_KEY message from popup
 * Retrieves Intervals.icu API key from chrome.storage
 */
async function handleGetIntervalsApiKey(): Promise<{ apiKey: string | null }> {
  const apiKey = await getIntervalsApiKey();
  return { apiKey };
}

/**
 * Handle HAS_INTERVALS_API_KEY message from popup
 * Checks if Intervals.icu API key exists in chrome.storage
 */
async function handleHasIntervalsApiKey(): Promise<{ hasKey: boolean }> {
  const hasKey = await hasIntervalsApiKey();
  return { hasKey };
}

/**
 * Handle CLEAR_INTERVALS_API_KEY message from popup
 * Removes Intervals.icu API key from chrome.storage
 */
async function handleClearIntervalsApiKey(): Promise<{ success: true }> {
  await clearIntervalsApiKey();
  return { success: true };
}

/**
 * Handle GET_DEBUG_LOGS message from popup
 * Retrieves TrainingPeaks API call logs from chrome.storage
 */
async function handleGetDebugLogs(): Promise<{ logs: ApiLogEntry[] }> {
  const logs = await getDebugLogs();
  return { logs };
}

/**
 * Handle CLEAR_DEBUG_LOGS message from popup
 * Removes all TrainingPeaks API call logs from chrome.storage
 */
async function handleClearDebugLogs(): Promise<{ success: true }> {
  await clearDebugLogs();
  return { success: true };
}

/**
 * Main message router
 */
export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  logger.debug('Background received message:', message.type, 'from:', sender);

  switch (message.type) {
    case 'TOKEN_FOUND':
      await handleTokenFound(message.token, message.timestamp);
      return { success: true };

    case 'MY_PEAK_AUTH_FOUND':
      await handleMyPeakAuthFound(
        message.token,
        message.apiKey,
        message.timestamp
      );
      return { success: true };

    case 'GET_TOKEN':
      return await handleGetToken();

    case 'CLEAR_TOKEN':
      await handleClearToken();
      return { success: true };

    case 'VALIDATE_TOKEN':
      return await handleValidateToken();

    case 'VALIDATE_MY_PEAK_TOKEN':
      return await handleValidateMyPeakToken();

    case 'GET_USER':
      return await handleGetUser();

    case 'GET_LIBRARIES':
      return await handleGetLibraries();

    case 'GET_PLANMYPEAK_LIBRARIES':
      return await handleGetPlanMyPeakLibraries();

    case 'CREATE_PLANMYPEAK_LIBRARY':
      return await handleCreatePlanMyPeakLibrary(
        message.name,
        message.sourceId
      );

    case 'DELETE_PLANMYPEAK_LIBRARY':
      return await handleDeletePlanMyPeakLibrary(message.libraryId);

    case 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY':
      return await handleExportWorkoutsToPlanMyPeakLibrary(
        message.workouts,
        message.libraryId
      );

    case 'GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID':
      return await handleGetPlanMyPeakWorkoutBySourceId(
        message.sourceId,
        message.libraryId
      );

    case 'CREATE_PLANMYPEAK_TRAINING_PLAN':
      return await handleCreatePlanMyPeakTrainingPlan(message.payload);

    case 'CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE':
      return await handleCreatePlanMyPeakTrainingPlanNote(
        message.planId,
        message.payload
      );

    case 'GET_LIBRARY_ITEMS':
      return await handleGetLibraryItems(message.libraryId);

    case 'GET_TRAINING_PLANS':
      return await handleGetTrainingPlans();

    case 'GET_PLAN_WORKOUTS':
      return await handleGetPlanWorkouts(message.planId);

    case 'GET_PLAN_NOTES':
      return await handleGetPlanNotes(message.planId);

    case 'GET_PLAN_EVENTS':
      return await handleGetPlanEvents(message.planId);

    case 'GET_RX_BUILDER_WORKOUTS':
      return await handleGetRxBuilderWorkouts(message.planId);

    case 'CREATE_INTERVALS_FOLDER':
      return await handleCreateIntervalsFolder(
        message.libraryName,
        message.description
      );

    case 'EXPORT_WORKOUTS_TO_LIBRARY':
      return await handleExportWorkoutsToLibrary(
        message.workouts,
        message.folderId
      );

    case 'EXPORT_TRAINING_PLAN_TO_INTERVALS':
      return await handleExportTrainingPlanToIntervals(
        message.trainingPlan,
        message.workouts,
        message.rxWorkouts ?? [],
        message.notes ?? [],
        message.events ?? [],
        message.exportId,
        message.existingPlanAction
      );

    case 'FIND_INTERVALS_PLAN_FOLDER_BY_NAME':
      return await handleFindIntervalsPlanFolderByName(message.planName);

    case 'FIND_INTERVALS_LIBRARY_FOLDER_BY_NAME':
      return await handleFindIntervalsLibraryFolderByName(message.folderName);

    case 'DELETE_INTERVALS_FOLDER':
      return await handleDeleteIntervalsFolder(message.folderId);

    case 'TRAINING_PLAN_EXPORT_PROGRESS':
      // Background can receive its own progress broadcasts. Ignore quietly.
      return { success: true };

    case 'SET_INTERVALS_API_KEY':
      return await handleSetIntervalsApiKey(message.apiKey);

    case 'GET_INTERVALS_API_KEY':
      return await handleGetIntervalsApiKey();

    case 'HAS_INTERVALS_API_KEY':
      return await handleHasIntervalsApiKey();

    case 'CLEAR_INTERVALS_API_KEY':
      return await handleClearIntervalsApiKey();

    case 'GET_DEBUG_LOGS':
      return await handleGetDebugLogs();

    case 'CLEAR_DEBUG_LOGS':
      return await handleClearDebugLogs();

    default:
      logger.warn('Unknown message type received');
      return { success: false, error: 'Unknown message type' };
  }
}

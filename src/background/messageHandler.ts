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
import { logger } from '@/utils/logger';
import {
  API_BASE_URL,
  STORAGE_KEYS,
  createApiHeaders,
} from '@/utils/constants';
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
} from '@/services/intervalsApiKeyService';
import type {
  IntervalsFolderResponse,
  IntervalsTrainingPlanExportResult,
  IntervalsWorkoutResponse,
} from '@/types/intervalsicu.types';

type MessageResponse =
  | { success: true }
  | { success: false; error: string }
  | { token: string | null; timestamp: number | null }
  | { valid: boolean; userId?: number }
  | { apiKey: string | null }
  | { hasKey: boolean }
  | ApiResponse<UserProfile>
  | ApiResponse<Library[]>
  | ApiResponse<LibraryItem[]>
  | ApiResponse<TrainingPlan[]>
  | ApiResponse<PlanWorkout[]>
  | ApiResponse<CalendarNote[]>
  | ApiResponse<CalendarEvent[]>
  | ApiResponse<IntervalsFolderResponse>
  | ApiResponse<IntervalsFolderResponse | null>
  | ApiResponse<IntervalsTrainingPlanExportResult>
  | ApiResponse<IntervalsWorkoutResponse[]>
  | ApiResponse<null>;

/**
 * Handle TOKEN_FOUND message from content script
 */
async function handleTokenFound(
  token: string,
  timestamp: number
): Promise<void> {
  try {
    logger.info('🎫 Storing bearer token, length:', token.length);
    logger.info('📅 Token timestamp:', new Date(timestamp).toISOString());

    // Store token in chrome.storage.local
    await chrome.storage.local.set({
      auth_token: token,
      token_timestamp: timestamp,
    });

    logger.info('✅ Token stored successfully in chrome.storage.local');

    // Verify storage (debug)
    const stored = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    logger.info('🔍 Verification - Token exists:', !!stored.auth_token);
    logger.info(
      '🔍 Verification - Timestamp exists:',
      !!stored.token_timestamp
    );
  } catch (error) {
    logger.error('❌ Failed to store token:', error);
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
    console.log('[TP Extension - Background] 🔍 Starting token validation...');
    logger.debug('Starting token validation...');

    // Get token from storage
    const data = await chrome.storage.local.get(['auth_token']);
    const token = data.auth_token as string | undefined;

    console.log('[TP Extension - Background] Has token:', !!token);
    logger.debug('Has token:', !!token);

    if (!token) {
      console.log('[TP Extension - Background] ❌ No token to validate');
      logger.debug('No token to validate');
      return { valid: false };
    }

    console.log('[TP Extension - Background] Token length:', token.length);
    logger.debug('Token length:', token.length);

    // Call TrainingPeaks API from background context (has host_permissions)
    const endpoint = `${API_BASE_URL}/users/v3/user`;
    console.log('[TP Extension - Background] 🌐 Calling API:', endpoint);
    logger.debug('Calling API:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: createApiHeaders(token),
    });

    console.log(
      '[TP Extension - Background] 📡 Response status:',
      response.status
    );
    console.log('[TP Extension - Background] Response ok:', response.ok);
    logger.debug('Response status:', response.status);
    logger.debug('Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log(
        '[TP Extension - Background] ✅ Token is valid! User ID:',
        data.user?.userId
      );
      logger.info('Token is valid, User ID:', data.user?.userId);
      return { valid: true, userId: data.user?.userId };
    }

    // Token validation failed
    const errorText = await response.text();
    if (response.status === 401) {
      console.warn(
        '[TP Extension - Background] ⚠️ Token validation returned 401 (expected when token expires) - Response:',
        errorText
      );
      logger.warn('Token validation returned 401 (token expired)');
    } else {
      console.error(
        '[TP Extension - Background] ❌ Token validation failed - Status:',
        response.status,
        'Response:',
        errorText
      );
      logger.error(
        'Token validation failed - Status:',
        response.status,
        'Response:',
        errorText
      );
    }

    if (response.status === 401) {
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TOKEN_TIMESTAMP,
      ]);
      logger.warn('Cleared TrainingPeaks auth token after VALIDATE_TOKEN 401');
    }

    console.log('[TP Extension - Background] ⚠️ Token validation failed');
    logger.warn('Token validation failed');

    return { valid: false };
  } catch (error) {
    console.error(
      '[TP Extension - Background] ❌ ERROR validating token:',
      error
    );
    logger.error('Error validating token:', error);
    // On network error, don't clear token (might be temporary)
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

    case 'GET_TOKEN':
      return await handleGetToken();

    case 'CLEAR_TOKEN':
      await handleClearToken();
      return { success: true };

    case 'VALIDATE_TOKEN':
      return await handleValidateToken();

    case 'GET_USER':
      return await handleGetUser();

    case 'GET_LIBRARIES':
      return await handleGetLibraries();

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

    default:
      logger.warn('Unknown message type received');
      return { success: false, error: 'Unknown message type' };
  }
}

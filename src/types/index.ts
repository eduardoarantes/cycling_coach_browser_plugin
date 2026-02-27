/**
 * Type definitions for the extension
 */

import type { LibraryItem } from '@/schemas/library.schema';
import type {
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/schemas/trainingPlan.schema';
import type { RxBuilderWorkout } from '@/schemas/rxBuilder.schema';
import type {
  PlanMyPeakCreatePlanNoteRequest,
  PlanMyPeakCreateTrainingPlanRequest,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import type {
  IntervalsFolderResponse,
  IntervalsPlanConflictAction,
} from '@/types/intervalsicu.types';

/**
 * Message types for chrome.runtime messaging
 */
export interface TokenFoundMessage {
  type: 'TOKEN_FOUND';
  token: string;
  timestamp: number;
}

export interface MyPeakAuthFoundMessage {
  type: 'MY_PEAK_AUTH_FOUND';
  timestamp: number;
  token?: string | null;
  apiKey?: string | null;
}

export interface GetTokenMessage {
  type: 'GET_TOKEN';
}

export interface ClearTokenMessage {
  type: 'CLEAR_TOKEN';
}

export interface ValidateTokenMessage {
  type: 'VALIDATE_TOKEN';
}

export interface ValidateMyPeakTokenMessage {
  type: 'VALIDATE_MY_PEAK_TOKEN';
}

export interface GetPlanMyPeakLibrariesMessage {
  type: 'GET_PLANMYPEAK_LIBRARIES';
}

export interface CreatePlanMyPeakLibraryMessage {
  type: 'CREATE_PLANMYPEAK_LIBRARY';
  name: string;
  sourceId?: string | null;
}

export interface DeletePlanMyPeakLibraryMessage {
  type: 'DELETE_PLANMYPEAK_LIBRARY';
  libraryId: string;
}

/**
 * Message to export transformed workouts to a PlanMyPeak workout library
 */
export interface ExportWorkoutsToPlanMyPeakLibraryMessage {
  type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY';
  workouts: PlanMyPeakWorkout[];
  libraryId: string;
}

export interface GetPlanMyPeakWorkoutBySourceIdMessage {
  type: 'GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID';
  sourceId: string;
  libraryId?: string;
}

export interface CreatePlanMyPeakTrainingPlanMessage {
  type: 'CREATE_PLANMYPEAK_TRAINING_PLAN';
  payload: PlanMyPeakCreateTrainingPlanRequest;
}

export interface CreatePlanMyPeakTrainingPlanNoteMessage {
  type: 'CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE';
  planId: string;
  payload: PlanMyPeakCreatePlanNoteRequest;
}

/**
 * Message to request user profile from API
 */
export interface GetUserMessage {
  type: 'GET_USER';
}

/**
 * Message to request libraries list from API
 */
export interface GetLibrariesMessage {
  type: 'GET_LIBRARIES';
}

/**
 * Message to request library items from API
 */
export interface GetLibraryItemsMessage {
  type: 'GET_LIBRARY_ITEMS';
  libraryId: number;
}

/**
 * Message to request training plans list from API
 */
export interface GetTrainingPlansMessage {
  type: 'GET_TRAINING_PLANS';
}

/**
 * Message to request plan workouts from API
 */
export interface GetPlanWorkoutsMessage {
  type: 'GET_PLAN_WORKOUTS';
  planId: number;
}

/**
 * Message to request plan notes from API
 */
export interface GetPlanNotesMessage {
  type: 'GET_PLAN_NOTES';
  planId: number;
}

/**
 * Message to request plan events from API
 */
export interface GetPlanEventsMessage {
  type: 'GET_PLAN_EVENTS';
  planId: number;
}

/**
 * Message to request RxBuilder (structured strength) workouts from API
 */
export interface GetRxBuilderWorkoutsMessage {
  type: 'GET_RX_BUILDER_WORKOUTS';
  planId: number;
}

/**
 * Message to create Intervals.icu folder
 */
export interface CreateIntervalsFolderMessage {
  type: 'CREATE_INTERVALS_FOLDER';
  libraryName: string;
  description?: string;
}

/**
 * Message to export workouts to Intervals.icu library
 */
export interface ExportWorkoutsToLibraryMessage {
  type: 'EXPORT_WORKOUTS_TO_LIBRARY';
  workouts: LibraryItem[];
  folderId?: number;
}

/**
 * Message to export a TrainingPeaks training plan to an Intervals.icu PLAN folder
 */
export interface ExportTrainingPlanToIntervalsMessage {
  type: 'EXPORT_TRAINING_PLAN_TO_INTERVALS';
  trainingPlan: TrainingPlan;
  workouts: PlanWorkout[];
  rxWorkouts?: RxBuilderWorkout[];
  notes?: CalendarNote[];
  events?: CalendarEvent[];
  /** Correlates background progress events back to the active popup export */
  exportId?: string;
  /** Existing Intervals plan conflict strategy (when name already exists) */
  existingPlanAction?: IntervalsPlanConflictAction;
}

/**
 * Message to find an existing Intervals.icu PLAN folder by exact name
 */
export interface FindIntervalsPlanFolderByNameMessage {
  type: 'FIND_INTERVALS_PLAN_FOLDER_BY_NAME';
  planName: string;
}

/**
 * Message to find an existing Intervals.icu library folder by exact name
 */
export interface FindIntervalsLibraryFolderByNameMessage {
  type: 'FIND_INTERVALS_LIBRARY_FOLDER_BY_NAME';
  folderName: string;
}

/**
 * Message to delete an Intervals.icu folder/plan by id
 */
export interface DeleteIntervalsFolderMessage {
  type: 'DELETE_INTERVALS_FOLDER';
  folderId: number;
}

export type TrainingPlanExportProgressPhase =
  | 'folder'
  | 'classicWorkouts'
  | 'rxWorkouts'
  | 'notes'
  | 'events'
  | 'complete';

export type TrainingPlanExportProgressStatus =
  | 'started'
  | 'progress'
  | 'completed'
  | 'failed';

export interface TrainingPlanExportProgressPayload {
  phase: TrainingPlanExportProgressPhase;
  status: TrainingPlanExportProgressStatus;
  current: number;
  total: number;
  overallCurrent: number;
  overallTotal: number;
  itemName?: string;
  message?: string;
}

/**
 * Background -> popup progress event for Intervals training plan export.
 */
export interface TrainingPlanExportProgressMessage {
  type: 'TRAINING_PLAN_EXPORT_PROGRESS';
  exportId: string;
  progress: TrainingPlanExportProgressPayload;
}

/**
 * Message to set Intervals.icu API key
 */
export interface SetIntervalsApiKeyMessage {
  type: 'SET_INTERVALS_API_KEY';
  apiKey: string;
}

/**
 * Message to get Intervals.icu API key
 */
export interface GetIntervalsApiKeyMessage {
  type: 'GET_INTERVALS_API_KEY';
}

/**
 * Message to check if Intervals.icu API key exists
 */
export interface HasIntervalsApiKeyMessage {
  type: 'HAS_INTERVALS_API_KEY';
}

/**
 * Message to clear Intervals.icu API key
 */
export interface ClearIntervalsApiKeyMessage {
  type: 'CLEAR_INTERVALS_API_KEY';
}

export type RuntimeMessage =
  | TokenFoundMessage
  | MyPeakAuthFoundMessage
  | GetTokenMessage
  | ClearTokenMessage
  | ValidateTokenMessage
  | ValidateMyPeakTokenMessage
  | GetPlanMyPeakLibrariesMessage
  | CreatePlanMyPeakLibraryMessage
  | DeletePlanMyPeakLibraryMessage
  | ExportWorkoutsToPlanMyPeakLibraryMessage
  | GetPlanMyPeakWorkoutBySourceIdMessage
  | CreatePlanMyPeakTrainingPlanMessage
  | CreatePlanMyPeakTrainingPlanNoteMessage
  | GetUserMessage
  | GetLibrariesMessage
  | GetLibraryItemsMessage
  | GetTrainingPlansMessage
  | GetPlanWorkoutsMessage
  | GetPlanNotesMessage
  | GetPlanEventsMessage
  | GetRxBuilderWorkoutsMessage
  | CreateIntervalsFolderMessage
  | ExportWorkoutsToLibraryMessage
  | ExportTrainingPlanToIntervalsMessage
  | FindIntervalsPlanFolderByNameMessage
  | FindIntervalsLibraryFolderByNameMessage
  | DeleteIntervalsFolderMessage
  | TrainingPlanExportProgressMessage
  | SetIntervalsApiKeyMessage
  | GetIntervalsApiKeyMessage
  | HasIntervalsApiKeyMessage
  | ClearIntervalsApiKeyMessage;

export interface FindIntervalsPlanFolderByNameResponse {
  exists: boolean;
  folder: IntervalsFolderResponse | null;
}

/**
 * Token storage structure
 */
export interface TokenStorage {
  auth_token: string | null;
  token_timestamp: number | null;
}

export interface MyPeakTokenStorage {
  mypeak_auth_token: string | null;
  mypeak_token_timestamp: number | null;
  mypeak_supabase_api_key: string | null;
}

/**
 * Re-export LibraryItem from schema for convenience
 */
export type { LibraryItem } from '@/schemas/library.schema';

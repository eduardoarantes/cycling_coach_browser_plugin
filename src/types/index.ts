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
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';
import type {
  PlanMyPeakCoach,
  PlanMyPeakIngestAthleteGroupsResponse,
} from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import type {
  PlanMyPeakCreatePlanEntryRequest,
  PlanMyPeakCreatePlanRequest,
} from '@/background/api/planMyPeak';
import type {
  IntervalsFolderResponse,
  IntervalsPlanConflictAction,
} from '@/types/intervalsicu.types';
import type { SiteControlRequest } from '@/types/siteControl.types';
import type {
  CapturedWorkoutRecord,
  CapturedWorkoutStatus,
} from '@/schemas/capturedWorkout.schema';
import type {
  AuthRefreshProvider,
  AuthRefreshResult,
} from '@/services/authRefreshService';

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

/**
 * Refresh a provider's captured token by opening a temporary background tab
 * on the site and closing it once the token lands. Never touches the coach's
 * own tabs. Handled in the background so it completes if the popup closes.
 */
export interface RefreshProviderAuthMessage {
  type: 'REFRESH_PROVIDER_AUTH';
  provider: AuthRefreshProvider;
}

export type { AuthRefreshProvider, AuthRefreshResult };

export interface GetPlanMyPeakLibrariesMessage {
  type: 'GET_PLANMYPEAK_LIBRARIES';
}

export interface CreatePlanMyPeakLibraryMessage {
  type: 'CREATE_PLANMYPEAK_LIBRARY';
  name: string;
  description?: string | null;
}

export interface DeletePlanMyPeakLibraryMessage {
  type: 'DELETE_PLANMYPEAK_LIBRARY';
  libraryId: string;
}

/** List workouts, optionally scoped to a library and/or a provider. */
export interface GetPlanMyPeakWorkoutsMessage {
  type: 'GET_PLANMYPEAK_WORKOUTS';
  libraryId?: string;
  provider?: string;
  providerWorkoutId?: string;
}

/**
 * Remove one workout. Used when reconciling a library on Replace, since a
 * library holding workouts cannot be deleted and recreated.
 */
export interface DeletePlanMyPeakWorkoutMessage {
  type: 'DELETE_PLANMYPEAK_WORKOUT';
  workoutId: string;
}

/**
 * Message to export transformed workouts to a PlanMyPeak workout library
 */
export interface ExportWorkoutsToPlanMyPeakLibraryMessage {
  type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY';
  workouts: PlanMyPeakWorkout[];
  libraryId: string;
  /**
   * Captured-workout record key by `provider_workout_id`. When present, the
   * background upload loop writes each workout's outcome to its record right
   * after its POST, so a popup that closes mid-send loses nothing.
   */
  capturedKeys?: Record<string, string>;
}

/**
 * A workout create/update observed on TrainingPeaks by the main-world
 * interceptor and relayed by the isolated bridge. Carries the parsed request
 * and response bodies only — never headers.
 */
export interface WorkoutCapturedMessage {
  type: 'WORKOUT_CAPTURED';
  kind: 'create' | 'update';
  athleteId: number;
  workoutId: number;
  request: unknown;
  response: unknown;
  timestamp: number;
}

export interface GetCapturedWorkoutsMessage {
  type: 'GET_CAPTURED_WORKOUTS';
}

export interface UpdateCapturedWorkoutMessage {
  type: 'UPDATE_CAPTURED_WORKOUT';
  key: string;
  status?: CapturedWorkoutStatus;
  planMyPeakWorkoutId?: string;
  planMyPeakLibraryName?: string;
  /** A string records the error; `null` clears it. */
  lastSendError?: string | null;
}

export interface RemoveCapturedWorkoutsMessage {
  type: 'REMOVE_CAPTURED_WORKOUTS';
  statuses: CapturedWorkoutStatus[];
}

export interface CapturedWorkoutsListResult {
  /** Newest first */
  records: CapturedWorkoutRecord[];
  pendingCount: number;
}

export interface RemoveCapturedWorkoutsResult {
  removed: number;
}

export type { CapturedWorkoutRecord, CapturedWorkoutStatus };

/**
 * Look a workout up by its TrainingPeaks id before writing it. Rarely needed,
 * since the workout POST is itself an upsert.
 */
export interface GetPlanMyPeakWorkoutByProviderIdMessage {
  type: 'GET_PLANMYPEAK_WORKOUT_BY_PROVIDER_ID';
  providerWorkoutId: string;
}

/** List the coach's TrainingPeaks plan folders, which carry their plan ids. */
export interface GetTrainingPlanFoldersMessage {
  type: 'GET_TRAINING_PLAN_FOLDERS';
}

/** List the coach's training-plan libraries (creates their default if absent). */
export interface GetPlanMyPeakPlanLibrariesMessage {
  type: 'GET_PLANMYPEAK_PLAN_LIBRARIES';
}

export interface CreatePlanMyPeakPlanLibraryMessage {
  type: 'CREATE_PLANMYPEAK_PLAN_LIBRARY';
  name: string;
  description?: string | null;
}

/** Create or update a plan, matched on provider identity. 201 created, 200 updated. */
export interface UpsertPlanMyPeakPlanMessage {
  type: 'UPSERT_PLANMYPEAK_PLAN';
  payload: PlanMyPeakCreatePlanRequest;
}

/** Shorten or rename a plan. Shortening past a scheduled week is a 409. */
export interface UpdatePlanMyPeakPlanMessage {
  type: 'UPDATE_PLANMYPEAK_PLAN';
  planId: string;
  payload: Partial<PlanMyPeakCreatePlanRequest>;
}

/** Read a plan with its schedule, for reconciling against the source. */
export interface GetPlanMyPeakPlanMessage {
  type: 'GET_PLANMYPEAK_PLAN';
  planId: string;
}

export interface GetPlanMyPeakPlansMessage {
  type: 'GET_PLANMYPEAK_PLANS';
  libraryId?: string;
  provider?: string;
  providerPlanId?: string;
}

/** Schedule or move one session. 201 scheduled, 200 moved. */
export interface UpsertPlanMyPeakPlanEntryMessage {
  type: 'UPSERT_PLANMYPEAK_PLAN_ENTRY';
  planId: string;
  payload: PlanMyPeakCreatePlanEntryRequest;
}

export interface DeletePlanMyPeakPlanEntryMessage {
  type: 'DELETE_PLANMYPEAK_PLAN_ENTRY';
  planId: string;
  entryId: string;
}

/**
 * Message to import (ingest) TrainingPeaks athlete groups into PlanMyPeak.
 * Forwards the raw TrainingPeaks groups payload verbatim.
 */
export interface ImportAthleteGroupsToPlanMyPeakMessage {
  type: 'IMPORT_ATHLETE_GROUPS_TO_PLANMYPEAK';
  groups: AthleteGroup[];
}

/**
 * Message to fetch the authenticated PlanMyPeak coach profile.
 */
export interface GetPlanMyPeakCoachMessage {
  type: 'GET_PLANMYPEAK_COACH';
}

export type { PlanMyPeakCoach, PlanMyPeakIngestAthleteGroupsResponse };

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
 * Message to request athlete groups (coach tags) from API
 */
export interface GetAthleteGroupsMessage {
  type: 'GET_ATHLETE_GROUPS';
  coachId: number;
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
  | 'plan'
  | 'entries'
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

/**
 * Message to get debug API logs
 */
export interface GetDebugLogsMessage {
  type: 'GET_DEBUG_LOGS';
}

/**
 * Message to clear debug API logs
 */
export interface ClearDebugLogsMessage {
  type: 'CLEAR_DEBUG_LOGS';
}

/**
 * Envelope carrying a validated PlanMyPeak site-control request from the
 * content-script bridge to the background worker.
 *
 * The page names a site-control request type, never a `RuntimeMessage` type, so
 * the page-reachable surface stays limited to `SiteControlRequestType` and does
 * not grow when handlers are added to the router below.
 */
export interface SiteControlRequestMessage {
  type: 'SITE_CONTROL_REQUEST';
  request: SiteControlRequest;
}

export type RuntimeMessage =
  | TokenFoundMessage
  | MyPeakAuthFoundMessage
  | GetTokenMessage
  | ClearTokenMessage
  | ValidateTokenMessage
  | ValidateMyPeakTokenMessage
  | RefreshProviderAuthMessage
  | GetPlanMyPeakLibrariesMessage
  | CreatePlanMyPeakLibraryMessage
  | DeletePlanMyPeakLibraryMessage
  | ExportWorkoutsToPlanMyPeakLibraryMessage
  | GetPlanMyPeakWorkoutByProviderIdMessage
  | DeletePlanMyPeakWorkoutMessage
  | GetPlanMyPeakWorkoutsMessage
  | GetTrainingPlanFoldersMessage
  | GetPlanMyPeakPlanLibrariesMessage
  | CreatePlanMyPeakPlanLibraryMessage
  | UpsertPlanMyPeakPlanMessage
  | UpdatePlanMyPeakPlanMessage
  | GetPlanMyPeakPlanMessage
  | GetPlanMyPeakPlansMessage
  | UpsertPlanMyPeakPlanEntryMessage
  | DeletePlanMyPeakPlanEntryMessage
  | ImportAthleteGroupsToPlanMyPeakMessage
  | GetPlanMyPeakCoachMessage
  | GetUserMessage
  | GetLibrariesMessage
  | GetLibraryItemsMessage
  | GetTrainingPlansMessage
  | GetAthleteGroupsMessage
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
  | ClearIntervalsApiKeyMessage
  | GetDebugLogsMessage
  | ClearDebugLogsMessage
  | WorkoutCapturedMessage
  | GetCapturedWorkoutsMessage
  | UpdateCapturedWorkoutMessage
  | RemoveCapturedWorkoutsMessage
  | SiteControlRequestMessage;

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

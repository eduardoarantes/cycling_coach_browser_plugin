/**
 * Type definitions for the extension
 */

/**
 * Message types for chrome.runtime messaging
 */
export interface TokenFoundMessage {
  type: 'TOKEN_FOUND';
  token: string;
  timestamp: number;
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

export type RuntimeMessage =
  | TokenFoundMessage
  | GetTokenMessage
  | ClearTokenMessage
  | ValidateTokenMessage
  | GetUserMessage
  | GetLibrariesMessage
  | GetLibraryItemsMessage
  | GetTrainingPlansMessage
  | GetPlanWorkoutsMessage
  | GetPlanNotesMessage
  | GetPlanEventsMessage
  | GetRxBuilderWorkoutsMessage;

/**
 * Token storage structure
 */
export interface TokenStorage {
  auth_token: string | null;
  token_timestamp: number | null;
}

/**
 * Re-export LibraryItem from schema for convenience
 */
export type { LibraryItem } from '@/schemas/library.schema';

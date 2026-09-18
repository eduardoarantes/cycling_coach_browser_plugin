/**
 * How the PlanMyPeak adapter reaches the PlanMyPeak API.
 *
 * The adapter runs in two places. In the popup and the overlay it cannot call
 * the API directly (no host permissions, no stored token) and sends runtime
 * messages to the background worker. In the background worker — where a
 * PlanMyPeak page's captured-workout import runs — a runtime message to itself
 * is never delivered, so the same adapter is given a transport that calls the
 * API client directly.
 *
 * One adapter, two transports: the transform, validation, library resolution
 * and outcome reporting are written once, so popup sends and page-driven
 * imports cannot drift apart.
 */

import type {
  CreatePlanMyPeakLibraryMessage,
  DeletePlanMyPeakLibraryMessage,
  DeletePlanMyPeakWorkoutMessage,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetPlanMyPeakLibrariesMessage,
  GetPlanMyPeakWorkoutsMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakUploadSummary } from '@/background/api/planMyPeak';

/**
 * Per-call options. `authRunId` lets a request recover a PlanMyPeak
 * credential; only the popup export sets it. A transport that cannot recover
 * (the background one used by page-driven imports) ignores it.
 */
export interface PlanMyPeakTransportCallOptions {
  authRunId?: string;
}

export interface PlanMyPeakTransport {
  getLibraries(
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<PlanMyPeakLibrary[]>>;
  createLibrary(
    name: string,
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<PlanMyPeakLibrary>>;
  deleteLibrary(
    libraryId: string,
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<null>>;
  getWorkouts(
    filters: {
      libraryId?: string;
      provider?: string;
    },
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem[]>>;
  deleteWorkout(
    workoutId: string,
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<null>>;
  uploadWorkouts(
    workouts: PlanMyPeakWorkout[],
    libraryId: string,
    capturedKeys?: Record<string, string>,
    options?: PlanMyPeakTransportCallOptions
  ): Promise<ApiResponse<PlanMyPeakUploadSummary>>;
}

/**
 * The run field for a message: present only when there is a run, so a
 * passive request is byte-for-byte what it was before runs existed.
 */
export function authRunField(authRunId: string | null | undefined): {
  authRunId?: string;
} {
  return authRunId ? { authRunId } : {};
}

/** The popup/overlay transport: every call is a runtime message. */
export const runtimeMessageTransport: PlanMyPeakTransport = {
  getLibraries: (options) =>
    chrome.runtime.sendMessage<
      GetPlanMyPeakLibrariesMessage,
      ApiResponse<PlanMyPeakLibrary[]>
    >({
      type: 'GET_PLANMYPEAK_LIBRARIES',
      ...authRunField(options?.authRunId),
    }),

  createLibrary: (name, options) =>
    chrome.runtime.sendMessage<
      CreatePlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakLibrary>
    >({
      type: 'CREATE_PLANMYPEAK_LIBRARY',
      name,
      ...authRunField(options?.authRunId),
    }),

  deleteLibrary: (libraryId, options) =>
    chrome.runtime.sendMessage<
      DeletePlanMyPeakLibraryMessage,
      ApiResponse<null>
    >({
      type: 'DELETE_PLANMYPEAK_LIBRARY',
      libraryId,
      ...authRunField(options?.authRunId),
    }),

  getWorkouts: (filters, options) =>
    chrome.runtime.sendMessage<
      GetPlanMyPeakWorkoutsMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
    >({
      type: 'GET_PLANMYPEAK_WORKOUTS',
      ...filters,
      ...authRunField(options?.authRunId),
    }),

  deleteWorkout: (workoutId, options) =>
    chrome.runtime.sendMessage<
      DeletePlanMyPeakWorkoutMessage,
      ApiResponse<null>
    >({
      type: 'DELETE_PLANMYPEAK_WORKOUT',
      workoutId,
      ...authRunField(options?.authRunId),
    }),

  uploadWorkouts: (workouts, libraryId, capturedKeys, options) => {
    const message: ExportWorkoutsToPlanMyPeakLibraryMessage = {
      type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
      workouts,
      libraryId,
      ...authRunField(options?.authRunId),
    };
    if (capturedKeys) {
      message.capturedKeys = capturedKeys;
    }
    return chrome.runtime.sendMessage<
      ExportWorkoutsToPlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakUploadSummary>
    >(message);
  },
};

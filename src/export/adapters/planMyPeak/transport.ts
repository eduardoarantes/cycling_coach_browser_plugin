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

export interface PlanMyPeakTransport {
  getLibraries(): Promise<ApiResponse<PlanMyPeakLibrary[]>>;
  createLibrary(name: string): Promise<ApiResponse<PlanMyPeakLibrary>>;
  deleteLibrary(libraryId: string): Promise<ApiResponse<null>>;
  getWorkouts(filters: {
    libraryId?: string;
    provider?: string;
  }): Promise<ApiResponse<PlanMyPeakWorkoutLibraryItem[]>>;
  deleteWorkout(workoutId: string): Promise<ApiResponse<null>>;
  uploadWorkouts(
    workouts: PlanMyPeakWorkout[],
    libraryId: string,
    capturedKeys?: Record<string, string>
  ): Promise<ApiResponse<PlanMyPeakUploadSummary>>;
}

/** The popup/overlay transport: every call is a runtime message. */
export const runtimeMessageTransport: PlanMyPeakTransport = {
  getLibraries: () =>
    chrome.runtime.sendMessage<
      GetPlanMyPeakLibrariesMessage,
      ApiResponse<PlanMyPeakLibrary[]>
    >({ type: 'GET_PLANMYPEAK_LIBRARIES' }),

  createLibrary: (name) =>
    chrome.runtime.sendMessage<
      CreatePlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakLibrary>
    >({ type: 'CREATE_PLANMYPEAK_LIBRARY', name }),

  deleteLibrary: (libraryId) =>
    chrome.runtime.sendMessage<
      DeletePlanMyPeakLibraryMessage,
      ApiResponse<null>
    >({ type: 'DELETE_PLANMYPEAK_LIBRARY', libraryId }),

  getWorkouts: (filters) =>
    chrome.runtime.sendMessage<
      GetPlanMyPeakWorkoutsMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
    >({ type: 'GET_PLANMYPEAK_WORKOUTS', ...filters }),

  deleteWorkout: (workoutId) =>
    chrome.runtime.sendMessage<
      DeletePlanMyPeakWorkoutMessage,
      ApiResponse<null>
    >({ type: 'DELETE_PLANMYPEAK_WORKOUT', workoutId }),

  uploadWorkouts: (workouts, libraryId, capturedKeys) => {
    const message: ExportWorkoutsToPlanMyPeakLibraryMessage = {
      type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
      workouts,
      libraryId,
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

/**
 * Shared fixtures for the captured-import tests: a stored record, the
 * `captured_workouts` map, and a fake of the PlanMyPeak upload loop that
 * honours `shouldContinue` / `onItemResult` the way the real one does.
 */

import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import type { ApiResponse } from '@/types/api.types';
import type {
  PlanMyPeakUploadItemResult,
  PlanMyPeakUploadSummary,
} from '@/background/api/planMyPeak';
import { STORAGE_KEYS } from '@/utils/constants';

export const DESTINATION = 'https://portal.planmypeak.com';
export const COACH_ID = 'coach-1';
export const OWNER = { coachId: COACH_ID, destination: DESTINATION };

const structure = {
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Work',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          openDuration: false,
          targets: [{ minValue: 88, maxValue: 93 }],
        },
      ],
    },
  ],
  primaryLengthMetric: 'duration',
  primaryIntensityMetric: 'percentOfFtp',
};

export function capturedRecord(
  workoutId: number,
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  const environment = overrides.environment ?? 'production';
  return {
    key: `${environment}:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment,
    capturedAt: workoutId,
    updatedAt: workoutId,
    status: 'pending',
    owner: OWNER,
    workout: {
      title: `Intervals ${workoutId}`,
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure,
      totalTimePlanned: 1,
      tssPlanned: 60,
      ifPlanned: 0.8,
      distancePlanned: null,
      caloriesPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
      userTags: null,
      lastModifiedDate: null,
    },
    ...overrides,
  } as CapturedWorkoutRecord;
}

export async function seedRecords(
  records: CapturedWorkoutRecord[]
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CAPTURED_WORKOUTS]: Object.fromEntries(
      records.map((record) => [record.key, record])
    ),
  });
}

export async function storedRecord(
  key: string
): Promise<CapturedWorkoutRecord | undefined> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_WORKOUTS);
  const map = (data[STORAGE_KEYS.CAPTURED_WORKOUTS] ?? {}) as Record<
    string,
    CapturedWorkoutRecord
  >;
  return map[key];
}

export const defaultLibrary: PlanMyPeakLibrary = {
  id: 'lib-default',
  name: 'My Library',
  description: null,
  isDefault: true,
  workoutCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export function remoteWorkout(
  providerWorkoutId: string
): PlanMyPeakWorkoutLibraryItem {
  return {
    id: `pmp-${providerWorkoutId}`,
    providerWorkoutId,
    workoutType: 'bike',
    library: { id: defaultLibrary.id, name: defaultLibrary.name },
  } as PlanMyPeakWorkoutLibraryItem;
}

type UploadOptions = {
  capturedKeys?: Record<string, string>;
  trackProgress?: boolean;
  onItemResult?: (result: PlanMyPeakUploadItemResult) => Promise<void> | void;
  shouldContinue?: () => Promise<{ ok: true } | { ok: false; reason: string }>;
};

/**
 * A stand-in for `exportWorkoutsToPlanMyPeakLibrary`. `failing` maps a
 * provider id to the error its POST returns; everything else lands.
 */
export function fakeUploadLoop(failing: Record<string, string> = {}) {
  return async (
    workouts: PlanMyPeakWorkout[],
    _libraryId: string,
    options?: UploadOptions
  ): Promise<ApiResponse<PlanMyPeakUploadSummary>> => {
    const summary: PlanMyPeakUploadSummary = {
      results: [],
      createdCount: 0,
      updatedCount: 0,
      destinationEmpty: false,
      failures: [],
    };
    let stopReason: string | null = null;

    for (const workout of workouts) {
      const providerWorkoutId = workout.provider_workout_id ?? '';
      if (stopReason === null && options?.shouldContinue) {
        const verdict = await options.shouldContinue();
        if (!verdict.ok) stopReason = verdict.reason;
      }

      const error = stopReason ?? failing[providerWorkoutId];
      if (error !== undefined) {
        summary.failures.push({
          providerWorkoutId,
          name: workout.name,
          message: error,
        });
        await options?.onItemResult?.({
          providerWorkoutId,
          name: workout.name,
          success: false,
          error,
        });
        continue;
      }

      summary.results.push({
        workout: remoteWorkout(providerWorkoutId),
        created: true,
        filedElsewhere: false,
      });
      summary.createdCount += 1;
      await options?.onItemResult?.({
        providerWorkoutId,
        name: workout.name,
        success: true,
        created: true,
      });
    }

    return { success: true, data: summary };
  };
}

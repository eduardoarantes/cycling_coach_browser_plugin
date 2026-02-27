import { describe, expect, it, vi } from 'vitest';
import type {
  CalendarNote,
  PlanWorkout,
  TrainingPlan,
} from '@/types/api.types';
import { exportTrainingPlanClassicWorkoutsToPlanMyPeak } from '@/export/adapters/planMyPeak/trainingPlanExport';

function makeTrainingPlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    planId: 624432,
    title: 'Base Plan',
    startDate: '2026-03-02T00:00:00',
    weekCount: 4,
    workoutCount: 2,
    description: 'Plan description',
  } as unknown as TrainingPlan & typeof overrides;
}

function makeStructuredWorkout(
  overrides: Partial<PlanWorkout> = {}
): PlanWorkout {
  return {
    workoutId: 1001,
    athleteId: 1,
    title: 'Endurance Ride',
    workoutTypeValueId: 2,
    code: null,
    workoutDay: '2026-03-03T00:00:00',
    startTime: null,
    startTimePlanned: null,
    isItAnOr: false,
    isHidden: false,
    completed: null,
    description: 'Plan workout description',
    userTags: null,
    coachComments: null,
    workoutComments: null,
    newComment: null,
    hasPrivateWorkoutNoteForCaller: false,
    publicSettingValue: 0,
    sharedWorkoutInformationKey: null,
    sharedWorkoutInformationExpireKey: null,
    distance: null,
    distancePlanned: null,
    distanceCustomized: null,
    distanceUnitsCustomized: null,
    totalTime: null,
    totalTimePlanned: 1.25,
    heartRateMinimum: null,
    heartRateMaximum: null,
    heartRateAverage: null,
    calories: null,
    caloriesPlanned: null,
    tssActual: null,
    tssPlanned: 65,
    tssSource: null,
    if: null,
    ifPlanned: 0.72,
    velocityAverage: null,
    velocityPlanned: null,
    velocityMaximum: null,
    normalizedSpeedActual: null,
    normalizedPowerActual: null,
    powerAverage: null,
    powerMaximum: null,
    energy: null,
    energyPlanned: null,
    elevationGain: null,
    elevationGainPlanned: null,
    elevationLoss: null,
    elevationMinimum: null,
    elevationAverage: null,
    elevationMaximum: null,
    torqueAverage: null,
    torqueMaximum: null,
    tempMin: null,
    tempAvg: null,
    tempMax: null,
    cadenceAverage: null,
    cadenceMaximum: null,
    lastModifiedDate: '2026-03-01T00:00:00',
    equipmentBikeId: null,
    equipmentShoeId: null,
    isLocked: null,
    complianceDurationPercent: null,
    complianceDistancePercent: null,
    complianceTssPercent: null,
    rpe: null,
    feeling: null,
    structure: {
      structure: [
        {
          type: 'step',
          length: { unit: 'repetition', value: 1 },
          steps: [
            {
              name: 'Warm up',
              intensityClass: 'warmUp',
              length: { unit: 'second', value: 600 },
              openDuration: false,
              targets: [{ minValue: 55, maxValue: 65 }],
            },
          ],
          begin: 0,
          end: 600,
        },
      ],
      primaryIntensityMetric: 'percentOfFtp',
      primaryLengthMetric: 'duration',
    },
    orderOnDay: 0,
    personalRecordCount: null,
    syncedTo: null,
    poolLengthOptionId: null,
    workoutSubTypeId: null,
    workoutDeviceSource: null,
    ...overrides,
  } as PlanWorkout;
}

function makeNote(overrides: Partial<CalendarNote> = {}): CalendarNote {
  return {
    id: 501,
    title: 'Nutrition reminder',
    description: 'Fuel before workout',
    noteDate: '2026-03-03T00:00:00',
    createdDate: '2026-03-01T00:00:00',
    modifiedDate: '2026-03-01T00:00:00',
    planId: 624432,
    attachments: [],
    ...overrides,
  };
}

describe('exportTrainingPlanClassicWorkoutsToPlanMyPeak', () => {
  it('deduplicates workouts by TP source_id and creates a training plan with note', async () => {
    const libraryId = 'library-shared';
    const workoutsBySource = new Map<
      string,
      { id: string; source_id: string }
    >();
    const createPlanPayloads: unknown[] = [];
    const createNotePayloads: unknown[] = [];
    const uploadCalls: unknown[] = [];
    const libraryCreateCalls: unknown[] = [];
    const progressUpdates: Array<{
      phase: string;
      status: string;
      current: number;
      total: number;
    }> = [];

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        const typed = message as { type: string; [key: string]: unknown };

        if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
          return { success: true, data: [] };
        }

        if (typed.type === 'CREATE_PLANMYPEAK_LIBRARY') {
          libraryCreateCalls.push(typed);
          return {
            success: true,
            data: {
              id: libraryId,
              name: typed.name,
              owner_id: 'user-1',
              is_system: false,
              is_default: false,
              source_id: typed.sourceId,
              created_at: '2026-02-27T00:00:00.000Z',
              updated_at: '2026-02-27T00:00:00.000Z',
            },
          };
        }

        if (typed.type === 'GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID') {
          const sourceId = typed.sourceId as string;
          const existing = workoutsBySource.get(sourceId) ?? null;
          return {
            success: true,
            data: existing
              ? {
                  id: existing.id,
                  name: 'Deduped Workout',
                  type: 'endurance',
                  intensity: 'moderate',
                  structure: {},
                  base_duration_min: 75,
                  base_tss: 65,
                  library_id: libraryId,
                  source_id: existing.source_id,
                }
              : null,
          };
        }

        if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
          uploadCalls.push(typed);
          const workout = (typed.workouts as Array<{ source_id: string }>)[0];
          const createdId = `wk-${workoutsBySource.size + 1}`;
          workoutsBySource.set(workout.source_id, {
            id: createdId,
            source_id: workout.source_id,
          });
          return {
            success: true,
            data: [
              {
                id: createdId,
                name: 'Created Workout',
                type: 'endurance',
                intensity: 'moderate',
                structure: {},
                base_duration_min: 75,
                base_tss: 65,
                library_id: libraryId,
                source_id: workout.source_id,
              },
            ],
          };
        }

        if (typed.type === 'CREATE_PLANMYPEAK_TRAINING_PLAN') {
          createPlanPayloads.push(typed.payload);
          return {
            success: true,
            data: {
              success: true,
              planId: 'plan-1',
              savedAt: '2026-02-27T00:00:00.000Z',
            },
          };
        }

        if (typed.type === 'CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE') {
          createNotePayloads.push(typed.payload);
          return {
            success: true,
            data: {
              id: 'note-1',
              training_plan_id: 'plan-1',
              week_number: 1,
              day_of_week: 1,
              title: 'Nutrition reminder',
              description: 'Fuel before workout',
              created_at: '2026-02-27T00:00:00.000Z',
              updated_at: '2026-02-27T00:00:00.000Z',
            },
          };
        }

        return {
          success: false,
          error: { message: `Unhandled message ${typed.type}` },
        };
      }
    );

    const workoutA = makeStructuredWorkout({
      workoutId: 1001,
      title: 'Workout A',
      workoutDay: '2026-03-03T00:00:00',
      orderOnDay: 0,
    });
    const workoutB = makeStructuredWorkout({
      workoutId: 1002,
      title: 'Workout B',
      workoutDay: '2026-03-05T00:00:00',
      orderOnDay: 0,
      // Same structure as workoutA -> should dedupe
      structure: workoutA.structure,
    });

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [workoutA, workoutB],
      notes: [makeNote()],
      config: {},
      onProgress: (update) => {
        progressUpdates.push({
          phase: update.phase,
          status: update.status,
          current: update.current,
          total: update.total,
        });
      },
    });

    expect(result.success).toBe(true);
    expect(uploadCalls).toHaveLength(1);
    expect(createPlanPayloads).toHaveLength(1);
    expect(createNotePayloads).toHaveLength(1);
    expect(libraryCreateCalls).toHaveLength(1);
    expect((libraryCreateCalls[0] as { sourceId: string }).sourceId).toBe(
      'TP:PLAN_WORKOUTS_V1'
    );

    const payload = createPlanPayloads[0] as {
      weeks: Array<{
        workouts: {
          tuesday: Array<{ workoutKey: string }>;
          thursday: Array<{ workoutKey: string }>;
        };
      }>;
    };

    expect(payload.weeks[0].workouts.tuesday).toHaveLength(1);
    expect(payload.weeks[0].workouts.thursday).toHaveLength(1);
    expect(payload.weeks[0].workouts.tuesday[0].workoutKey).toBe(
      payload.weeks[0].workouts.thursday[0].workoutKey
    );
    expect(progressUpdates.some((update) => update.phase === 'folder')).toBe(
      true
    );
    expect(
      progressUpdates.some((update) => update.phase === 'classicWorkouts')
    ).toBe(true);
    expect(progressUpdates.some((update) => update.phase === 'notes')).toBe(
      true
    );
    expect(progressUpdates[progressUpdates.length - 1]).toMatchObject({
      phase: 'complete',
      status: 'completed',
    });
  });

  it('reuses existing shared library and existing deduped workout', async () => {
    const libraryId = 'library-shared';
    const existingSourceIdRef = { value: '' };
    const uploadCalls: unknown[] = [];

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        const typed = message as { type: string; [key: string]: unknown };

        if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
          return {
            success: true,
            data: [
              {
                id: libraryId,
                name: 'Shared',
                owner_id: 'user-1',
                is_system: false,
                is_default: false,
                source_id: 'TP:PLAN_WORKOUTS_V1',
                created_at: '2026-02-27T00:00:00.000Z',
                updated_at: '2026-02-27T00:00:00.000Z',
              },
            ],
          };
        }

        if (typed.type === 'GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID') {
          existingSourceIdRef.value = typed.sourceId as string;
          return {
            success: true,
            data: {
              id: 'wk-existing',
              name: 'Existing Workout',
              type: 'endurance',
              intensity: 'moderate',
              structure: {},
              base_duration_min: 75,
              base_tss: 65,
              library_id: libraryId,
              source_id: typed.sourceId,
            },
          };
        }

        if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
          uploadCalls.push(typed);
          return { success: true, data: [] };
        }

        if (typed.type === 'CREATE_PLANMYPEAK_TRAINING_PLAN') {
          return {
            success: true,
            data: {
              success: true,
              planId: 'plan-2',
              savedAt: '2026-02-27T00:00:00.000Z',
            },
          };
        }

        return { success: true, data: { id: 'note-1' } };
      }
    );

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan({ planId: 624433, title: 'Second Plan' }),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(result.success).toBe(true);
    expect(existingSourceIdRef.value.startsWith('TP:')).toBe(true);
    expect(uploadCalls).toHaveLength(0);
  });
});

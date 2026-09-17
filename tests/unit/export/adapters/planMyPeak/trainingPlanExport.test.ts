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
    ...overrides,
  } as TrainingPlan;
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
  /** A PlanMyPeak workout as the API returns it, enough for the schemas we parse. */
  function pmpWorkout(id: string, libraryId: string) {
    return {
      id,
      name: 'Created Workout',
      description: null,
      workoutType: 'bike',
      rideType: 'endurance',
      summary: {
        segmentCount: 1,
        stepCount: 1,
        estimatedDurationSeconds: 4500,
      },
      profile: null,
      library: { id: libraryId, name: 'Shared' },
      provider: 'training_peaks',
      providerWorkoutId: '1001',
      providerMetadata: {},
      providerIntensityFactor: null,
      providerTss: null,
      createdAt: '2026-02-27T00:00:00.000Z',
      updatedAt: '2026-02-27T00:00:00.000Z',
    };
  }

  function pmpPlan(overrides: Record<string, unknown> = {}) {
    return {
      id: 'plan-1',
      name: 'Base Plan',
      description: 'Plan description',
      weekCount: 4,
      entryCount: 0,
      library: { id: 'plan-lib-1', name: 'My Training Plans' },
      provider: 'training_peaks',
      providerPlanId: '624432',
      providerMetadata: {},
      createdAt: '2026-02-27T00:00:00.000Z',
      updatedAt: '2026-02-27T00:00:00.000Z',
      ...overrides,
    };
  }

  /**
   * Wire up the whole message surface the export talks to, recording the calls
   * a test wants to assert on.
   */
  function mockPlanMyPeak(options: {
    existingEntries?: unknown[];
    planWeekCount?: number;
    planCreated?: boolean;
    folders?: unknown[];
    existingPlanLibraries?: unknown[];
    existingWorkoutLibraries?: unknown[];
  }) {
    const entryPayloads: Array<Record<string, unknown>> = [];
    const deletedEntryIds: string[] = [];
    const planPayloads: Array<Record<string, unknown>> = [];
    const planPatches: Array<Record<string, unknown>> = [];
    const createdPlanLibraryNames: string[] = [];
    const workoutLibraryCreateNames: string[] = [];
    const libraryId = 'library-shared';

    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        const typed = message as { type: string; [key: string]: unknown };

        switch (typed.type) {
          case 'CREATE_PLANMYPEAK_LIBRARY':
            workoutLibraryCreateNames.push(typed.name as string);
            return {
              success: true,
              data: {
                id: libraryId,
                name: typed.name as string,
                description: null,
                isDefault: false,
                workoutCount: 0,
                createdAt: '2026-02-27T00:00:00.000Z',
                updatedAt: '2026-02-27T00:00:00.000Z',
              },
            };
          case 'GET_PLANMYPEAK_LIBRARIES':
            return {
              success: true,
              data: options.existingWorkoutLibraries ?? [
                {
                  id: libraryId,
                  name: 'Base Plan',
                  description: null,
                  isDefault: false,
                  workoutCount: 0,
                  createdAt: '2026-02-27T00:00:00.000Z',
                  updatedAt: '2026-02-27T00:00:00.000Z',
                },
              ],
            };
          case 'GET_PLANMYPEAK_WORKOUT_BY_PROVIDER_ID':
            return { success: true, data: null };
          case 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY': {
            // Echo one result per submitted workout, carrying its provider
            // identity back — that is how the export maps them to entries.
            const submitted = typed.workouts as Array<{
              provider_workout_id: string;
            }>;
            return {
              success: true,
              data: {
                results: submitted.map((workout, index) => ({
                  workout: {
                    ...pmpWorkout(`wk-${index + 1}`, libraryId),
                    providerWorkoutId: workout.provider_workout_id,
                  },
                  created: true,
                  filedElsewhere: false,
                })),
                createdCount: submitted.length,
                updatedCount: 0,
                destinationEmpty: false,
                failures: [],
              },
            };
          }
          case 'GET_TRAINING_PLAN_FOLDERS':
            return { success: true, data: options.folders ?? [] };
          case 'GET_PLANMYPEAK_PLAN_LIBRARIES':
            return {
              success: true,
              data: options.existingPlanLibraries ?? [
                {
                  id: 'plan-lib-1',
                  name: 'My Training Plans',
                  description: null,
                  isDefault: true,
                  planCount: 0,
                  createdAt: '2026-02-27T00:00:00.000Z',
                  updatedAt: '2026-02-27T00:00:00.000Z',
                },
              ],
            };
          case 'CREATE_PLANMYPEAK_PLAN_LIBRARY':
            createdPlanLibraryNames.push(typed.name as string);
            return {
              success: true,
              data: {
                id: 'plan-lib-new',
                name: typed.name as string,
                description: null,
                isDefault: false,
                planCount: 0,
                createdAt: '2026-02-27T00:00:00.000Z',
                updatedAt: '2026-02-27T00:00:00.000Z',
              },
            };
          case 'UPSERT_PLANMYPEAK_PLAN':
            planPayloads.push(typed.payload as Record<string, unknown>);
            return {
              success: true,
              data: {
                value: pmpPlan({
                  weekCount: options.planWeekCount ?? 4,
                }),
                created: options.planCreated ?? true,
              },
            };
          case 'GET_PLANMYPEAK_PLAN':
            return {
              success: true,
              data: {
                ...pmpPlan({ weekCount: options.planWeekCount ?? 4 }),
                entries: options.existingEntries ?? [],
              },
            };
          case 'UPSERT_PLANMYPEAK_PLAN_ENTRY':
            entryPayloads.push(typed.payload as Record<string, unknown>);
            return {
              success: true,
              data: {
                value: {
                  id: `entry-${entryPayloads.length}`,
                  planId: 'plan-1',
                  weekNumber: 1,
                  dayOfWeek: 1,
                  position: 0,
                  note: null,
                  workout: pmpWorkout('wk-1', libraryId),
                  provider: 'training_peaks',
                  providerEntryId: String(
                    (typed.payload as { providerEntryId?: string })
                      .providerEntryId
                  ),
                  createdAt: '2026-02-27T00:00:00.000Z',
                  updatedAt: '2026-02-27T00:00:00.000Z',
                },
                created: true,
              },
            };
          case 'DELETE_PLANMYPEAK_PLAN_ENTRY':
            deletedEntryIds.push(typed.entryId as string);
            return { success: true, data: null };
          case 'UPDATE_PLANMYPEAK_PLAN':
            planPatches.push(typed.payload as Record<string, unknown>);
            return { success: true, data: pmpPlan() };
          default:
            return { success: true, data: null };
        }
      }
    );

    return {
      entryPayloads,
      deletedEntryIds,
      planPayloads,
      planPatches,
      createdPlanLibraryNames,
      workoutLibraryCreateNames,
    };
  }

  it('schedules each workout as a plan entry carrying its TrainingPeaks identity', async () => {
    const calls = mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(result.success).toBe(true);
    expect(calls.entryPayloads).toHaveLength(1);

    const entry = calls.entryPayloads[0];
    expect(entry.providerEntryId).toBe('1001');
    expect(entry.provider).toBe('training_peaks');
    // 2026-03-02 is a Monday, so 2026-03-03 is Tuesday: ISO day 2, week 1.
    expect(entry.weekNumber).toBe(1);
    expect(entry.dayOfWeek).toBe(2);
  });

  // TrainingPeaks leaves startDate null on plans that were never scheduled. The
  // plan is still importable: its first dated session is the week the coach sees
  // as week 1.
  it('anchors week 1 on the earliest session when the plan has no start date', async () => {
    const calls = mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan({ startDate: null, endDate: null }),
      workouts: [
        makeStructuredWorkout(),
        makeStructuredWorkout({
          workoutId: 1002,
          workoutDay: '2026-03-10T00:00:00',
        }),
      ],
      notes: [],
      config: {},
    });

    expect(result.success).toBe(true);
    // 2026-03-03 is the earliest session, so its week is week 1 and the session
    // a week later falls in week 2.
    expect(calls.entryPayloads.map((entry) => entry.weekNumber)).toEqual([
      1, 2,
    ]);
    expect(calls.planPayloads[0].providerMetadata).toMatchObject({
      trainingPeaksStartDate: null,
    });
  });

  it('fails with a readable message when nothing dates the plan', async () => {
    mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan({ startDate: null, endDate: null }),
      workouts: [makeStructuredWorkout({ workoutDay: 'not-a-date' })],
      notes: [],
      config: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('Could not determine a start week');
    }
  });

  it('never sends a note, so a coach-written one survives a re-import', async () => {
    // An omitted note is kept by the server; sending null would erase it. We
    // have no note to offer, so the field must be absent rather than empty.
    const calls = mockPlanMyPeak({});

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.entryPayloads[0]).not.toHaveProperty('note');
  });

  it('sends the plan under its TrainingPeaks identity', async () => {
    const calls = mockPlanMyPeak({});

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.planPayloads[0].providerPlanId).toBe('624432');
    expect(calls.planPayloads[0].provider).toBe('training_peaks');
    expect(calls.planPayloads[0].weekCount).toBe(4);
  });

  it('removes only the entries this importer placed', async () => {
    // A session the coach scheduled by hand has no provider identity and must
    // survive a re-import that no longer contains it.
    const calls = mockPlanMyPeak({
      existingEntries: [
        {
          id: 'entry-stale',
          planId: 'plan-1',
          weekNumber: 3,
          dayOfWeek: 4,
          position: 0,
          note: null,
          workout: pmpWorkout('wk-9', 'library-shared'),
          provider: 'training_peaks',
          providerEntryId: '9999',
          createdAt: '2026-02-27T00:00:00.000Z',
          updatedAt: '2026-02-27T00:00:00.000Z',
        },
        {
          id: 'entry-hand-scheduled',
          planId: 'plan-1',
          weekNumber: 2,
          dayOfWeek: 5,
          position: 0,
          note: 'Coach note',
          workout: pmpWorkout('wk-8', 'library-shared'),
          provider: null,
          providerEntryId: null,
          createdAt: '2026-02-27T00:00:00.000Z',
          updatedAt: '2026-02-27T00:00:00.000Z',
        },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.deletedEntryIds).toEqual(['entry-stale']);
  });

  it('shortens the plan only after the stranded entries are gone', async () => {
    // The server refuses to shrink a plan below its highest scheduled week, so
    // ordering is the whole point: delete first, shorten last.
    const calls = mockPlanMyPeak({ planWeekCount: 8 });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan({ weekCount: 2 }),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.planPatches).toEqual([{ weekCount: 2 }]);
  });

  it('warns when TrainingPeaks reuses a workout id inside one plan', async () => {
    // The diagnostic: a repeated id would be read as a move of the first, so the
    // plan would silently come out short. Caught in the payload, before writing.
    const calls = mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [
        makeStructuredWorkout({
          workoutId: 1001,
          workoutDay: '2026-03-03T00:00:00',
        }),
        makeStructuredWorkout({
          workoutId: 1001,
          workoutDay: '2026-03-05T00:00:00',
        }),
      ],
      notes: [],
      config: {},
    });

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('reused workout id 1001'),
      })
    );
    expect(calls.entryPayloads).toHaveLength(2);
  });

  it('schedules a workout that has no structure at all', async () => {
    // Plyometric and other prose-only sessions carry no structure. The plan path
    // used to dedupe on a hash of the structure, so these were dropped before
    // they reached PlanMyPeak; provider identity replaces that.
    const calls = mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [
        makeStructuredWorkout({
          workoutId: 1001,
          title: 'Plyo A1 All Sports, Basic',
          workoutTypeValueId: 9,
          structure: null,
        } as Partial<PlanWorkout>),
      ],
      notes: [],
      config: {},
    });

    expect(result.success).toBe(true);
    expect(calls.entryPayloads).toHaveLength(1);
    expect(calls.entryPayloads[0].providerEntryId).toBe('1001');
  });

  it('names the workout library after the plan, so both entry points agree', async () => {
    // Libraries are matched by name, so a decorated name on one screen and a
    // plain one on another gives the same plan two libraries depending on where
    // the import was started.
    const calls = mockPlanMyPeak({ existingWorkoutLibraries: [] });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.workoutLibraryCreateNames).toEqual(['Base Plan']);
  });

  it('mirrors the TrainingPeaks folder as the PlanMyPeak plan library', async () => {
    // Membership lives on the folder, not the plan: the folder listing the plan's
    // id is the one it belongs to.
    const calls = mockPlanMyPeak({
      folders: [
        {
          folderId: 'ed1d7a21-1d85-4312-b680-a9e6f5a4ab98',
          folderName: 'Off the Shelf',
          ownerId: 6572228,
          planIds: [624432],
        },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual(['Off the Shelf']);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-new');
  });

  it('reuses an existing plan library of the same name', async () => {
    const calls = mockPlanMyPeak({
      folders: [
        {
          folderId: 'f1',
          folderName: 'Off the Shelf',
          ownerId: 1,
          planIds: [624432],
        },
      ],
      existingPlanLibraries: [
        {
          id: 'plan-lib-existing',
          name: 'Off the Shelf',
          description: null,
          isDefault: false,
          planCount: 3,
          createdAt: '2026-02-27T00:00:00.000Z',
          updatedAt: '2026-02-27T00:00:00.000Z',
        },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual([]);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-existing');
  });

  it('falls back to the default plan library when the plan is in no folder', async () => {
    const calls = mockPlanMyPeak({
      folders: [
        { folderId: 'f1', folderName: 'Other', ownerId: 1, planIds: [999999] },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual([]);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-1');
  });

  it('imports a calendar note as a note-discipline entry on its own day', async () => {
    // PlanMyPeak has no day-level note, but it does have a `note` discipline,
    // added for exactly this and stored without a structure. Scheduling one on
    // its day keeps the coach's words rather than dropping them.
    const calls = mockPlanMyPeak({});

    const result = await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [makeNote()],
      config: {},
    });

    expect(result.success).toBe(true);

    const noteEntry = calls.entryPayloads.find((payload) =>
      String(payload.providerEntryId).startsWith('note-')
    );
    expect(noteEntry).toBeDefined();
    // Namespaced: note ids and workout ids are both plain integers upstream and
    // would otherwise share one identity space.
    expect(noteEntry?.providerEntryId).toBe('note-501');
  });

  it('mirrors the TrainingPeaks folder as the PlanMyPeak plan library', async () => {
    // Membership lives on the folder, not the plan: the folder listing the plan's
    // id is the one it belongs to.
    const calls = mockPlanMyPeak({
      folders: [
        {
          folderId: 'ed1d7a21-1d85-4312-b680-a9e6f5a4ab98',
          folderName: 'Off the Shelf',
          ownerId: 6572228,
          planIds: [624432],
        },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual(['Off the Shelf']);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-new');
  });

  it('reuses an existing plan library of the same name', async () => {
    const calls = mockPlanMyPeak({
      folders: [
        {
          folderId: 'f1',
          folderName: 'Off the Shelf',
          ownerId: 1,
          planIds: [624432],
        },
      ],
      existingPlanLibraries: [
        {
          id: 'plan-lib-existing',
          name: 'Off the Shelf',
          description: null,
          isDefault: false,
          planCount: 3,
          createdAt: '2026-02-27T00:00:00.000Z',
          updatedAt: '2026-02-27T00:00:00.000Z',
        },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual([]);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-existing');
  });

  it('falls back to the default plan library when the plan is in no folder', async () => {
    const calls = mockPlanMyPeak({
      folders: [
        { folderId: 'f1', folderName: 'Other', ownerId: 1, planIds: [999999] },
      ],
    });

    await exportTrainingPlanClassicWorkoutsToPlanMyPeak({
      trainingPlan: makeTrainingPlan(),
      workouts: [makeStructuredWorkout()],
      notes: [],
      config: {},
    });

    expect(calls.createdPlanLibraryNames).toEqual([]);
    expect(calls.planPayloads[0].libraryId).toBe('plan-lib-1');
  });
});

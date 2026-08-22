import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportWorkoutsToPlanMyPeakLibrary,
  fetchPlanMyPeakWorkouts,
  ingestTrainingPeaksAthleteGroups,
} from '@/background/api/planMyPeak';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';
import { PLANMYPEAK_API_BASE_URL, STORAGE_KEYS } from '@/utils/constants';

function makeWorkout(
  overrides: Partial<PlanMyPeakWorkout> = {}
): PlanMyPeakWorkout {
  return {
    id: 'tp-123',
    name: 'TP 4x1k',
    detailed_description: 'Sample workout',
    sport_type: 'cycling',
    discipline: 'bike',
    type: 'interval',
    intensity: 'hard',
    suitable_phases: [],
    suitable_weekdays: null,
    structure: {
      primaryIntensityMetric: 'heartRate',
      primaryLengthMetric: 'distance',
      structure: [
        {
          type: 'repetition',
          length: { unit: 'repetition', value: 4 },
          steps: [
            {
              name: 'Easy',
              intensityClass: 'recovery',
              length: { unit: 'meter', value: 0 },
              openDuration: null,
              targets: [
                {
                  type: 'heartRate',
                  minValue: 55,
                  maxValue: 55,
                  unit: 'percentOfThresholdHr',
                },
              ],
            },
          ],
        },
      ],
    },
    base_duration_min: 0,
    base_tss: 0,
    variable_components: null,
    source_file: 'workout_123.json',
    source_format: 'json',
    signature: 'abc123',
    provider_workout_id: '12684302',
    provider_item_type: 'WorkoutTemplate',
    provider_intensity_factor: 0.75,
    provider_tss: 50,
    source_id: 'TP:abc123',
    ...overrides,
  };
}

/** A workout as PlanMyPeak answers a write, with the fields we read back. */
function createdWorkoutResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w-1',
    name: 'TP 4x1k',
    description: 'Sample workout',
    workoutType: 'bike',
    rideType: 'interval',
    summary: { segmentCount: 1, stepCount: 4, estimatedDurationSeconds: 1920 },
    profile: null,
    library: { id: '472318eb-c402-43e5-b556-004a5e5ecd73', name: 'TP Import' },
    provider: 'training_peaks',
    providerWorkoutId: '12684302',
    providerMetadata: {},
    providerIntensityFactor: null,
    providerTss: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

const TARGET_LIBRARY_ID = '472318eb-c402-43e5-b556-004a5e5ecd73';

describe('planMyPeak API - workout export request mapping', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
  });

  it('should post to the workout endpoint with the contract body shape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].workout.id).toBe('w-1');
    }

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(`${PLANMYPEAK_API_BASE_URL}/backend/workout-library`);

    const requestBody = JSON.parse(String((init as RequestInit).body));
    expect(requestBody.name).toBe('TP 4x1k');
    expect(requestBody.description).toBe('Sample workout');
    expect(requestBody.workoutType).toBe('bike');
    expect(requestBody.provider).toBe('training_peaks');
    expect(requestBody.providerWorkoutId).toBe('12684302');
    expect(requestBody.libraryId).toBe(TARGET_LIBRARY_ID);
  });

  it('should send the discipline resolved from the TrainingPeaks type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ discipline: 'rowing' })],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    // Disciplines beyond bike/run/swim are no longer filtered out locally.
    expect(requestBody.workoutType).toBe('rowing');
  });

  it('should send an empty segment list for a discipline stored without one', async () => {
    // Rest days, notes, races and prose strength sessions are stored with no
    // structure. The wrapper is still required — an empty list, not an absent
    // object — so this is what a rest day looks like on the wire.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse({ workoutType: 'rest_day' }),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({
          discipline: 'rest_day',
          structure: {
            primaryIntensityMetric: 'percentOfFtp',
            primaryLengthMetric: 'duration',
            structure: [],
          },
        }),
      ],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.workoutType).toBe('rest_day');
    expect(requestBody.structure.structure).toEqual([]);
    expect(requestBody.structure.primaryIntensityMetric).toBe('percentOfFtp');
    expect(requestBody.structure.primaryLengthMetric).toBe('duration');
  });

  it('should send no field the server would reject as undeclared', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    // Undeclared keys are refused with a 400 naming them, so the body must carry
    // exactly the contract's fields and nothing else.
    expect(Object.keys(requestBody).sort()).toEqual([
      'description',
      'libraryId',
      'name',
      'provider',
      'providerIntensityFactor',
      'providerMetadata',
      'providerTss',
      'providerWorkoutId',
      'structure',
      'workoutType',
    ]);
  });

  it('should pass TrainingPeaks planned load through as a pair', async () => {
    // A heart-rate workout has no normalized power for PlanMyPeak to derive a
    // load from, so without this it would show none at all.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.providerIntensityFactor).toBe(0.75);
    expect(requestBody.providerTss).toBe(50);
  });

  it('should send neither load figure when TrainingPeaks supplied only one', async () => {
    // The server refuses one without the other, so a half pair costs the whole
    // workout rather than just its load.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ provider_tss: null })],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody).not.toHaveProperty('providerIntensityFactor');
    expect(requestBody).not.toHaveProperty('providerTss');
  });

  it('should send a zero TSS, which is a value rather than an absence', async () => {
    // The falsiness trap on the write side: `if (tss)` here would silently strip
    // the load off a legitimately zero-TSS workout, and because the fields
    // travel as a pair it would take the intensity factor with it.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ provider_tss: 0, provider_intensity_factor: 0.4 })],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.providerTss).toBe(0);
    expect(requestBody.providerIntensityFactor).toBe(0.4);
  });

  it('should drop an intensity factor sent as a percentage rather than a ratio', async () => {
    // 72 instead of 0.72 is out of range and would be refused outright, so it is
    // dropped here — losing a load figure rather than the whole workout.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ provider_intensity_factor: 72 })],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody).not.toHaveProperty('providerIntensityFactor');
    expect(requestBody).not.toHaveProperty('providerTss');
  });

  it('should not send duration or TSS, which the server derives itself', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody).not.toHaveProperty('base_duration_min');
    expect(requestBody).not.toHaveProperty('base_tss');
  });

  it('should carry unmodelled TrainingPeaks fields in providerMetadata', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({
          suitable_phases: ['Base'],
          suitable_weekdays: ['Monday', '6', '8', 'invalid'],
        }),
      ],
      TARGET_LIBRARY_ID
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.providerMetadata.suitablePhases).toEqual(['Base']);
    // Sunday = 0, and unparseable values are dropped rather than guessed at.
    expect(requestBody.providerMetadata.suitableWeekdays).toEqual([1, 6]);
    expect(requestBody.providerMetadata.inferredWorkoutType).toBe('interval');
    expect(requestBody.providerMetadata.inferredIntensity).toBe('hard');
    expect(requestBody.providerMetadata.isPublic).toBe(false);
  });

  it('should send providerMetadata in full, since a write replaces it wholesale', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    // Omitting a key would drop that value rather than leave it untouched, so
    // every key is always present even when empty.
    expect(Object.keys(requestBody.providerMetadata).sort()).toEqual([
      'exerciseLibraryItemType',
      'inferredIntensity',
      'inferredWorkoutType',
      'isPublic',
      'suitablePhases',
      'suitableWeekdays',
      'variableComponents',
    ]);
  });

  it('should record the TrainingPeaks item type it read the discipline from', async () => {
    // Our note detection reads this field and its real vocabulary is not
    // documented, so recording what TrainingPeaks actually sent is what turns
    // that mapping from an untested guess into something an import can answer.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.providerMetadata.exerciseLibraryItemType).toBe(
      'WorkoutTemplate'
    );
  });

  it('should preserve the already-correct structure normalisation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));

    // Lowercase on the wire, unlike every other camelCase field.
    expect(requestBody.structure.primaryIntensityMetric).toBe('heartrate');
    expect(requestBody.structure.structure[0].type).toBe('repetition');
    expect(requestBody.structure.structure[0].length).toEqual({
      unit: 'repetition',
      value: 4,
    });
    expect(requestBody.structure.structure[0].steps[0].intensityClass).toBe(
      'rest'
    );
    // A zero-length step is clamped up, since the server requires > 0.
    expect(requestBody.structure.structure[0].steps[0].length.value).toBe(1);
  });

  it('should always send both target bounds, which the server requires', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary([makeWorkout()], TARGET_LIBRARY_ID);

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));
    const target = requestBody.structure.structure[0].steps[0].targets[0];

    expect(target).toHaveProperty('minValue');
    expect(target).toHaveProperty('maxValue');
  });

  it('should report a 201 as created', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdCount).toBe(1);
      expect(result.data.updatedCount).toBe(0);
      expect(result.data.results[0].created).toBe(true);
    }
  });

  it('should report a 200 as updated, since the bodies are identical', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => createdWorkoutResponse(),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdCount).toBe(0);
      expect(result.data.updatedCount).toBe(1);
      expect(result.data.results[0].created).toBe(false);
    }
  });

  it('should flag a workout the server filed in another library', async () => {
    // An update never moves a workout: the coach's filing outranks the
    // importer's destination, so this is a normal outcome to report, not an error.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        createdWorkoutResponse({
          library: { id: 'lib-elsewhere', name: 'Base Phase' },
        }),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].filedElsewhere).toBe(true);
      // Nothing landed in the destination, so it is an empty library.
      expect(result.data.destinationEmpty).toBe(true);
    }
  });

  it('should not call the destination empty when something landed in it', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => createdWorkoutResponse(),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.destinationEmpty).toBe(false);
    }
  });

  it('should upload the remaining workouts when one fails', async () => {
    // Reconcile semantics: one bad workout must not hide the outcome of the rest.
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'name too long' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdWorkoutResponse({ id: 'w-2' }),
      } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout({ name: 'Bad' }), makeWorkout({ name: 'Good' })],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.failures).toEqual([
        { name: 'Bad', message: 'name too long' },
      ]);
    }
  });

  it('should fail when every workout fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'rejected' }),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      TARGET_LIBRARY_ID
    );

    expect(result.success).toBe(false);
  });
});

describe('planMyPeak API - listing workouts', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
  });

  function page(rows: number, total: number, idPrefix: string) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: Array.from({ length: rows }, (_, index) =>
          createdWorkoutResponse({ id: `${idPrefix}-${index}` })
        ),
        pagination: { limit: 100, offset: 0, total },
        facets: {
          workoutType: {},
          rideType: {},
          duration: {},
          total,
          incomplete: false,
        },
      }),
    } as Response;
  }

  it('should follow pagination so a large library is seen in full', async () => {
    // The server pages at 25 by default and 100 at most. Reconciling a library
    // from only the first page would leave stale workouts behind while reporting
    // success, so every page has to be read.
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(page(100, 150, 'a'))
      .mockResolvedValueOnce(page(50, 150, 'b'));

    const result = await fetchPlanMyPeakWorkouts({ libraryId: 'lib-1' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(150);
    }
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const secondUrl = String(vi.mocked(global.fetch).mock.calls[1][0]);
    expect(secondUrl).toContain('offset=100');
  });

  it('should stop after one request when everything fits on a page', async () => {
    global.fetch = vi.fn().mockResolvedValue(page(2, 2, 'a'));

    const result = await fetchPlanMyPeakWorkouts({ libraryId: 'lib-1' });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should treat a filter miss as an empty list rather than an error', async () => {
    global.fetch = vi.fn().mockResolvedValue(page(0, 0, 'a'));

    const result = await fetchPlanMyPeakWorkouts({
      provider: 'training_peaks',
      providerWorkoutId: 'never-seen',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

describe('planMyPeak API - ingest TrainingPeaks athlete groups', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
  });

  const groups = [
    {
      id: 1,
      coachId: 10,
      name: 'Europe',
      athleteIds: [100, 101, 102],
      isDefault: false,
    },
  ];

  it('POSTs the raw groups payload verbatim to the ingest endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        groupsProcessed: 1,
        athletesAssociated: 3,
        skippedAthleteIds: [],
        groups: [
          {
            trainingPeaksGroupId: '1',
            name: 'Europe',
            valueId: 'v-1',
            isDefault: false,
            athletesAssociated: 3,
            skippedAthleteIds: [],
          },
        ],
      }),
    }) as never;

    const result = await ingestTrainingPeaksAthleteGroups(groups);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupsProcessed).toBe(1);
      expect(result.data.athletesAssociated).toBe(3);
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(
      `${PLANMYPEAK_API_BASE_URL}/backend/athlete-tags/ingest/training-peaks`
    );
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ groups });
  });

  it('returns a validation error without calling fetch when no groups are provided', async () => {
    global.fetch = vi.fn() as never;

    const result = await ingestTrainingPeaksAthleteGroups([]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

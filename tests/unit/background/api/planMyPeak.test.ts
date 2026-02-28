import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPlanMyPeakTrainingPlan,
  exportWorkoutsToPlanMyPeakLibrary,
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
    source_id: 'TP:abc123',
    ...overrides,
  };
}

describe('planMyPeak API - workout export request mapping', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
  });

  it('maps workout payload to OpenAPI shape for createWorkout', async () => {
    const createdWorkout = {
      id: 'w-1',
      name: 'TP 4x1k',
      type: 'interval',
      intensity: 'hard',
      structure: {},
      base_duration_min: 1,
      base_tss: 0,
      library_id: '472318eb-c402-43e5-b556-004a5e5ecd73',
      source_id: 'TP:abc123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ workout: createdWorkout }),
    } as Response);

    const result = await exportWorkoutsToPlanMyPeakLibrary(
      [makeWorkout()],
      '472318eb-c402-43e5-b556-004a5e5ecd73'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('w-1');
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(`${PLANMYPEAK_API_BASE_URL}/v1/workouts/library`);
    const requestBody = JSON.parse(String((init as RequestInit).body));

    expect(requestBody.structure.primaryIntensityMetric).toBe('heartrate');
    expect(requestBody.structure.structure[0].type).toBe('repetition');
    expect(requestBody.structure.structure[0].length).toEqual({
      unit: 'repetition',
      value: 4,
    });
    expect(requestBody.structure.structure[0].steps[0].intensityClass).toBe(
      'rest'
    );
    expect(requestBody.structure.structure[0].steps[0].length.value).toBe(1);
    expect(requestBody.base_duration_min).toBe(1);
    expect(requestBody).not.toHaveProperty('suitable_phases');
    expect(requestBody).not.toHaveProperty('suitable_weekdays');
  });

  it('normalizes suitable_weekdays to integer indexes and drops invalid values', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        workout: {
          id: 'w-2',
          name: 'Weekday test',
          type: 'tempo',
          intensity: 'moderate',
          structure: {},
          base_duration_min: 60,
          base_tss: null,
          library_id: '472318eb-c402-43e5-b556-004a5e5ecd73',
          source_id: 'TP:def456',
        },
      }),
    } as Response);

    await exportWorkoutsToPlanMyPeakLibrary(
      [
        makeWorkout({
          name: 'Weekday test',
          type: 'tempo',
          intensity: 'moderate',
          suitable_phases: ['Base'],
          suitable_weekdays: ['Monday', '6', '8', 'invalid'],
          source_id: 'TP:def456',
        }),
      ],
      '472318eb-c402-43e5-b556-004a5e5ecd73'
    );

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    const requestBody = JSON.parse(String((init as RequestInit).body));
    expect(requestBody.suitable_phases).toEqual(['Base']);
    expect(requestBody.suitable_weekdays).toEqual([1, 6]);
  });
});

describe('planMyPeak API - training plan upsert behavior', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: 'token-123',
    });
  });

  it('updates existing plan when create fails with duplicate source_id', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'A training plan with this source_id already exists',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          plans: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'Existing Plan',
              source_id: 'TP:624432',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          planId: '550e8400-e29b-41d4-a716-446655440000',
          savedAt: '2026-02-27T00:00:00.000Z',
        }),
      } as Response);

    const result = await createPlanMyPeakTrainingPlan({
      metadata: {
        name: 'Base Plan',
        description: 'Plan description',
        source_id: 'TP:624432',
      },
      weeks: [
        {
          weekNumber: 1,
          phase: 'Base',
          weeklyTss: 100,
          notes: null,
          workouts: {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
        },
      ],
      publish: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planId).toBe('550e8400-e29b-41d4-a716-446655440000');
    }

    expect(global.fetch).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls[0][0]).toBe(`${PLANMYPEAK_API_BASE_URL}/training-plans`);
    expect((calls[0][1] as RequestInit).method).toBe('POST');
    expect(calls[1][0]).toBe(`${PLANMYPEAK_API_BASE_URL}/training-plans`);
    expect((calls[1][1] as RequestInit).method ?? 'GET').toBe('GET');
    expect(calls[2][0]).toBe(
      `${PLANMYPEAK_API_BASE_URL}/training-plans/550e8400-e29b-41d4-a716-446655440000`
    );
    expect((calls[2][1] as RequestInit).method).toBe('PUT');
  });

  it('returns duplicate error when no existing plan matches source_id', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'A training plan with this source_id already exists',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          plans: [
            {
              id: '550e8400-e29b-41d4-a716-446655440111',
              name: 'Other Plan',
              source_id: 'TP:other',
            },
          ],
        }),
      } as Response);

    const result = await createPlanMyPeakTrainingPlan({
      metadata: {
        name: 'Base Plan',
        description: 'Plan description',
        source_id: 'TP:624432',
      },
      weeks: [
        {
          weekNumber: 1,
          phase: 'Base',
          weeklyTss: 100,
          notes: null,
          workouts: {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
        },
      ],
      publish: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain(
        'A training plan with this source_id already exists'
      );
    }

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

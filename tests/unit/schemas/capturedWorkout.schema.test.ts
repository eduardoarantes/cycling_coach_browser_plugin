import { describe, it, expect } from 'vitest';
import {
  CapturedWorkoutPayloadSchema,
  CapturedWorkoutRecordSchema,
  buildCapturedWorkoutKey,
  countPendingCapturedWorkouts,
  parseCapturedWorkoutsStorage,
  sortCapturedWorkoutsNewestFirst,
  type CapturedWorkoutRecord,
} from '@/schemas/capturedWorkout.schema';
import { WorkoutStructureSchema } from '@/schemas/trainingPlan.schema';

const structureWithPolyline = {
  structure: [
    {
      type: 'step',
      length: { unit: 'second', value: 600 },
      steps: [
        {
          name: 'Warm up',
          length: { unit: 'second', value: 600 },
          targets: [{ minValue: 50, maxValue: 60 }],
          intensityClass: 'warmUp',
          openDuration: false,
        },
      ],
      begin: 0,
      end: 600,
    },
  ],
  polyline: [
    [0, 0],
    [600, 55],
  ],
  primaryLengthMetric: 'duration',
  primaryIntensityMetric: 'percentOfFtp',
  primaryIntensityTargetOrRange: 'range',
};

function payload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    athleteId: 4830660,
    workoutId: 123,
    title: 'Sweet Spot',
    workoutDay: '2026-09-20T00:00:00',
    workoutTypeValueId: 2,
    structure: JSON.stringify(structureWithPolyline),
    totalTimePlanned: 1.5,
    tssPlanned: 85,
    ifPlanned: 0.86,
    description: 'desc',
    coachComments: null,
    userTags: null,
    lastModifiedDate: '2026-09-17T10:00:00',
    ...overrides,
  };
}

function record(
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  return {
    key: 'production:1:2',
    athleteId: 1,
    workoutId: 2,
    environment: 'production',
    capturedAt: 1000,
    updatedAt: 1000,
    status: 'pending',
    workout: {
      title: 'W',
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure: null,
      totalTimePlanned: null,
      tssPlanned: null,
      ifPlanned: null,
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
  };
}

describe('capturedWorkout.schema', () => {
  describe('CapturedWorkoutPayloadSchema', () => {
    it('accepts a structure given as a JSON string', () => {
      const result = CapturedWorkoutPayloadSchema.safeParse(payload());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(typeof result.data.structure).toBe('string');
    });

    it('accepts a structure given as an object and drops the polyline', () => {
      const result = CapturedWorkoutPayloadSchema.safeParse(
        payload({ structure: structureWithPolyline })
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.structure).not.toHaveProperty('polyline');
      expect(result.data.structure).toMatchObject({
        primaryLengthMetric: 'duration',
        primaryIntensityMetric: 'percentOfFtp',
        primaryIntensityTargetOrRange: 'range',
      });
    });

    it('parses a structure string and drops the polyline through the structure schema', () => {
      const parsed = WorkoutStructureSchema.parse(
        JSON.parse(payload().structure as string)
      );
      expect(parsed).not.toHaveProperty('polyline');
      expect(parsed.structure).toHaveLength(1);
    });

    it('rejects a payload without a title', () => {
      const { title: _title, ...withoutTitle } = payload();
      expect(CapturedWorkoutPayloadSchema.safeParse(withoutTitle).success).toBe(
        false
      );
    });

    it('rejects a non-numeric workout id', () => {
      expect(
        CapturedWorkoutPayloadSchema.safeParse(payload({ workoutId: '123' }))
          .success
      ).toBe(false);
    });

    it('tolerates missing optional metrics', () => {
      const result = CapturedWorkoutPayloadSchema.safeParse({
        athleteId: 1,
        workoutId: 2,
        title: 'Bare',
        workoutDay: '2026-09-20T00:00:00',
        workoutTypeValueId: 3,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('buildCapturedWorkoutKey', () => {
    it('includes the environment so sandbox and production ids stay distinct', () => {
      expect(buildCapturedWorkoutKey('production', 1, 2)).toBe(
        'production:1:2'
      );
      expect(buildCapturedWorkoutKey('sandbox', 1, 2)).toBe('sandbox:1:2');
      expect(buildCapturedWorkoutKey('production', 1, 2)).not.toBe(
        buildCapturedWorkoutKey('sandbox', 1, 2)
      );
    });
  });

  describe('CapturedWorkoutRecordSchema', () => {
    it('accepts a well-formed record', () => {
      expect(CapturedWorkoutRecordSchema.safeParse(record()).success).toBe(
        true
      );
    });

    it('rejects an unknown status', () => {
      expect(
        CapturedWorkoutRecordSchema.safeParse(
          record({ status: 'archived' as never })
        ).success
      ).toBe(false);
    });
  });

  describe('parseCapturedWorkoutsStorage', () => {
    it('keeps valid entries and skips malformed ones', () => {
      const good = record();
      const parsed = parseCapturedWorkoutsStorage({
        [good.key]: good,
        'production:9:9': { key: 'production:9:9', status: 'pending' },
        'production:8:8': 'not an object',
      });

      expect(Object.keys(parsed)).toEqual([good.key]);
      expect(parsed[good.key]).toEqual(good);
    });

    it('returns an empty map for a value that is not an object', () => {
      expect(parseCapturedWorkoutsStorage(undefined)).toEqual({});
      expect(parseCapturedWorkoutsStorage(null)).toEqual({});
      expect(parseCapturedWorkoutsStorage([])).toEqual({});
      expect(parseCapturedWorkoutsStorage('x')).toEqual({});
    });
  });

  describe('list helpers', () => {
    it('sorts newest first and counts pending records', () => {
      const older = record({ key: 'production:1:1', capturedAt: 100 });
      const newer = record({
        key: 'production:1:2',
        capturedAt: 200,
        status: 'sent',
      });
      const sorted = sortCapturedWorkoutsNewestFirst([older, newer]);
      expect(sorted.map((entry) => entry.key)).toEqual([
        'production:1:2',
        'production:1:1',
      ]);
      expect(countPendingCapturedWorkouts([older, newer])).toBe(1);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  PlanMyPeakCoachSchema,
  PlanMyPeakCreateWorkoutResponseSchema,
  PlanMyPeakLibrariesResponseSchema,
  PlanMyPeakWorkoutLibraryResponseSchema,
  getCoachTrainingPeaksExternalId,
} from '@/schemas/planMyPeakApi.schema';

/** A workout row as PlanMyPeak returns it, used as the base for these cases. */
function workoutPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wk-1',
    name: 'Sweet Spot 4x8',
    description: 'Tempo work.',
    workoutType: 'bike',
    rideType: 'sweet_spot',
    summary: {
      segmentCount: 1,
      stepCount: 4,
      estimatedDurationSeconds: 1920,
    },
    profile: null,
    library: { id: 'lib-1', name: 'TP Import' },
    provider: 'training_peaks',
    providerWorkoutId: '12684302',
    providerMetadata: { suitablePhases: ['Base'] },
    providerIntensityFactor: null,
    providerTss: null,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('planMyPeakApi schemas', () => {
  it('parses the libraries list, including the workout count', () => {
    const parsed = PlanMyPeakLibrariesResponseSchema.parse({
      data: [
        {
          id: 'lib-1',
          name: 'My Workouts',
          description: null,
          isDefault: true,
          workoutCount: 25,
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z',
        },
      ],
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].isDefault).toBe(true);
    expect(parsed.data[0].workoutCount).toBe(25);
  });

  it('parses a workout list with pagination and facets', () => {
    const parsed = PlanMyPeakWorkoutLibraryResponseSchema.parse({
      data: [workoutPayload()],
      pagination: { limit: 25, offset: 0, total: 1 },
      facets: {
        workoutType: { bike: 1 },
        rideType: { sweet_spot: 1 },
        duration: { under_1h: 1 },
        total: 1,
        incomplete: false,
      },
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.pagination.total).toBe(1);
    expect(parsed.facets.incomplete).toBe(false);
  });

  it('keeps a null profile, which is common rather than exceptional', () => {
    // Null whenever the structure is open-ended, distance-based, or in absolute
    // watts, so this has to parse rather than be treated as malformed.
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({ profile: null })
    );

    expect(parsed.profile).toBeNull();
  });

  it('accepts a heart-rate profile with no load', () => {
    // An HR workout has no normalized power, so there is nothing to derive a
    // load from. Null means unknown here, never zero.
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({
        profile: {
          metric: 'heartrate',
          unit: 'percentOfThresholdHr',
          segments: [{ percentOfThreshold: 88, seconds: 1200 }],
          durationSeconds: 1200,
          intensityFactor: null,
          tss: null,
          loadSource: null,
          peakPercentOfThreshold: 92,
        },
      })
    );

    expect(parsed.profile?.metric).toBe('heartrate');
    expect(parsed.profile?.intensityFactor).toBeNull();
    expect(parsed.profile?.loadSource).toBeNull();
  });

  it('distinguishes a provider-supplied load from a derived one', () => {
    // Presenting a passed-through TrainingPeaks figure as our own derivation
    // would misrepresent where the number came from.
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({
        providerIntensityFactor: 0.72,
        providerTss: 61,
        profile: {
          metric: 'heartrate',
          unit: 'percentOfMaxHr',
          segments: [{ percentOfThreshold: 80, seconds: 3600 }],
          durationSeconds: 3600,
          intensityFactor: 0.72,
          tss: 61,
          loadSource: 'provider',
          peakPercentOfThreshold: 84,
        },
      })
    );

    expect(parsed.profile?.loadSource).toBe('provider');
    expect(parsed.providerIntensityFactor).toBe(0.72);
    expect(parsed.providerTss).toBe(61);
  });

  it('parses a populated profile with its ratio intensity factor', () => {
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({
        profile: {
          metric: 'power',
          unit: 'percentOfFtp',
          segments: [{ percentOfThreshold: 90, seconds: 1920 }],
          durationSeconds: 1920,
          intensityFactor: 0.85,
          tss: 45,
          loadSource: 'derived',
          peakPercentOfThreshold: 93.5,
        },
      })
    );

    // A ratio, not a percentage — 0.85 rather than 85.
    expect(parsed.profile?.intensityFactor).toBe(0.85);
  });

  it('reports the library a workout is actually filed in', () => {
    // The write response reports where the workout really is, which is how an
    // importer detects that a coach had moved it somewhere else.
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({ library: { id: 'lib-9', name: 'Base Phase' } })
    );

    expect(parsed.library.id).toBe('lib-9');
    expect(parsed.library.name).toBe('Base Phase');
  });

  it('accepts a workout authored in PlanMyPeak, which has no provider identity', () => {
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({
        provider: null,
        providerWorkoutId: null,
        providerMetadata: null,
      })
    );

    expect(parsed.provider).toBeNull();
    expect(parsed.providerWorkoutId).toBeNull();
    expect(parsed.providerMetadata).toBeNull();
  });

  it('accepts an unfamiliar rideType, which the server derives and may extend', () => {
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse(
      workoutPayload({ rideType: 'some_new_classification' })
    );

    expect(parsed.rideType).toBe('some_new_classification');
  });

  it('rejects a workoutType outside the accepted vocabulary', () => {
    // We *send* this one, so a wrong value is our bug and should be loud.
    expect(() =>
      PlanMyPeakCreateWorkoutResponseSchema.parse(
        workoutPayload({ workoutType: 'cycling' })
      )
    ).toThrow();
  });
});

describe('getCoachTrainingPeaksExternalId', () => {
  it('returns the training_peaks externalId when present', () => {
    const coach = PlanMyPeakCoachSchema.parse({
      id: '99c02f5a-547d-4b15-b201-2d14e6690368',
      email: '1@gmail.com',
      firstName: 'Athlete coach',
      lastName: 'Rodrigues',
      externalIds: [{ providerCode: 'training_peaks', externalId: '6469888' }],
    });
    expect(getCoachTrainingPeaksExternalId(coach)).toBe('6469888');
  });

  it('returns null when there is no training_peaks link', () => {
    const coach = PlanMyPeakCoachSchema.parse({
      id: 'abc',
      externalIds: [{ providerCode: 'strava', externalId: '42' }],
    });
    expect(getCoachTrainingPeaksExternalId(coach)).toBeNull();
  });

  it('returns null for missing externalIds or null coach', () => {
    expect(
      getCoachTrainingPeaksExternalId(PlanMyPeakCoachSchema.parse({ id: 'x' }))
    ).toBeNull();
    expect(getCoachTrainingPeaksExternalId(null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  PlanMyPeakCreateWorkoutResponseSchema,
  PlanMyPeakLibrariesResponseSchema,
  PlanMyPeakLibrarySchema,
  PlanMyPeakWorkoutLibraryResponseSchema,
} from '@/schemas/planMyPeakApi.schema';

describe('planMyPeakApi schemas', () => {
  it('accepts libraries as a direct array payload', () => {
    const parsed = PlanMyPeakLibrariesResponseSchema.parse([
      {
        id: 'lib-1',
        name: 'My Library',
        is_system: false,
        is_default: true,
        created_at: '2026-02-27T00:00:00.000Z',
        updated_at: '2026-02-27T00:00:00.000Z',
      },
    ]);

    expect(parsed.libraries).toHaveLength(1);
    expect(parsed.total).toBe(1);
  });

  it('accepts workout list payload with nullable base_tss', () => {
    const parsed = PlanMyPeakWorkoutLibraryResponseSchema.parse({
      workouts: [
        {
          id: 'wk-1',
          name: 'Easy Ride',
          type: 'endurance',
          intensity: 'easy',
          structure: {},
          base_duration_min: 60,
          base_tss: null,
          library_id: 'lib-1',
          source_id: 'TP:abc123',
        },
      ],
      total: 1,
      filters_applied: {
        library_id: 'lib-1',
      },
    });

    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0].base_tss).toBeNull();
  });

  it('accepts wrapped create workout response', () => {
    const parsed = PlanMyPeakCreateWorkoutResponseSchema.parse({
      workout: {
        id: 'wk-1',
        name: 'Tempo Ride',
        type: 'tempo',
        intensity: 'moderate',
        structure: {},
        base_duration_min: 75,
        base_tss: 65,
        library_id: 'lib-1',
      },
    });

    expect(parsed.id).toBe('wk-1');
    expect(parsed.name).toBe('Tempo Ride');
  });

  it('normalizes camelCase library keys', () => {
    const parsed = PlanMyPeakLibrarySchema.parse({
      id: 'lib-2',
      name: 'Imported',
      ownerId: 'user-1',
      isSystem: false,
      isDefault: false,
      sourceId: 'TP:PLAN_WORKOUTS_V1',
      createdAt: '2026-02-27T00:00:00.000Z',
      updatedAt: '2026-02-27T00:00:00.000Z',
    });

    expect(parsed.owner_id).toBe('user-1');
    expect(parsed.source_id).toBe('TP:PLAN_WORKOUTS_V1');
    expect(parsed.is_system).toBe(false);
    expect(parsed.is_default).toBe(false);
  });
});

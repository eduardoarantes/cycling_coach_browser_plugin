/**
 * Unit tests for PlanMyPeak Adapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanMyPeakAdapter } from '@/export/adapters/planMyPeak/PlanMyPeakAdapter';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';

type TestLibrary = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  workoutCount: number;
  createdAt: string;
  updatedAt: string;
};

function createLibrary(overrides: Partial<TestLibrary> = {}): TestLibrary {
  return {
    id: 'lib-default',
    name: 'TrainingPeaks Library',
    description: null,
    isDefault: true,
    workoutCount: 0,
    createdAt: '2026-02-27T00:00:00.000Z',
    updatedAt: '2026-02-27T00:00:00.000Z',
    ...overrides,
  };
}

type TestUploadedWorkout = {
  id: string;
  name: string;
  workoutType: string;
  library: { id: string; name: string };
  providerWorkoutId: string | null;
};

function createUploadedWorkout(
  overrides: Partial<TestUploadedWorkout> = {}
): TestUploadedWorkout {
  return {
    id: 'pmp-workout-1',
    name: 'TP 4x1k',
    workoutType: 'bike',
    library: { id: 'lib-default', name: 'TrainingPeaks Library' },
    providerWorkoutId: '12684302',
    ...overrides,
  };
}

/**
 * The shape the background returns from an upload: per-workout outcome plus the
 * counts and the empty-destination flag the adapter reports from.
 */
function createUploadSummary(
  workouts: TestUploadedWorkout[],
  options: {
    requestedLibraryId?: string;
    created?: boolean;
    failures?: Array<{ name: string; message: string }>;
  } = {}
) {
  const requestedLibraryId = options.requestedLibraryId ?? 'lib-default';
  const created = options.created ?? true;
  const results = workouts.map((workout) => ({
    workout,
    created,
    filedElsewhere: workout.library.id !== requestedLibraryId,
  }));

  return {
    results,
    createdCount: created ? results.length : 0,
    updatedCount: created ? 0 : results.length,
    destinationEmpty:
      results.length > 0 && results.every((entry) => entry.filedElsewhere),
    failures: options.failures ?? [],
  };
}

describe('PlanMyPeakAdapter', () => {
  let adapter: PlanMyPeakAdapter;

  beforeEach(() => {
    adapter = new PlanMyPeakAdapter();
  });

  describe('metadata', () => {
    it('should have correct adapter id', () => {
      expect(adapter.id).toBe('planmypeak');
    });

    it('should have correct adapter name', () => {
      expect(adapter.name).toBe('PlanMyPeak');
    });

    it('should have description', () => {
      expect(adapter.description).toBeTruthy();
      expect(adapter.description).toContain('PlanMyPeak');
    });

    it('should support api format', () => {
      expect(adapter.supportedFormats).toContain('api');
    });

    it('should have an icon', () => {
      expect(adapter.icon).toBeTruthy();
    });
  });

  describe('transform', () => {
    const mockLibraryItem: LibraryItem = {
      exerciseLibraryId: 2550514,
      exerciseLibraryItemId: 12684302,
      exerciseLibraryItemType: 'WorkoutTemplate',
      itemName: 'Test Workout',
      workoutTypeId: 2,
      distancePlanned: null,
      totalTimePlanned: 1.0,
      caloriesPlanned: null,
      tssPlanned: 50,
      ifPlanned: 0.75,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: 'Test description',
      coachComments: null,
      structure: {
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Warm up',
                intensityClass: 'warmUp',
                length: { unit: 'second', value: 300 },
                openDuration: false,
                targets: [{ minValue: 40, maxValue: 50 }],
              },
            ],
            begin: 0,
            end: 300,
          },
        ],
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
      },
    };

    it('should transform a single workout', async () => {
      const result = await adapter.transform([mockLibraryItem], {});

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Workout');
      expect(result[0].id).toBeTruthy();
      expect(result[0].sport_type).toBe('cycling');
    });

    it('should transform multiple workouts', async () => {
      const items = [
        mockLibraryItem,
        {
          ...mockLibraryItem,
          exerciseLibraryItemId: 99999,
          itemName: 'Workout 2',
        },
      ];

      const result = await adapter.transform(items, {});

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Workout');
      expect(result[1].name).toBe('Workout 2');
    });

    it('should apply config options', async () => {
      const config = {
        defaultWorkoutType: 'tempo' as const,
        defaultIntensity: 'hard' as const,
        defaultSuitablePhases: ['Peak' as const],
      };

      const result = await adapter.transform([mockLibraryItem], config);

      expect(result[0].type).toBe('tempo');
      expect(result[0].intensity).toBe('hard');
      expect(result[0].suitable_phases).toEqual(['Peak']);
    });

    it('should handle empty array', async () => {
      const result = await adapter.transform([], {});
      expect(result).toHaveLength(0);
    });
  });

  describe('transform fallback reporting', () => {
    const adapter = new PlanMyPeakAdapter();

    function strengthItem(unit: string): LibraryItem {
      return {
        exerciseLibraryId: 1,
        exerciseLibraryItemId: 999,
        exerciseLibraryItemType: 'WorkoutTemplate',
        itemName: 'Back Squat',
        workoutTypeId: 9,
        distancePlanned: null,
        totalTimePlanned: 1,
        caloriesPlanned: null,
        tssPlanned: null,
        ifPlanned: null,
        velocityPlanned: null,
        energyPlanned: null,
        elevationGainPlanned: null,
        description: null,
        coachComments: null,
        structure: {
          primaryIntensityMetric: 'resistance',
          primaryLengthMetric: 'duration',
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Squat',
                  intensityClass: 'active',
                  length: { unit: 'second', value: 60 },
                  openDuration: false,
                  targets: [{ minValue: 100, maxValue: 100, unit }],
                },
              ],
            },
          ],
        },
      } as LibraryItem;
    }

    it('should name the target unit it could not map', async () => {
      // The unit string is the one fact that says what to add. Without it a
      // mapping gap just looks like a workout that arrived empty.
      const workouts = await adapter.transform([strengthItem('stones')], {});
      const result = await adapter.validate(workouts);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('stones'),
          severity: 'warning',
        })
      );
    });

    it('should not warn when the targets did map', async () => {
      const workouts = await adapter.transform([strengthItem('kilograms')], {});
      const result = await adapter.validate(workouts);

      expect(workouts[0].structure.structure).toHaveLength(1);
      expect(
        result.warnings.filter((entry) => entry.field?.startsWith('targets:'))
      ).toEqual([]);
    });
  });

  describe('validate', () => {
    const validWorkout: PlanMyPeakWorkout = {
      id: 'test123',
      name: 'Test Workout',
      detailed_description: 'Description',
      sport_type: 'cycling',
      discipline: 'bike',
      type: 'tempo',
      intensity: 'moderate',
      suitable_phases: ['Base', 'Build'],
      suitable_weekdays: null,
      structure: {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Warm up',
                intensityClass: 'warmUp',
                length: { unit: 'second', value: 300 },
                openDuration: null,
                targets: [
                  {
                    type: 'power',
                    minValue: 40,
                    maxValue: 50,
                    unit: 'percentOfFtp',
                  },
                ],
              },
            ],
          },
        ],
      },
      base_duration_min: 60,
      base_tss: 50,
      variable_components: null,
      source_file: 'workout_123.json',
      source_format: 'json',
      signature: '1234567890abcdef',
      provider_workout_id: '12684302',
      provider_item_type: 'WorkoutTemplate',
      provider_intensity_factor: 0.75,
      provider_tss: 50,
    };

    it('should validate valid workouts', async () => {
      const result = await adapter.validate([validWorkout]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing workout name and identify it by TrainingPeaks id', async () => {
      // The one case where the name cannot identify the item, so the message
      // falls back to something the user can still trace.
      const invalid = { ...validWorkout, name: '' };
      const result = await adapter.validate([invalid]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('name'),
          message: expect.stringContaining(validWorkout.provider_workout_id),
          severity: 'error',
        })
      );
    });

    it('should name the offending workout in a validation error', async () => {
      // A rule with no subject leaves the user guessing which of fifty workouts
      // tripped it.
      const invalid = {
        ...validWorkout,
        name: 'Threshold 2x20',
        structure: { ...validWorkout.structure, structure: [] },
      };
      const result = await adapter.validate([invalid]);

      expect(result.errors[0].message).toContain('"Threshold 2x20"');
      expect(result.errors[0].message).toContain('bike');
    });

    it('should name the workout in a warning too', async () => {
      const result = await adapter.validate([
        { ...validWorkout, name: 'Recovery Spin', base_tss: -5 },
      ]);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('"Recovery Spin"'),
          severity: 'warning',
        })
      );
    });

    it('should detect empty structure on a discipline that must prescribe one', async () => {
      const invalid = {
        ...validWorkout,
        structure: { ...validWorkout.structure, structure: [] },
      };
      const result = await adapter.validate([invalid]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('structure'),
          severity: 'error',
        })
      );
    });

    it.each(['rest_day', 'note', 'race', 'strength'] as const)(
      'should accept an empty structure for %s',
      async (discipline) => {
        // These are stored without a structure, so validation has to allow what
        // the transform now deliberately produces for them — otherwise the item
        // is built correctly and then rejected by us before it is ever sent.
        const result = await adapter.validate([
          {
            ...validWorkout,
            discipline,
            structure: { ...validWorkout.structure, structure: [] },
          },
        ]);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    );

    it('should warn about invalid duration', async () => {
      const invalid = { ...validWorkout, base_duration_min: 0 };
      const result = await adapter.validate([invalid]);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('base_duration_min'),
          severity: 'warning',
        })
      );
    });

    it('should warn about negative TSS', async () => {
      const invalid = { ...validWorkout, base_tss: -10 };
      const result = await adapter.validate([invalid]);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('base_tss'),
          severity: 'warning',
        })
      );
    });

    it('should validate multiple workouts', async () => {
      const workouts = [
        validWorkout,
        { ...validWorkout, id: 'test456', name: 'Workout 2' },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle validation errors for multiple workouts', async () => {
      const workouts = [
        validWorkout,
        { ...validWorkout, name: '' }, // Invalid
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toContain('[1]'); // Second workout
    });
  });

  describe('export', () => {
    const mockWorkout: PlanMyPeakWorkout = {
      id: 'test123',
      name: 'Test Workout',
      detailed_description: 'Description',
      sport_type: 'cycling',
      discipline: 'bike',
      type: 'tempo',
      intensity: 'moderate',
      suitable_phases: ['Base', 'Build'],
      suitable_weekdays: null,
      structure: {
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
        structure: [
          {
            type: 'step',
            length: { unit: 'repetition', value: 1 },
            steps: [
              {
                name: 'Warm up',
                intensityClass: 'warmUp',
                length: { unit: 'second', value: 300 },
                openDuration: null,
                targets: [
                  {
                    type: 'power',
                    minValue: 40,
                    maxValue: 50,
                    unit: 'percentOfFtp',
                  },
                ],
              },
            ],
          },
        ],
      },
      base_duration_min: 60,
      base_tss: 50,
      variable_components: null,
      source_file: 'workout_123.json',
      source_format: 'json',
      signature: '1234567890abcdef',
      provider_workout_id: '12684302',
      provider_item_type: 'WorkoutTemplate',
      provider_intensity_factor: 0.75,
      provider_tss: 50,
    };

    it('should export workouts to PlanMyPeak API library', async () => {
      const library = createLibrary();

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [library] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary([createUploadedWorkout()]),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('TrainingPeaks Library');
      expect(result.format).toBe('api');
      expect(result.itemsExported).toBe(1);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
          libraryId: 'lib-default',
        })
      );
    });

    it('should create target library when no matching library exists', async () => {
      const createdLibrary = createLibrary({
        id: 'lib-new',
        name: 'My Export Library',
        isDefault: false,
      });

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [] };
          }

          if (typed.type === 'CREATE_PLANMYPEAK_LIBRARY') {
            return { success: true, data: createdLibrary };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary(
                [
                  createUploadedWorkout({
                    library: { id: 'lib-new', name: 'My Export Library' },
                  }),
                ],
                { requestedLibraryId: 'lib-new' }
              ),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {
        targetLibraryName: 'My Export Library',
      });

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('My Export Library');
      expect(result.format).toBe('api');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_PLANMYPEAK_LIBRARY',
          name: 'My Export Library',
        })
      );
    });

    it('should use explicit targetLibraryId when provided', async () => {
      const libraries = [
        createLibrary({
          id: 'lib-default',
          name: 'TrainingPeaks Library',
        }),
        createLibrary({
          id: 'lib-target',
          name: 'Target Library',
          isDefault: false,
        }),
      ];

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: libraries };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            const libraryId = typed.libraryId as string;
            return {
              success: true,
              data: createUploadSummary(
                [
                  createUploadedWorkout({
                    library: { id: libraryId, name: 'Target Library' },
                  }),
                ],
                { requestedLibraryId: libraryId }
              ),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {
        targetLibraryId: 'lib-target',
      });

      expect(result.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
          libraryId: 'lib-target',
        })
      );
    });

    it('should warn that non-cycling workouts are hidden by the library filter', async () => {
      // Stored correctly and still invisible on the coach's first look, which is
      // indistinguishable from the import having dropped them.
      const library = createLibrary();

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [library] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary([
                createUploadedWorkout({ id: 'w-1', workoutType: 'rest_day' }),
                createUploadedWorkout({ id: 'w-2', workoutType: 'strength' }),
              ]),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'visibility',
          message: expect.stringContaining('rest_day, strength'),
        })
      );
    });

    it('should stay quiet when everything imported is cycling', async () => {
      const library = createLibrary();

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [library] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary([createUploadedWorkout()]),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(
        result.warnings.filter((entry) => entry.field === 'visibility')
      ).toEqual([]);
    });

    it('should return failed export result when upload fails', async () => {
      const library = createLibrary();

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [library] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: false,
              error: { message: 'Upload failed' },
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(result.success).toBe(false);
      expect(result.fileName).toBe('TrainingPeaks Library');
      expect(result.itemsExported).toBe(0);
      expect(result.errors).toContain('Upload failed');
    });

    it('should include transform warnings in export result', async () => {
      const library = createLibrary();
      const unsupportedItem: LibraryItem = {
        exerciseLibraryId: 2550514,
        exerciseLibraryItemId: 777,
        exerciseLibraryItemType: 'WorkoutTemplate',
        itemName: 'Unsupported Strength Workout',
        workoutTypeId: 5,
        distancePlanned: null,
        totalTimePlanned: 1.0,
        caloriesPlanned: null,
        tssPlanned: 50,
        ifPlanned: 0.75,
        velocityPlanned: null,
        energyPlanned: null,
        elevationGainPlanned: null,
        description: null,
        coachComments: null,
        structure: null,
      };

      // Populate lastTransformWarnings with an unsupported TP workout.
      const transformed = await adapter.transform([unsupportedItem], {});
      expect(transformed).toHaveLength(0);

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [library] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary([createUploadedWorkout()]),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Skipped'),
        })
      );
    });
  });

  describe('end-to-end workflow', () => {
    it('should complete full transform-validate-export workflow', async () => {
      const mockItem: LibraryItem = {
        exerciseLibraryId: 2550514,
        exerciseLibraryItemId: 12684302,
        exerciseLibraryItemType: 'WorkoutTemplate',
        itemName: 'E2E Test Workout',
        workoutTypeId: 2,
        distancePlanned: null,
        totalTimePlanned: 1.0,
        caloriesPlanned: null,
        tssPlanned: 50,
        ifPlanned: 0.75,
        velocityPlanned: null,
        energyPlanned: null,
        elevationGainPlanned: null,
        description: 'E2E test',
        coachComments: null,
        structure: {
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Warm up',
                  intensityClass: 'warmUp',
                  length: { unit: 'second', value: 300 },
                  openDuration: false,
                  targets: [{ minValue: 40, maxValue: 50 }],
                },
              ],
              begin: 0,
              end: 300,
            },
          ],
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
        },
      };

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: [createLibrary()] };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: createUploadSummary([createUploadedWorkout()]),
            };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      // Transform
      const workouts = await adapter.transform([mockItem], {});
      expect(workouts).toHaveLength(1);

      // Validate
      const validation = await adapter.validate(workouts);
      expect(validation.isValid).toBe(true);

      // Export
      const exportResult = await adapter.export(workouts, {});

      expect(exportResult.success).toBe(true);
      expect(exportResult.fileName).toBe('TrainingPeaks Library');
      expect(exportResult.format).toBe('api');
      expect(exportResult.itemsExported).toBe(1);
    });
  });
});

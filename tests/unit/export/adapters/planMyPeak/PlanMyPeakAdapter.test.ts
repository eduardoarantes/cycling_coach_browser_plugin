/**
 * Unit tests for PlanMyPeak Adapter
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanMyPeakAdapter } from '@/export/adapters/planMyPeak/PlanMyPeakAdapter';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';

function createLibrary(
  overrides: Partial<{
    id: string;
    name: string;
    owner_id: string | null;
    is_system: boolean;
    is_default: boolean;
    source_id: string | null;
    created_at: string;
    updated_at: string;
  }> = {}
): {
  id: string;
  name: string;
  owner_id: string | null;
  is_system: boolean;
  is_default: boolean;
  source_id: string | null;
  created_at: string;
  updated_at: string;
} {
  return {
    id: 'lib-default',
    name: 'TrainingPeaks Library',
    owner_id: 'user-1',
    is_system: false,
    is_default: true,
    source_id: null,
    created_at: '2026-02-27T00:00:00.000Z',
    updated_at: '2026-02-27T00:00:00.000Z',
    ...overrides,
  };
}

function createUploadedWorkout(
  overrides: Partial<{
    id: string;
    name: string;
    type: string;
    intensity: string;
    structure: unknown;
    base_duration_min: number;
    base_tss: number;
    library_id: string;
    source_id: string | null;
  }> = {}
): {
  id: string;
  name: string;
  type: string;
  intensity: string;
  structure: unknown;
  base_duration_min: number;
  base_tss: number;
  library_id: string;
  source_id: string | null;
} {
  return {
    id: 'wk-1',
    name: 'Test Workout',
    type: 'tempo',
    intensity: 'moderate',
    structure: {},
    base_duration_min: 60,
    base_tss: 50,
    library_id: 'lib-default',
    source_id: null,
    ...overrides,
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

  describe('validate', () => {
    const validWorkout: PlanMyPeakWorkout = {
      id: 'test123',
      name: 'Test Workout',
      detailed_description: 'Description',
      sport_type: 'cycling',
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
    };

    it('should validate valid workouts', async () => {
      const result = await adapter.validate([validWorkout]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing workout name', async () => {
      const invalid = { ...validWorkout, name: '' };
      const result = await adapter.validate([invalid]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('name'),
          message: expect.stringContaining('required'),
          severity: 'error',
        })
      );
    });

    it('should detect empty structure', async () => {
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
            return { success: true, data: [createUploadedWorkout()] };
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
        is_default: false,
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
              data: [
                createUploadedWorkout({
                  library_id: 'lib-new',
                }),
              ],
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
          is_default: false,
        }),
      ];

      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        async (message: unknown) => {
          const typed = message as { type: string; [key: string]: unknown };

          if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
            return { success: true, data: libraries };
          }

          if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
            return {
              success: true,
              data: [
                createUploadedWorkout({
                  library_id: typed.libraryId as string,
                }),
              ],
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
            return { success: true, data: [createUploadedWorkout()] };
          }

          return {
            success: false,
            error: { message: `Unhandled message ${typed.type}` },
          };
        }
      );

      const result = await adapter.export([mockWorkout], {});

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Skipped');
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
            return { success: true, data: [createUploadedWorkout()] };
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

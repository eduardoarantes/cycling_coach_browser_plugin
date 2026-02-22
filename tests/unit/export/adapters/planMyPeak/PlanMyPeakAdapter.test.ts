/**
 * Unit tests for PlanMyPeak Adapter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanMyPeakAdapter } from '@/export/adapters/planMyPeak/PlanMyPeakAdapter';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';

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

    it('should support json format', () => {
      expect(adapter.supportedFormats).toContain('json');
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

    it('should export workouts to JSON file', async () => {
      const result = await adapter.export([mockWorkout], {});

      expect(result.success).toBe(true);
      expect(result.fileUrl).toBeTruthy();
      expect(result.fileName).toMatch(/\.json$/);
      expect(result.format).toBe('json');
      expect(result.itemsExported).toBe(1);
    });

    it('should use custom file name', async () => {
      const result = await adapter.export([mockWorkout], {
        fileName: 'my_workouts',
      });

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('my_workouts.json');
    });

    it('should add .json extension if not present', async () => {
      const result = await adapter.export([mockWorkout], {
        fileName: 'my_workouts',
      });

      expect(result.fileName).toBe('my_workouts.json');
    });

    it('should not duplicate .json extension', async () => {
      const result = await adapter.export([mockWorkout], {
        fileName: 'my_workouts.json',
      });

      expect(result.fileName).toBe('my_workouts.json');
      expect(result.fileName).not.toBe('my_workouts.json.json');
    });

    it('should export multiple workouts', async () => {
      const workouts = [
        mockWorkout,
        { ...mockWorkout, id: 'test456', name: 'Workout 2' },
      ];

      const result = await adapter.export(workouts, {});

      expect(result.success).toBe(true);
      expect(result.itemsExported).toBe(2);
    });

    it('should create downloadable blob URL', async () => {
      const result = await adapter.export([mockWorkout], {});

      expect(result.fileUrl).toBeTruthy();
      expect(result.fileUrl).toMatch(/^blob:/);
    });

    it('should include warnings in export result', async () => {
      const result = await adapter.export([mockWorkout], {});

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
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

      // Transform
      const workouts = await adapter.transform([mockItem], {});
      expect(workouts).toHaveLength(1);

      // Validate
      const validation = await adapter.validate(workouts);
      expect(validation.isValid).toBe(true);

      // Export
      const exportResult = await adapter.export(workouts, {
        fileName: 'e2e_test',
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.fileUrl).toBeTruthy();
      expect(exportResult.fileName).toBe('e2e_test.json');
      expect(exportResult.itemsExported).toBe(1);
    });
  });
});

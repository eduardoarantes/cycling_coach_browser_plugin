/**
 * Unit tests for PlanMyPeak transformer
 */
import { describe, it, expect } from 'vitest';
import { transformToPlanMyPeak } from '@/export/adapters/planMyPeak/transformer';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';

describe('transformToPlanMyPeak', () => {
  const baseLibraryItem: LibraryItem = {
    exerciseLibraryId: 2550514,
    exerciseLibraryItemId: 12684302,
    exerciseLibraryItemType: 'WorkoutTemplate',
    itemName: 'Test Workout',
    workoutTypeId: 2,
    distancePlanned: null,
    totalTimePlanned: 1.0, // 1 hour
    caloriesPlanned: null,
    tssPlanned: 50,
    ifPlanned: 0.75,
    velocityPlanned: null,
    energyPlanned: null,
    elevationGainPlanned: null,
    description: 'Test workout description',
    coachComments: 'Coach comments here',
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

  const defaultConfig: PlanMyPeakExportConfig = {};

  describe('basic transformation', () => {
    it('should transform workout name', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.name).toBe('Test Workout');
    });

    it('should generate unique workout ID from exerciseLibraryItemId', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.id).toBe(
        baseLibraryItem.exerciseLibraryItemId.toString(36)
      );
    });

    it('should use description as detailed_description', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.detailed_description).toBe('Test workout description');
    });

    it('should use coachComments if description is null', () => {
      const item = { ...baseLibraryItem, description: null };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.detailed_description).toBe('Coach comments here');
    });

    it('should set detailed_description to null if both are null', () => {
      const item = {
        ...baseLibraryItem,
        description: null,
        coachComments: null,
      };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.detailed_description).toBeNull();
    });

    it('should set source_format to json', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.source_format).toBe('json');
    });

    it('should generate source_file name', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.source_file).toBe('workout_12684302.json');
    });

    it('should generate signature', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.signature).toBeTruthy();
      expect(result.signature).toHaveLength(16);
    });
  });

  describe('workout type inference', () => {
    it('should infer vo2max for IF >= 1.05', () => {
      const item = { ...baseLibraryItem, ifPlanned: 1.1 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.type).toBe('vo2max');
    });

    it('should infer threshold for IF >= 0.95', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.98 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.type).toBe('threshold');
    });

    it('should infer tempo for IF >= 0.85', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.88 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.type).toBe('tempo');
    });

    it('should infer endurance for IF >= 0.7', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.72 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.type).toBe('endurance');
    });

    it('should infer recovery for low IF', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.6 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.type).toBe('recovery');
    });

    it('should use config default workout type if provided', () => {
      const config = { ...defaultConfig, defaultWorkoutType: 'tempo' as const };
      const result = transformToPlanMyPeak(baseLibraryItem, config);
      expect(result.type).toBe('tempo');
    });
  });

  describe('intensity level inference', () => {
    it('should infer very_hard for IF >= 1.05', () => {
      const item = { ...baseLibraryItem, ifPlanned: 1.1 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.intensity).toBe('very_hard');
    });

    it('should infer hard for IF >= 0.95', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.98 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.intensity).toBe('hard');
    });

    it('should infer moderate for IF >= 0.85', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.88 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.intensity).toBe('moderate');
    });

    it('should infer easy for IF >= 0.7', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.72 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.intensity).toBe('easy');
    });

    it('should infer very_easy for low IF', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.6 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.intensity).toBe('very_easy');
    });

    it('should use config default intensity if provided', () => {
      const config = { ...defaultConfig, defaultIntensity: 'hard' as const };
      const result = transformToPlanMyPeak(baseLibraryItem, config);
      expect(result.intensity).toBe('hard');
    });
  });

  describe('suitable phases inference', () => {
    it('should assign Build and Peak for vo2max workouts', () => {
      const item = { ...baseLibraryItem, ifPlanned: 1.1 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.suitable_phases).toEqual(['Build', 'Peak']);
    });

    it('should assign Build and Peak for threshold workouts', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.98 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.suitable_phases).toEqual(['Build', 'Peak']);
    });

    it('should assign Base and Build for tempo workouts', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.88 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.suitable_phases).toEqual(['Base', 'Build']);
    });

    it('should assign Recovery for recovery workouts', () => {
      const item = { ...baseLibraryItem, ifPlanned: 0.6 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.suitable_phases).toEqual(['Recovery']);
    });

    it('should use config default phases if provided', () => {
      const config = {
        ...defaultConfig,
        defaultSuitablePhases: ['Peak' as const],
      };
      const result = transformToPlanMyPeak(baseLibraryItem, config);
      expect(result.suitable_phases).toEqual(['Peak']);
    });
  });

  describe('duration calculation', () => {
    it('should use totalTimePlanned and convert to minutes', () => {
      const item = { ...baseLibraryItem, totalTimePlanned: 1.5 }; // 1.5 hours
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.base_duration_min).toBe(90); // 90 minutes
    });

    it('should calculate from structure if totalTimePlanned is null', () => {
      const item = { ...baseLibraryItem, totalTimePlanned: null };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.base_duration_min).toBeGreaterThan(0);
    });
  });

  describe('TSS calculation', () => {
    it('should use tssPlanned', () => {
      const item = { ...baseLibraryItem, tssPlanned: 75.5 };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.base_tss).toBe(75.5);
    });

    it('should default to 0 if tssPlanned is null', () => {
      const item = { ...baseLibraryItem, tssPlanned: null };
      const result = transformToPlanMyPeak(item, defaultConfig);
      expect(result.base_tss).toBe(0);
    });
  });

  describe('structure transformation', () => {
    it('should preserve structure type and length', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.structure.structure).toHaveLength(1);
      expect(result.structure.structure[0].type).toBe('step');
      expect(result.structure.structure[0].length).toEqual({
        unit: 'repetition',
        value: 1,
      });
    });

    it('should remove begin and end fields from structure blocks', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      const block = result.structure.structure[0] as unknown as {
        begin?: number;
        end?: number;
      };
      expect(block.begin).toBeUndefined();
      expect(block.end).toBeUndefined();
    });

    it('should add type and unit to targets', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      const step = result.structure.structure[0].steps[0];

      expect(step.targets).toHaveLength(1);
      expect(step.targets[0]).toEqual({
        type: 'power',
        minValue: 40,
        maxValue: 50,
        unit: 'percentOfFtp',
      });
    });

    it('should preserve step properties', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      const step = result.structure.structure[0].steps[0];

      expect(step.name).toBe('Warm up');
      expect(step.intensityClass).toBe('warmUp');
      expect(step.length).toEqual({ unit: 'second', value: 300 });
      expect(step.openDuration).toBeNull();
    });

    it('should set primaryIntensityMetric to percentOfFtp', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.structure.primaryIntensityMetric).toBe('percentOfFtp');
    });

    it('should set primaryLengthMetric to duration', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.structure.primaryLengthMetric).toBe('duration');
    });
  });

  describe('nested structure handling', () => {
    it('should handle repetition blocks with nested steps', () => {
      const item: LibraryItem = {
        ...baseLibraryItem,
        structure: {
          structure: [
            {
              type: 'repetition',
              length: { unit: 'repetition', value: 3 },
              steps: [
                {
                  name: 'Hard',
                  intensityClass: 'active',
                  length: { unit: 'second', value: 30 },
                  openDuration: false,
                  targets: [{ minValue: 120, maxValue: 150 }],
                },
                {
                  name: 'Easy',
                  intensityClass: 'rest',
                  length: { unit: 'second', value: 240 },
                  openDuration: false,
                  targets: [{ minValue: 50, maxValue: 60 }],
                },
              ],
              begin: 0,
              end: 810,
            },
          ],
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
        },
      };

      const result = transformToPlanMyPeak(item, defaultConfig);
      const block = result.structure.structure[0];

      expect(block.type).toBe('repetition');
      expect(block.length.value).toBe(3);
      expect(block.steps).toHaveLength(2);
      expect(block.steps[0].name).toBe('Hard');
      expect(block.steps[1].name).toBe('Easy');
    });
  });

  describe('variable components', () => {
    it('should set variable_components to null', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.variable_components).toBeNull();
    });
  });

  describe('suitable weekdays', () => {
    it('should set suitable_weekdays to null', () => {
      const result = transformToPlanMyPeak(baseLibraryItem, defaultConfig);
      expect(result.suitable_weekdays).toBeNull();
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { LibraryItem } from '@/schemas/library.schema';
import type { RxBuilderWorkout } from '@/schemas/rxBuilder.schema';
import {
  buildIntervalsWorkoutBuilderDocumentFromTpStructure,
  buildIntervalsIcuDescription,
  buildIntervalsIcuDescriptionFromRxBuilderWorkout,
  mapTpWorkoutTypeToIntervalsType,
  renderIntervalsTextFromTpStructure,
} from '@/export/adapters/intervalsicu/workoutMapping';

describe('Intervals.icu workoutMapping (provider-specific)', () => {
  const baseWorkout: LibraryItem = {
    exerciseLibraryId: 1,
    exerciseLibraryItemId: 1001,
    exerciseLibraryItemType: 'WorkoutTemplate',
    itemName: 'Structured Ride',
    workoutTypeId: 2,
    distancePlanned: null,
    totalTimePlanned: 1,
    caloriesPlanned: 600,
    tssPlanned: 55,
    ifPlanned: 0.82,
    velocityPlanned: null,
    energyPlanned: null,
    elevationGainPlanned: 300,
    description: 'Main set focus on smooth cadence',
    coachComments: 'Keep breathing controlled',
  };

  describe('mapTpWorkoutTypeToIntervalsType', () => {
    it('maps the corrected TP core sport IDs', () => {
      expect(mapTpWorkoutTypeToIntervalsType(1)).toBe('Swim');
      expect(mapTpWorkoutTypeToIntervalsType(2)).toBe('Ride');
      expect(mapTpWorkoutTypeToIntervalsType(3)).toBe('Run');
    });

    it('maps additional supported TP types and falls back to Other', () => {
      expect(mapTpWorkoutTypeToIntervalsType(9)).toBe('WeightTraining');
      expect(mapTpWorkoutTypeToIntervalsType(29)).toBe('WeightTraining');
      expect(mapTpWorkoutTypeToIntervalsType(11)).toBe('NordicSki');
      expect(mapTpWorkoutTypeToIntervalsType(12)).toBe('Rowing');
      expect(mapTpWorkoutTypeToIntervalsType(13)).toBe('Walk');
      expect(mapTpWorkoutTypeToIntervalsType(999)).toBe('Other');
    });
  });

  describe('renderIntervalsTextFromTpStructure', () => {
    it('renders classic TP structure into Intervals-style text lines', () => {
      const structure = {
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
          },
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
          },
        ],
        primaryIntensityMetric: 'percentOfFtp',
        primaryLengthMetric: 'duration',
      };

      const text = renderIntervalsTextFromTpStructure(structure);

      expect(text).toContain('- 5m 40-50% intensity=warmup');
      expect(text).toContain('3x');
      expect(text).toContain('- Hard 30s 120-150%');
      expect(text).toContain('- Easy 4m 50-60% intensity=rest');
    });

    it('returns null when structure shape is invalid', () => {
      expect(renderIntervalsTextFromTpStructure(null)).toBeNull();
      expect(renderIntervalsTextFromTpStructure({})).toBeNull();
      expect(renderIntervalsTextFromTpStructure({ structure: [] })).toBeNull();
    });

    it('adds a blank line between nested warmup/repetition/cooldown sections', () => {
      const structure = {
        structure: [
          {
            type: 'set',
            steps: [
              {
                type: 'step',
                steps: [
                  {
                    name: 'Warm up',
                    intensityClass: 'warmUp',
                    length: { unit: 'minute', value: 20 },
                    targets: [{ minValue: 40, maxValue: 50 }],
                  },
                ],
              },
              {
                type: 'repetition',
                length: { unit: 'repetition', value: 3 },
                steps: [
                  {
                    name: 'Hard',
                    intensityClass: 'active',
                    length: { unit: 'minute', value: 3 },
                    targets: [{ minValue: 75, maxValue: 85 }],
                  },
                  {
                    name: 'Harder',
                    intensityClass: 'active',
                    length: { unit: 'minute', value: 1 },
                    targets: [{ minValue: 90, maxValue: 100 }],
                  },
                  {
                    name: 'Easy',
                    intensityClass: 'rest',
                    length: { unit: 'minute', value: 1 },
                    targets: [{ minValue: 50, maxValue: 60 }],
                  },
                  {
                    name: 'Recovery',
                    intensityClass: 'rest',
                    length: { unit: 'minute', value: 5 },
                    targets: [{ minValue: 50, maxValue: 60 }],
                  },
                ],
              },
              {
                type: 'step',
                steps: [
                  {
                    name: 'Cool down',
                    intensityClass: 'coolDown',
                    length: { unit: 'minute', value: 20 },
                    targets: [{ minValue: 40, maxValue: 50 }],
                  },
                ],
              },
            ],
          },
        ],
        primaryIntensityMetric: 'percentOfFtp',
      };

      const text = renderIntervalsTextFromTpStructure(structure);

      expect(text).toBe(
        [
          '- 20m 40-50% intensity=warmup',
          '',
          '3x',
          '- Hard 3m 75-85%',
          '- Harder 1m 90-100%',
          '- Easy 1m 50-60% intensity=rest',
          '- Recovery 5m 50-60% intensity=rest',
          '',
          '- 20m 40-50% intensity=cooldown',
        ].join('\n')
      );
    });

    it('renders cadence/RPM targets when present in TP step data', () => {
      const structure = {
        structure: [
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 2 },
            steps: [
              {
                name: 'Hard',
                intensityClass: 'active',
                length: { unit: 'minute', value: 3 },
                targets: [{ minValue: 75, maxValue: 85 }],
                cadence: { minRpm: 90, maxRpm: 100 },
              },
              {
                name: 'Easy',
                intensityClass: 'rest',
                length: { unit: 'minute', value: 1 },
                targets: [{ minValue: 50, maxValue: 60 }],
                cadence: { rpm: 85 },
              },
            ],
          },
        ],
        primaryIntensityMetric: 'percentOfFtp',
      };

      const text = renderIntervalsTextFromTpStructure(structure);

      expect(text).toContain('- Hard 3m 75-85% 90-100 rpm');
      expect(text).toContain('- Easy 1m 50-60% 85 rpm intensity=rest');
    });

    it('renders meter distances as kilometers for Intervals compatibility', () => {
      const structure = {
        structure: [
          {
            type: 'step',
            steps: [
              {
                name: 'Swim steady',
                intensityClass: 'active',
                length: { unit: 'meter', value: 1000 },
              },
            ],
          },
          {
            type: 'step',
            steps: [
              {
                name: 'Swim easy',
                intensityClass: 'rest',
                length: { unit: 'meter', value: 500 },
              },
            ],
          },
        ],
      };

      const text = renderIntervalsTextFromTpStructure(structure);

      expect(text).toContain('- Swim steady 1km');
      expect(text).toContain('- Swim easy 0.5km intensity=rest');
      expect(text).not.toContain('1000m');
      expect(text).not.toContain('500m');
    });
  });

  describe('buildIntervalsWorkoutBuilderDocumentFromTpStructure', () => {
    it('builds a validated Intervals AST document from TP structure', () => {
      const structure = {
        structure: [
          {
            type: 'step',
            steps: [
              {
                name: 'Warm up',
                intensityClass: 'warmUp',
                length: { unit: 'minute', value: 10 },
                targets: [{ minValue: 40, maxValue: 50 }],
              },
            ],
          },
          {
            type: 'repetition',
            length: { unit: 'repetition', value: 3 },
            steps: [
              {
                name: 'Hard',
                intensityClass: 'active',
                length: { unit: 'minute', value: 3 },
                targets: [{ minValue: 75, maxValue: 85 }],
                cadence: { minRpm: 90, maxRpm: 100 },
              },
            ],
          },
        ],
        primaryIntensityMetric: 'percentOfFtp',
      };

      const ast = buildIntervalsWorkoutBuilderDocumentFromTpStructure(
        structure,
        'Ride'
      );

      expect(ast).not.toBeNull();
      expect(ast?.sportHint).toBe('Ride');
      expect(ast?.sections).toHaveLength(2);
      expect(ast?.sections[1].repeatCount).toBe(3);
      const hardStep = ast?.sections[1].items[0];
      expect(hardStep).toMatchObject({
        kind: 'step',
        label: 'Hard',
      });
      if (hardStep && hardStep.kind === 'step') {
        expect(hardStep.targets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: 'cadence_rpm',
              value: { min: 90, max: 100 },
            }),
          ])
        );
      }
    });
  });

  describe('buildIntervalsIcuDescription', () => {
    it('composes structured text, notes, and metadata', () => {
      const workout: LibraryItem = {
        ...baseWorkout,
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
                  targets: [{ minValue: 50, maxValue: 60 }],
                },
              ],
            },
          ],
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
        },
      };

      const description = buildIntervalsIcuDescription(workout);

      expect(description.startsWith('- 5m 50-60% intensity=warmup')).toBe(true);
      expect(description).toContain('- 5m 50-60% intensity=warmup');
      expect(description).toContain(
        '- 5m 50-60% intensity=warmup\n\n\nMain set focus on smooth cadence'
      );
      expect(description).toContain('Main set focus on smooth cadence');
      expect(description).not.toContain('- - - -');
      expect(description).toContain('Pre workout comments:');
      expect(description).toContain('Keep breathing controlled');
      expect(description).not.toContain('Workout Details:');
      expect(description).not.toContain('IF: 0.82');
      expect(description).not.toContain('Elevation: 300m');
    });

    it('formats non-divisible seconds as seconds instead of mixed m+s', () => {
      const workout: LibraryItem = {
        ...baseWorkout,
        structure: {
          structure: [
            {
              type: 'step',
              length: { unit: 'repetition', value: 1 },
              steps: [
                {
                  name: 'Recovery',
                  intensityClass: 'rest',
                  length: { unit: 'second', value: 90 },
                  targets: [{ minValue: 50, maxValue: 60 }],
                },
              ],
            },
          ],
          primaryIntensityMetric: 'percentOfFtp',
          primaryLengthMetric: 'duration',
        },
      };

      const description = buildIntervalsIcuDescription(workout);
      expect(description).toContain('- Recovery 90s 50-60% intensity=rest');
      expect(description).not.toContain('1m30s');
    });
  });

  describe('buildIntervalsIcuDescriptionFromRxBuilderWorkout', () => {
    it('renders a safe textual strength summary with sequence and instructions', () => {
      const workout = {
        instructions: 'Move with control. Rest 60s between sets.',
        sequenceSummary: [
          { sequenceOrder: 'A', title: 'Goblet Squat', compliancePercent: 0 },
          { sequenceOrder: 'B1', title: 'Split Squat', compliancePercent: 0 },
        ],
        totalSets: 6,
        totalBlocks: 2,
        totalPrescriptions: 2,
        prescribedDurationInSeconds: 1800,
        rpe: 7,
      } as Pick<
        RxBuilderWorkout,
        | 'instructions'
        | 'sequenceSummary'
        | 'totalSets'
        | 'totalBlocks'
        | 'totalPrescriptions'
        | 'prescribedDurationInSeconds'
        | 'rpe'
      >;

      const description =
        buildIntervalsIcuDescriptionFromRxBuilderWorkout(workout);

      expect(description).toContain('Exercises:');
      expect(description).toContain('A. Goblet Squat');
      expect(description).toContain('B1. Split Squat');
      expect(description).toContain('Session Info:');
      expect(description).toContain('Planned Duration: 30m');
      expect(description).toContain('RPE: 7');
      expect(description).toContain('Instructions:');
      expect(description).toContain(
        'Move with control. Rest 60s between sets.'
      );
      expect(description).not.toContain('- Goblet Squat');
    });
  });
});

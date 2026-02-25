import { describe, expect, it } from 'vitest';
import {
  IntervalsWorkoutBuilderDocumentSchema,
  IntervalsCadenceRpmTargetSchema,
  IntervalsAbsolutePaceTargetSchema,
  IntertoolsPlanGuideDocumentSchema,
} from '@/schemas/intervalsicuDsl.schema';

describe('IntervalsWorkoutBuilderDocumentSchema', () => {
  it('validates a repeated section with power and cadence RPM targets', () => {
    const doc = {
      sections: [
        {
          kind: 'section',
          items: [
            {
              kind: 'step',
              duration: { kind: 'time', value: 20, unit: 'minutes' },
              targets: [
                { kind: 'power_percent_ftp', value: { min: 40, max: 50 } },
              ],
              intensityTag: 'warmup',
            },
          ],
        },
        {
          kind: 'section',
          repeatCount: 3,
          items: [
            {
              kind: 'step',
              label: 'Hard',
              duration: { kind: 'time', value: 3, unit: 'minutes' },
              targets: [
                { kind: 'power_percent_ftp', value: { min: 75, max: 85 } },
                { kind: 'cadence_rpm', value: { min: 90, max: 100 } },
              ],
            },
            {
              kind: 'step',
              label: 'Easy',
              duration: { kind: 'time', value: 1, unit: 'minutes' },
              targets: [
                { kind: 'power_percent_ftp', value: { min: 50, max: 60 } },
                { kind: 'cadence_rpm', value: 85 },
              ],
              intensityTag: 'rest',
            },
          ],
        },
      ],
    };

    const parsed = IntervalsWorkoutBuilderDocumentSchema.parse(doc);

    expect(parsed.source).toBe('intervals_workout_builder_text');
    expect(parsed.sections[1].repeatCount).toBe(3);
    expect(parsed.sections[1].items[0]).toMatchObject({
      kind: 'step',
      label: 'Hard',
      targetMode: 'steady',
    });
  });

  it('validates absolute pace and timed prompts for a run step', () => {
    const doc = {
      sportHint: 'Run',
      sections: [
        {
          kind: 'section',
          heading: 'Main Set',
          items: [
            {
              kind: 'step',
              label: 'Tempo',
              duration: { kind: 'time', value: 10, unit: 'minutes' },
              targetMode: 'ramp',
              targets: [
                {
                  kind: 'pace_absolute',
                  value: { min: 7.25, max: 7.0 },
                  denominatorUnit: 'mi',
                },
                { kind: 'cadence_rpm', value: { min: 88, max: 94 } },
              ],
              prompts: [
                { offsetSeconds: 33, message: 'Settle in', priority: 'alert' },
              ],
            },
          ],
        },
      ],
    };

    const parsed = IntervalsWorkoutBuilderDocumentSchema.parse(doc);

    expect(parsed.sportHint).toBe('Run');
    expect(parsed.sections[0].items[0]).toMatchObject({
      kind: 'step',
      targetMode: 'ramp',
    });
  });

  it('rejects an inverted cadence RPM range', () => {
    expect(() =>
      IntervalsCadenceRpmTargetSchema.parse({
        kind: 'cadence_rpm',
        value: { min: 105, max: 90 },
      })
    ).toThrow();
  });

  it('rejects an invalid absolute pace denominator', () => {
    expect(() =>
      IntervalsAbsolutePaceTargetSchema.parse({
        kind: 'pace_absolute',
        value: { min: 4.0, max: 4.5 },
        denominatorUnit: '200m',
      })
    ).toThrow();
  });
});

describe('IntertoolsPlanGuideDocumentSchema', () => {
  it('validates a one-week guide with workout and rest days', () => {
    const doc = {
      weeks: [
        {
          weekIndex: 1,
          days: [
            {
              kind: 'workout',
              zone: 'z2',
              load: { kind: 'exact', value: 60 },
              duration: { kind: 'exact', value: 45 },
              intensity: { kind: 'exact', value: 70 },
            },
            { kind: 'rest' },
            {
              kind: 'workout',
              zone: 'z5',
              load: { kind: 'exact', value: 120 },
              duration: { kind: 'exact', value: 90 },
              intensity: { kind: 'exact', value: 95 },
              notes: 'Equivalent to z5:120:90:95 example',
            },
            {
              kind: 'workout',
              zone: 'Z3',
              load: { kind: 'gte', value: 70 },
              duration: { kind: 'range', min: 40, max: 60 },
              intensity: { kind: 'min' },
            },
            { kind: 'rest', label: 'Recovery' },
            {
              kind: 'workout',
              zone: 'z1',
              load: { kind: 'any' },
              duration: { kind: 'max' },
              intensity: { kind: 'lte', value: 60 },
            },
            {
              kind: 'workout',
              zone: 'z4',
              load: { kind: 'range', min: 80, max: 100 },
              duration: { kind: 'exact', value: 50 },
              intensity: { kind: 'exact', value: 90 },
            },
          ],
        },
      ],
    };

    const parsed = IntertoolsPlanGuideDocumentSchema.parse(doc);

    expect(parsed.source).toBe('intertools_multi_week_plan_guide');
    expect(parsed.weeks[0].days).toHaveLength(7);
    expect(parsed.weeks[0].days[3]).toMatchObject({
      kind: 'workout',
      zone: 'z3',
    });
  });

  it('rejects weeks that do not contain exactly 7 days', () => {
    expect(() =>
      IntertoolsPlanGuideDocumentSchema.parse({
        weeks: [
          {
            days: [{ kind: 'rest' }],
          },
        ],
      })
    ).toThrow();
  });

  it('rejects inverted criterion ranges', () => {
    expect(() =>
      IntertoolsPlanGuideDocumentSchema.parse({
        weeks: [
          {
            days: [
              {
                kind: 'workout',
                zone: 'z2',
                load: { kind: 'range', min: 100, max: 80 },
                duration: { kind: 'exact', value: 45 },
                intensity: { kind: 'exact', value: 70 },
              },
              { kind: 'rest' },
              { kind: 'rest' },
              { kind: 'rest' },
              { kind: 'rest' },
              { kind: 'rest' },
              { kind: 'rest' },
            ],
          },
        ],
      })
    ).toThrow();
  });
});

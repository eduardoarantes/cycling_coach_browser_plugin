import type {
  PlanMyPeakSportType,
  PlanMyPeakStep,
  PlanMyPeakTarget,
} from '@/types/planMyPeak.types';

/**
 * TrainingPeaks workoutTypeId -> PlanMyPeak sport support.
 *
 * Current exporter supports cycling, running, and swimming. Strength remains
 * unsupported until we validate TP strength examples and target semantics.
 */
export const TP_TO_PLANMYPEAK_WORKOUT_TYPE_MAP: Record<
  number,
  PlanMyPeakSportType
> = {
  1: 'swimming', // Swim
  2: 'cycling', // Bike / Ride
  3: 'running', // Run
  8: 'cycling', // Mountain bike
} as const;

export function isSupportedTpWorkoutTypeForPlanMyPeak(
  workoutTypeId: number
): boolean {
  return typeof TP_TO_PLANMYPEAK_WORKOUT_TYPE_MAP[workoutTypeId] === 'string';
}

export function mapTpWorkoutTypeIdToPlanMyPeakSportType(
  workoutTypeId: number
): PlanMyPeakSportType | null {
  return TP_TO_PLANMYPEAK_WORKOUT_TYPE_MAP[workoutTypeId] ?? null;
}

/**
 * PlanMyPeak library examples in SQL currently use duration + power/cadence
 * targets only. We support additional HR targets where the API schema now
 * allows them, and still reject unsupported TP metrics/units so they can be
 * skipped instead of silently mistranslated.
 */
export function mapTpTargetToPlanMyPeakTarget(
  target: {
    minValue?: number;
    maxValue?: number;
    unit?: string;
  },
  primaryIntensityMetric?: string
): PlanMyPeakTarget | null {
  const explicitUnit =
    typeof target.unit === 'string' ? target.unit.trim() : undefined;
  const normalizedPrimaryIntensityMetric =
    typeof primaryIntensityMetric === 'string'
      ? primaryIntensityMetric.trim().toLowerCase()
      : '';

  const minValue =
    typeof target.minValue === 'number'
      ? target.minValue
      : typeof target.maxValue === 'number'
        ? target.maxValue
        : 0;
  const maxValue =
    typeof target.maxValue === 'number'
      ? target.maxValue
      : typeof target.minValue === 'number'
        ? target.minValue
        : 0;

  if (explicitUnit === 'roundOrStridePerMinute' || explicitUnit === 'rpm') {
    return {
      type: 'cadence',
      minValue,
      maxValue,
      unit:
        explicitUnit === 'roundOrStridePerMinute'
          ? 'roundOrStridePerMinute'
          : 'rpm',
    };
  }

  if (
    explicitUnit === 'bpm' ||
    explicitUnit === 'beatsPerMinute' ||
    explicitUnit === 'beatPerMinute'
  ) {
    return {
      type: 'heartRate',
      minValue,
      maxValue,
      unit: 'bpm',
    };
  }

  // TP often omits the unit on the primary target and relies on
  // structure.primaryIntensityMetric.
  if (!explicitUnit && normalizedPrimaryIntensityMetric === 'percentofftp') {
    return {
      type: 'power',
      minValue,
      maxValue,
      unit: 'percentOfFtp',
    };
  }

  if (
    !explicitUnit &&
    (normalizedPrimaryIntensityMetric === 'percentofmaxhr' ||
      normalizedPrimaryIntensityMetric === 'percentofthresholdhr')
  ) {
    return {
      type: 'heartRate',
      minValue,
      maxValue,
      unit:
        normalizedPrimaryIntensityMetric === 'percentofmaxhr'
          ? 'percentOfMaxHr'
          : 'percentOfThresholdHr',
    };
  }

  if (
    !explicitUnit &&
    (normalizedPrimaryIntensityMetric === 'percentofthresholdpace' ||
      normalizedPrimaryIntensityMetric === 'pace')
  ) {
    return {
      type: 'pace',
      minValue,
      maxValue,
    };
  }

  if (
    explicitUnit === 'secondsPerKilometer' ||
    explicitUnit === 'secondsPerMile' ||
    explicitUnit === 'secondsPer100Meters' ||
    explicitUnit === 'secondsPer100Yards'
  ) {
    return {
      type: 'pace',
      minValue,
      maxValue,
      unit: explicitUnit,
    };
  }

  if (explicitUnit === 'kilometersPerHour' || explicitUnit === 'milesPerHour') {
    return {
      type: 'speed',
      minValue,
      maxValue,
      unit: explicitUnit,
    };
  }

  return null;
}

export function isSupportedTpLengthUnitForPlanMyPeak(unit: string): boolean {
  return (
    unit === 'second' ||
    unit === 'minute' ||
    unit === 'hour' ||
    unit === 'meter' ||
    unit === 'kilometer' ||
    unit === 'mile' ||
    unit === 'repetition'
  );
}

export function mapTpIntensityClassToPlanMyPeakStepIntensity(
  intensityClass?: string,
  stepName?: string
): PlanMyPeakStep['intensityClass'] {
  const value = (intensityClass || '').trim();
  if (
    value === 'active' ||
    value === 'warmUp' ||
    value === 'rest' ||
    value === 'coolDown' ||
    value === 'recovery'
  ) {
    return value;
  }

  const label = (stepName || '').toLowerCase();
  if (label.includes('warm')) return 'warmUp';
  if (label.includes('cool')) return 'coolDown';
  if (label.includes('recover')) return 'recovery';
  if (label.includes('rest') || label.includes('easy')) return 'rest';
  return 'active';
}

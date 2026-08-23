import type {
  PlanMyPeakSportType,
  PlanMyPeakStep,
  PlanMyPeakTarget,
} from '@/types/planMyPeak.types';
import type { PlanMyPeakWorkoutTypeValue } from '@/schemas/planMyPeakApi.schema';

/**
 * TrainingPeaks workoutTypeId -> PlanMyPeak discipline.
 *
 * PlanMyPeak accepts twelve disciplines, so nearly every TrainingPeaks type has
 * a home. Anything unrecognised maps to `other` rather than being filtered out:
 * whether a workout can be imported is decided by whether it has a usable
 * structure, not by its discipline, and the server is the authority on the rest.
 */
export const TP_TO_PLANMYPEAK_DISCIPLINE_MAP: Record<
  number,
  PlanMyPeakWorkoutTypeValue
> = {
  1: 'swim',
  2: 'bike',
  3: 'run',
  4: 'cross_train', // Brick
  5: 'cross_train',
  6: 'race',
  7: 'rest_day', // Day Off
  8: 'mountain_bike',
  9: 'strength',
  10: 'other', // Custom
  11: 'cross_country_ski',
  12: 'rowing',
  13: 'walk',
  29: 'strength', // TP duplicate strength type
  100: 'other',
} as const;

export function mapTpWorkoutTypeIdToPlanMyPeakDiscipline(
  workoutTypeId: number
): PlanMyPeakWorkoutTypeValue {
  return TP_TO_PLANMYPEAK_DISCIPLINE_MAP[workoutTypeId] ?? 'other';
}

/**
 * Disciplines PlanMyPeak stores without a structure.
 *
 * Mirrors EMPTY_STRUCTURE_TYPES in the PlanMyPeak workout-planning service:
 * a rest day's prescription is having nothing to do, a note is an annotation, a
 * race is an event marker, and strength is routinely written as prose.
 *
 * For strength this is a fallback, not the normal path — load *is* expressible
 * as a `resistance` target carrying kilograms, pounds or percent-of-1RM, and we
 * map those, so only a session we cannot express at all goes out empty.
 * Everything else must prescribe something, and an empty one is refused.
 */
export const DISCIPLINES_ALLOWING_EMPTY_STRUCTURE: ReadonlySet<PlanMyPeakWorkoutTypeValue> =
  new Set(['rest_day', 'note', 'race', 'strength']);

/**
 * Resolve the PlanMyPeak discipline for a TrainingPeaks item.
 *
 * The item's own type wins when it identifies as a note, since TrainingPeaks
 * files annotations under a workout type id that would otherwise read as a
 * training session.
 */
export function resolvePlanMyPeakDiscipline(item: {
  workoutTypeId: number;
  exerciseLibraryItemType?: string;
}): PlanMyPeakWorkoutTypeValue {
  const itemType = item.exerciseLibraryItemType?.trim().toLowerCase();
  if (itemType === 'note' || itemType === 'notes') {
    return 'note';
  }

  return mapTpWorkoutTypeIdToPlanMyPeakDiscipline(item.workoutTypeId);
}

/**
 * Coarse sport used only by the local inference heuristics (workout type,
 * intensity, suitable phases). Never sent — the wire value is the discipline
 * above — so an imprecise fallback here costs nothing.
 */
export function mapTpWorkoutTypeIdToPlanMyPeakSportType(
  workoutTypeId: number
): PlanMyPeakSportType {
  switch (mapTpWorkoutTypeIdToPlanMyPeakDiscipline(workoutTypeId)) {
    case 'swim':
      return 'swimming';
    case 'run':
    case 'walk':
      return 'running';
    case 'strength':
      return 'strength';
    default:
      return 'cycling';
  }
}

/** Whether a TrainingPeaks item carries a structure we can transform. */
export function hasImportableStructure(item: { structure?: unknown }): boolean {
  const structure = item.structure;
  return (
    !!structure &&
    typeof structure === 'object' &&
    'structure' in structure &&
    Array.isArray((structure as { structure?: unknown }).structure) &&
    (structure as { structure: unknown[] }).structure.length > 0
  );
}

/**
 * Distinct target unit strings a TrainingPeaks item prescribes.
 *
 * Used to explain a fallback: when a workout we could have structured goes out
 * empty, the unit we failed to map is the one fact worth reporting, because it
 * is the thing that tells us what to add. Guessing at unit spellings and never
 * hearing which one was wrong is how a mapping gap stays open.
 */
export function collectTpTargetUnits(item: { structure?: unknown }): string[] {
  if (!hasImportableStructure(item)) {
    return [];
  }

  const blocks = (item.structure as { structure: unknown[] }).structure;
  const units = new Set<string>();

  for (const block of blocks) {
    const steps = (block as { steps?: unknown[] })?.steps;
    if (!Array.isArray(steps)) {
      continue;
    }

    for (const step of steps) {
      const targets = (step as { targets?: unknown[] })?.targets;
      if (!Array.isArray(targets)) {
        continue;
      }

      for (const target of targets) {
        const unit = (target as { unit?: unknown })?.unit;
        if (typeof unit === 'string' && unit.trim()) {
          units.add(unit.trim());
        }
      }
    }
  }

  return [...units];
}

/**
 * Whether an item can be imported at all.
 *
 * Either it has a structure to send, or its discipline is one PlanMyPeak stores
 * without one. Nothing else is filtered here — the server is the authority.
 */
export function canImportTpItemToPlanMyPeak(item: {
  workoutTypeId: number;
  exerciseLibraryItemType?: string;
  structure?: unknown;
}): boolean {
  return (
    hasImportableStructure(item) ||
    DISCIPLINES_ALLOWING_EMPTY_STRUCTURE.has(resolvePlanMyPeakDiscipline(item))
  );
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

  // Strength load. PlanMyPeak expresses it as a `resistance` target carrying a
  // weight unit, so "5x5 back squat at 100kg" survives as data rather than
  // collapsing into prose in the description.
  if (
    explicitUnit === 'kilograms' ||
    explicitUnit === 'kg' ||
    explicitUnit === 'pounds' ||
    explicitUnit === 'lbs' ||
    explicitUnit === 'percentOf1RM' ||
    explicitUnit === 'percentOfOneRepMax'
  ) {
    return {
      type: 'resistance',
      minValue,
      maxValue,
      unit:
        explicitUnit === 'kilograms' || explicitUnit === 'kg'
          ? 'kilograms'
          : explicitUnit === 'pounds' || explicitUnit === 'lbs'
            ? 'pounds'
            : 'percentOf1RM',
    };
  }

  // Prescribed by feel rather than by number.
  if (explicitUnit === 'scale10' || explicitUnit === 'rpe') {
    return {
      type: 'rpe',
      minValue,
      maxValue,
      unit: 'scale10',
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
  // TrainingPeaks omits the unit on effort-rated steps and leaves the scale to
  // the structure's primary metric, so a bare {minValue, maxValue} under an RPE
  // workout is a rating rather than an unmappable target.
  if (!explicitUnit && normalizedPrimaryIntensityMetric === 'rpe') {
    return {
      type: 'rpe',
      minValue,
      maxValue,
      unit: 'scale10',
    };
  }

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

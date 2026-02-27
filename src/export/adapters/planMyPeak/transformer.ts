/**
 * TrainingPeaks to PlanMyPeak Transformation Logic
 *
 * Converts TrainingPeaks workout format to PlanMyPeak format.
 */

import type { LibraryItem } from '@/types';
import type {
  IntensityLevel,
  PlanMyPeakExportConfig,
  PlanMyPeakLength,
  PlanMyPeakSportType,
  PlanMyPeakStep,
  PlanMyPeakStructure,
  PlanMyPeakStructureBlock,
  PlanMyPeakTarget,
  PlanMyPeakWorkout,
  TrainingPhase,
  WorkoutType,
} from '@/types/planMyPeak.types';
import { logger } from '@/utils/logger';
import {
  isSupportedTpLengthUnitForPlanMyPeak,
  mapTpWorkoutTypeIdToPlanMyPeakSportType,
  mapTpIntensityClassToPlanMyPeakStepIntensity,
  mapTpTargetToPlanMyPeakTarget,
} from './workoutMapping';

/**
 * Generate a unique ID for PlanMyPeak workout
 */
function generateWorkoutId(item: LibraryItem): string {
  // Use exerciseLibraryItemId as base, convert to base36 string
  return item.exerciseLibraryItemId.toString(36);
}

/**
 * Calculate total duration in minutes from structure
 */
function calculateDuration(structure: unknown): number {
  // This is a simplified calculation
  // In production, you'd traverse the entire structure tree
  if (
    !structure ||
    typeof structure !== 'object' ||
    !('structure' in structure)
  ) {
    return 0;
  }

  let totalSeconds = 0;

  const blocks = (structure as { structure: unknown[] }).structure;
  if (!Array.isArray(blocks)) return 0;

  function sumBlock(block: unknown): number {
    if (!block || typeof block !== 'object') return 0;

    if ('steps' in block && Array.isArray(block.steps)) {
      const length = 'length' in block ? block.length : null;
      if (
        length &&
        typeof length === 'object' &&
        'unit' in length &&
        'value' in length
      ) {
        const lengthObj = length as { unit: string; value: number };
        const repetitions =
          lengthObj.unit === 'repetition' ? lengthObj.value : 1;

        let blockDuration = 0;
        for (const step of block.steps) {
          if (
            step &&
            typeof step === 'object' &&
            'length' in step &&
            step.length &&
            typeof step.length === 'object' &&
            'unit' in step.length &&
            'value' in step.length
          ) {
            const stepLength = step.length as { unit: string; value: number };
            if (stepLength.unit === 'second') {
              blockDuration += stepLength.value;
            } else if (stepLength.unit === 'minute') {
              blockDuration += stepLength.value * 60;
            } else if (stepLength.unit === 'hour') {
              blockDuration += stepLength.value * 3600;
            } else if ('steps' in step) {
              blockDuration += sumBlock(step);
            }
          }
        }
        return blockDuration * repetitions;
      }
    }
    return 0;
  }

  for (const block of blocks) {
    totalSeconds += sumBlock(block);
  }

  return totalSeconds / 60; // Convert to minutes
}

/**
 * Determine workout type from TrainingPeaks data
 */
function inferWorkoutType(
  item: LibraryItem,
  config: PlanMyPeakExportConfig,
  sportType: PlanMyPeakSportType
): WorkoutType {
  if (config.defaultWorkoutType) {
    return config.defaultWorkoutType;
  }

  const name = item.itemName.toLowerCase();
  const if_ = item.ifPlanned ?? 0;
  const primaryIntensityMetric =
    item.structure &&
    typeof item.structure === 'object' &&
    'primaryIntensityMetric' in item.structure
      ? String(
          (item.structure as { primaryIntensityMetric?: string })
            .primaryIntensityMetric ?? ''
        ).toLowerCase()
      : '';

  if (sportType === 'running') {
    if (name.includes('hill')) return 'hill_repeats';
    if (name.includes('fartlek')) return 'fartlek';
    if (name.includes('long')) return 'long_run';

    if (primaryIntensityMetric === 'percentofthresholdpace') {
      if (if_ >= 0.95) return 'interval';
      if (if_ >= 0.8) return 'tempo';
    }

    if (
      primaryIntensityMetric === 'percentofthresholdhr' ||
      primaryIntensityMetric === 'percentofmaxhr'
    ) {
      if (if_ >= 0.9) return 'interval';
      if (if_ >= 0.75) return 'tempo';
    }

    if (if_ >= 0.9) return 'interval';
    if (if_ >= 0.78) return 'tempo';
    if (if_ >= 0.65) return 'easy';
    return 'recovery';
  }

  if (sportType === 'swimming') {
    if (name.includes('drill') || name.includes('technique'))
      return 'technique';
    if (name.includes('sprint')) return 'sprint';
    if (name.includes('threshold')) return 'threshold';

    if (primaryIntensityMetric === 'percentofthresholdpace') {
      if (if_ >= 0.9) return 'interval';
      if (if_ >= 0.8) return 'threshold';
    }

    if (if_ >= 0.9) return 'interval';
    if (if_ >= 0.75) return 'endurance';
    return 'recovery';
  }

  if (if_ >= 1.05) return 'vo2max';
  if (if_ >= 0.95) return 'threshold';
  if (if_ >= 0.88) return 'sweet_spot';
  if (if_ >= 0.75) return 'tempo';
  if (if_ >= 0.7) return 'endurance';
  return 'recovery';
}

/**
 * Determine intensity level from IF
 */
function inferIntensityLevel(
  item: LibraryItem,
  config: PlanMyPeakExportConfig
): IntensityLevel {
  if (config.defaultIntensity) {
    return config.defaultIntensity;
  }

  const if_ = item.ifPlanned ?? 0;

  if (if_ >= 1.05) return 'very_hard';
  if (if_ >= 0.95) return 'hard';
  if (if_ >= 0.85) return 'moderate';
  return 'easy';
}

/**
 * Determine suitable training phases
 */
function inferSuitablePhases(
  item: LibraryItem,
  config: PlanMyPeakExportConfig,
  sportType: PlanMyPeakSportType
): TrainingPhase[] {
  if (config.defaultSuitablePhases) {
    return config.defaultSuitablePhases;
  }

  const workoutType = inferWorkoutType(item, config, sportType);

  // Map workout types to suitable phases
  switch (workoutType) {
    case 'vo2max':
      return ['Build', 'Peak'];
    case 'threshold':
      return ['Build', 'Peak'];
    case 'sweet_spot':
      return ['Base', 'Build'];
    case 'tempo':
      return ['Base', 'Build'];
    case 'endurance':
      return ['Foundation', 'Base', 'Build'];
    case 'recovery':
      return ['Recovery', 'Taper'];
    case 'easy':
    case 'long_run':
      return ['Foundation', 'Base', 'Build'];
    case 'interval':
    case 'hill_repeats':
      return ['Build', 'Peak'];
    case 'fartlek':
    case 'progression':
      return ['Base', 'Build'];
    case 'technique':
      return ['Foundation', 'Base'];
    case 'sprint':
      return ['Build', 'Peak'];
    case 'strength':
    case 'hypertrophy':
    case 'power':
    case 'circuit':
      return ['Foundation', 'Base', 'Build'];
    default:
      return ['Base', 'Build'];
  }
}

/**
 * Transform TrainingPeaks targets to PlanMyPeak targets
 */
function transformTargets(
  targets: unknown[],
  primaryIntensityMetric?: string
): PlanMyPeakTarget[] {
  const mapped = targets
    .map((target) => {
      if (!target || typeof target !== 'object') {
        return null;
      }

      return mapTpTargetToPlanMyPeakTarget(
        target as {
          minValue?: number;
          maxValue?: number;
          unit?: string;
        },
        primaryIntensityMetric
      );
    })
    .filter((target): target is PlanMyPeakTarget => target !== null);

  return mapped;
}

/**
 * Transform TrainingPeaks step to PlanMyPeak step
 */
function transformStep(
  step: unknown,
  primaryIntensityMetric?: string
): PlanMyPeakStep | PlanMyPeakStructureBlock {
  if (!step || typeof step !== 'object') {
    throw new Error('Invalid step object');
  }

  // Check if this is a nested structure block (has 'type' and 'steps')
  if ('type' in step && 'steps' in step && Array.isArray(step.steps)) {
    const block = step as {
      type: string;
      length: unknown;
      steps: unknown[];
    };

    // Recursively transform nested steps
    const transformedSteps = block.steps.map((s) =>
      transformStep(s, primaryIntensityMetric)
    );

    return {
      type: block.type === 'repetition' ? 'repetition' : 'step',
      length: transformLength(block.length),
      steps: transformedSteps,
    } as PlanMyPeakStructureBlock;
  }

  // Otherwise, it's a simple step
  const simpleStep = step as {
    name?: string;
    intensityClass?: string;
    length?: unknown;
    openDuration?: boolean;
    targets?: unknown[];
  };

  const targets = transformTargets(
    simpleStep.targets ?? [],
    primaryIntensityMetric
  );
  if (targets.length === 0) {
    throw new Error(
      `Unsupported or missing step targets for step "${simpleStep.name ?? 'Unnamed'}"`
    );
  }

  return {
    name: simpleStep.name ?? '',
    intensityClass: mapTpIntensityClassToPlanMyPeakStepIntensity(
      simpleStep.intensityClass,
      simpleStep.name
    ),
    length: transformLength(simpleStep.length),
    // PlanMyPeak uses null instead of false for openDuration
    openDuration:
      simpleStep.openDuration === false || simpleStep.openDuration === undefined
        ? null
        : simpleStep.openDuration,
    targets,
  } as PlanMyPeakStep;
}

/**
 * Transform length object
 */
function transformLength(length: unknown): PlanMyPeakLength {
  if (
    !length ||
    typeof length !== 'object' ||
    !('unit' in length) ||
    !('value' in length)
  ) {
    return { unit: 'second', value: 0 };
  }

  const l = length as { unit: string; value: number };
  if (!isSupportedTpLengthUnitForPlanMyPeak(l.unit)) {
    throw new Error(`Unsupported TP length unit for PlanMyPeak: ${l.unit}`);
  }
  return {
    unit:
      l.unit === 'second' ||
      l.unit === 'minute' ||
      l.unit === 'hour' ||
      l.unit === 'meter' ||
      l.unit === 'kilometer' ||
      l.unit === 'mile' ||
      l.unit === 'repetition'
        ? l.unit
        : 'second',
    value: l.value,
  };
}

function mapTpPrimaryIntensityMetricToPlanMyPeakPrimaryMetric(
  primaryIntensityMetric?: string
): PlanMyPeakStructure['primaryIntensityMetric'] | null {
  const normalized =
    typeof primaryIntensityMetric === 'string'
      ? primaryIntensityMetric.trim().toLowerCase()
      : '';

  if (normalized === 'percentofftp') {
    return 'percentOfFtp';
  }

  if (
    normalized === 'percentofmaxhr' ||
    normalized === 'percentofthresholdhr'
  ) {
    return 'heartRate';
  }

  if (normalized === 'percentofthresholdpace') {
    return 'percentOfThresholdPace';
  }

  if (normalized === 'pace') {
    return 'pace';
  }

  if (normalized === 'speed') {
    return 'speed';
  }

  if (normalized === 'watts') {
    return 'watts';
  }

  if (normalized === 'resistance') {
    return 'resistance';
  }

  return null;
}

/**
 * Transform structure blocks (removes begin/end, transforms targets)
 */
function transformStructure(tpStructure: unknown): PlanMyPeakStructure {
  if (
    !tpStructure ||
    typeof tpStructure !== 'object' ||
    !('structure' in tpStructure)
  ) {
    throw new Error('Invalid structure object');
  }

  const structure = tpStructure as {
    structure: unknown[];
    primaryIntensityMetric?: string;
    primaryLengthMetric?: string;
  };

  if (
    structure.primaryLengthMetric !== 'duration' &&
    structure.primaryLengthMetric !== 'distance'
  ) {
    throw new Error(
      `Unsupported TP primaryLengthMetric for PlanMyPeak: ${String(
        structure.primaryLengthMetric ?? 'unknown'
      )}`
    );
  }

  const primaryIntensityMetric =
    mapTpPrimaryIntensityMetricToPlanMyPeakPrimaryMetric(
      structure.primaryIntensityMetric
    );

  if (!primaryIntensityMetric) {
    throw new Error(
      `Unsupported TP primaryIntensityMetric for PlanMyPeak: ${String(
        structure.primaryIntensityMetric ?? 'unknown'
      )}`
    );
  }

  const transformedBlocks = structure.structure.map((block) => {
    if (!block || typeof block !== 'object') {
      throw new Error('Invalid block in structure');
    }

    const b = block as {
      type: string;
      length: unknown;
      steps: unknown[];
      begin?: number; // Will be removed
      end?: number; // Will be removed
    };

    return {
      type: b.type === 'repetition' ? 'repetition' : 'step',
      length: transformLength(b.length),
      steps: b.steps.map((step) =>
        transformStep(step, structure.primaryIntensityMetric)
      ),
      // Note: begin and end are intentionally omitted
    } as PlanMyPeakStructureBlock;
  });

  return {
    primaryIntensityMetric,
    primaryLengthMetric:
      structure.primaryLengthMetric === 'distance' ? 'distance' : 'duration',
    structure: transformedBlocks,
  };
}

function inferSportType(item: LibraryItem): PlanMyPeakSportType {
  const sportType = mapTpWorkoutTypeIdToPlanMyPeakSportType(item.workoutTypeId);
  if (!sportType) {
    throw new Error(
      `Unsupported TP workoutTypeId for PlanMyPeak: ${String(item.workoutTypeId)}`
    );
  }
  return sportType;
}

function normalizeNarrativeText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * TP has two narrative fields (`description` and `coachComments`).
 * Merge both so PlanMyPeak preserves the same context we already keep in
 * Intervals.icu exports.
 */
function buildPlanMyPeakDetailedDescription(item: LibraryItem): string | null {
  const description = normalizeNarrativeText(item.description);
  const coachComments = normalizeNarrativeText(item.coachComments);

  if (description && coachComments) {
    return `${description}\n\nPre workout comments:\n${coachComments}`;
  }

  return description ?? coachComments ?? null;
}

/**
 * Generate workout signature (hash-like identifier)
 */
function generateSignature(item: LibraryItem): string {
  // Simple hash based on item properties
  const str = `${item.exerciseLibraryItemId}${item.itemName}${item.tssPlanned}${item.totalTimePlanned}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Main transformation function: TrainingPeaks → PlanMyPeak
 */
export function transformToPlanMyPeak(
  item: LibraryItem,
  config: PlanMyPeakExportConfig
): PlanMyPeakWorkout {
  logger.debug(
    `[Transformer] Transforming workout: ${item.itemName} (ID: ${item.exerciseLibraryItemId})`
  );

  // Calculate duration from structure
  const rawBaseDuration =
    item.totalTimePlanned !== null
      ? item.totalTimePlanned * 60 // Convert hours to minutes
      : calculateDuration(item.structure);
  const baseDuration = rawBaseDuration > 0 ? rawBaseDuration : 1;

  // Calculate TSS
  const baseTss = item.tssPlanned ?? 0;

  if (rawBaseDuration <= 0) {
    logger.warn(
      `[Transformer] Using fallback base_duration_min=1 for "${item.itemName}" because TP duration was unavailable/unsupported`
    );
  }

  // Transform structure (remove polyline, begin/end, add target type/unit)
  const transformedStructure = transformStructure(item.structure);
  const sportType = inferSportType(item);

  const workout: PlanMyPeakWorkout = {
    id: generateWorkoutId(item),
    name: item.itemName,
    detailed_description: buildPlanMyPeakDetailedDescription(item),
    sport_type: sportType,
    type: inferWorkoutType(item, config, sportType),
    intensity: inferIntensityLevel(item, config),
    suitable_phases: inferSuitablePhases(item, config, sportType),
    suitable_weekdays: null, // Not available in TrainingPeaks data
    structure: transformedStructure,
    base_duration_min: baseDuration,
    base_tss: baseTss,
    variable_components: null, // Not available in TrainingPeaks data
    source_file: `workout_${item.exerciseLibraryItemId}.json`,
    source_format: 'json',
    signature: generateSignature(item),
  };

  logger.debug(
    `[Transformer] Successfully transformed workout: ${workout.name} (ID: ${workout.id})`
  );

  return workout;
}

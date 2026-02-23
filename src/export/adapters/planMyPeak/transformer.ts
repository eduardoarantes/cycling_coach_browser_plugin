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
  PlanMyPeakStep,
  PlanMyPeakStructure,
  PlanMyPeakStructureBlock,
  PlanMyPeakTarget,
  PlanMyPeakWorkout,
  TrainingPhase,
  WorkoutType,
} from '@/types/planMyPeak.types';
import { logger } from '@/utils/logger';

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
  config: PlanMyPeakExportConfig
): WorkoutType {
  if (config.defaultWorkoutType) {
    return config.defaultWorkoutType;
  }

  // Use IF (Intensity Factor) to infer workout type
  const if_ = item.ifPlanned ?? 0;

  if (if_ >= 1.05) return 'vo2max';
  if (if_ >= 0.95) return 'threshold';
  if (if_ >= 0.85) return 'tempo';
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
  if (if_ >= 0.7) return 'easy';
  return 'very_easy';
}

/**
 * Determine suitable training phases
 */
function inferSuitablePhases(
  item: LibraryItem,
  config: PlanMyPeakExportConfig
): TrainingPhase[] {
  if (config.defaultSuitablePhases) {
    return config.defaultSuitablePhases;
  }

  const workoutType = inferWorkoutType(item, config);

  // Map workout types to suitable phases
  switch (workoutType) {
    case 'vo2max':
    case 'anaerobic':
      return ['Build', 'Peak'];
    case 'threshold':
      return ['Build', 'Peak'];
    case 'tempo':
      return ['Base', 'Build'];
    case 'endurance':
      return ['Base', 'Build'];
    case 'recovery':
      return ['Recovery'];
    default:
      return ['Base', 'Build'];
  }
}

/**
 * Transform TrainingPeaks targets to PlanMyPeak targets
 */
function transformTargets(
  targets: Array<{ minValue?: number; maxValue?: number }>
): PlanMyPeakTarget[] {
  return targets.map((target) => ({
    type: 'power',
    minValue: target.minValue ?? 0,
    maxValue: target.maxValue ?? 0,
    unit: 'percentOfFtp',
  }));
}

/**
 * Transform TrainingPeaks step to PlanMyPeak step
 */
function transformStep(
  step: unknown
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
    const transformedSteps = block.steps.map((s) => transformStep(s));

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

  return {
    name: simpleStep.name ?? '',
    intensityClass: (simpleStep.intensityClass ?? 'active') as
      | 'active'
      | 'warmUp'
      | 'rest'
      | 'coolDown',
    length: transformLength(simpleStep.length),
    // PlanMyPeak uses null instead of false for openDuration
    openDuration:
      simpleStep.openDuration === false || simpleStep.openDuration === undefined
        ? null
        : simpleStep.openDuration,
    targets: transformTargets(
      (simpleStep.targets ?? []) as Array<{
        minValue?: number;
        maxValue?: number;
      }>
    ),
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
  return {
    unit: l.unit === 'repetition' ? 'repetition' : 'second',
    value: l.value,
  };
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
      steps: b.steps.map((step) => transformStep(step)),
      // Note: begin and end are intentionally omitted
    } as PlanMyPeakStructureBlock;
  });

  return {
    primaryIntensityMetric: 'percentOfFtp',
    primaryLengthMetric: 'duration',
    structure: transformedBlocks,
  };
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
  const baseDuration =
    item.totalTimePlanned !== null
      ? item.totalTimePlanned * 60 // Convert hours to minutes
      : calculateDuration(item.structure);

  // Calculate TSS
  const baseTss = item.tssPlanned ?? 0;

  // Transform structure (remove polyline, begin/end, add target type/unit)
  const transformedStructure = transformStructure(item.structure);

  const workout: PlanMyPeakWorkout = {
    id: generateWorkoutId(item),
    name: item.itemName,
    detailed_description: item.description || item.coachComments || null,
    type: inferWorkoutType(item, config),
    intensity: inferIntensityLevel(item, config),
    suitable_phases: inferSuitablePhases(item, config),
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

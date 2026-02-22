/**
 * PlanMyPeak Workout Format Types
 *
 * These types define the structure for workouts in the PlanMyPeak format.
 * Based on examples in workout_examples/workout_library_*.json
 */

/**
 * PlanMyPeak workout intensity target
 */
export interface PlanMyPeakTarget {
  type: 'power';
  minValue: number;
  maxValue: number;
  unit: 'percentOfFtp';
}

/**
 * Duration unit for workout steps
 */
export interface PlanMyPeakLength {
  unit: 'second' | 'repetition';
  value: number;
}

/**
 * Individual workout step
 */
export interface PlanMyPeakStep {
  name: string;
  intensityClass: 'active' | 'warmUp' | 'rest' | 'coolDown';
  length: PlanMyPeakLength;
  openDuration: null | boolean;
  targets: PlanMyPeakTarget[];
}

/**
 * Step or repetition block in workout structure
 */
export interface PlanMyPeakStructureBlock {
  type: 'step' | 'repetition';
  length: PlanMyPeakLength;
  steps: (PlanMyPeakStep | PlanMyPeakStructureBlock)[];
}

/**
 * Workout structure metadata
 */
export interface PlanMyPeakStructure {
  primaryIntensityMetric: 'percentOfFtp';
  primaryLengthMetric: 'duration';
  structure: PlanMyPeakStructureBlock[];
}

/**
 * Training phase categories
 */
export type TrainingPhase = 'Base' | 'Build' | 'Peak' | 'Recovery';

/**
 * Workout type categories
 */
export type WorkoutType =
  | 'vo2max'
  | 'threshold'
  | 'tempo'
  | 'endurance'
  | 'recovery'
  | 'anaerobic';

/**
 * Workout intensity level
 */
export type IntensityLevel =
  | 'very_easy'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'very_hard';

/**
 * Complete PlanMyPeak workout object
 */
export interface PlanMyPeakWorkout {
  id: string;
  name: string;
  detailed_description: string | null;
  type: WorkoutType;
  intensity: IntensityLevel;
  suitable_phases: TrainingPhase[];
  suitable_weekdays: string[] | null;
  structure: PlanMyPeakStructure;
  base_duration_min: number;
  base_tss: number;
  variable_components: unknown | null;
  source_file: string;
  source_format: 'json';
  signature: string;
}

/**
 * Export configuration for PlanMyPeak adapter
 */
export interface PlanMyPeakExportConfig {
  /** Output file name (without extension) */
  fileName?: string;
  /** Whether to include metadata in export */
  includeMetadata?: boolean;
  /** Default workout type if not specified */
  defaultWorkoutType?: WorkoutType;
  /** Default intensity if not specified */
  defaultIntensity?: IntensityLevel;
  /** Default suitable phases */
  defaultSuitablePhases?: TrainingPhase[];
}

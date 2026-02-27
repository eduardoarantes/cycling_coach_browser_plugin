/**
 * PlanMyPeak Workout Format Types
 *
 * These types define the structure for workouts in the PlanMyPeak format.
 * Based on examples in workout_examples/workout_library_*.json
 */

export type PlanMyPeakSportType =
  | 'cycling'
  | 'running'
  | 'swimming'
  | 'strength';

export type PlanMyPeakTargetUnit =
  | 'percentOfFtp'
  | 'watts'
  | 'bpm'
  | 'percentOfMaxHr'
  | 'percentOfThresholdHr'
  | 'rpm'
  | 'roundOrStridePerMinute'
  | 'secondsPerKilometer'
  | 'secondsPerMile'
  | 'secondsPer100Meters'
  | 'secondsPer100Yards'
  | 'kilometersPerHour'
  | 'milesPerHour'
  | 'kilograms'
  | 'pounds'
  | 'percentOf1RM';

/**
 * PlanMyPeak workout intensity target
 */
export type PlanMyPeakTarget =
  | {
      type: 'power';
      minValue: number;
      maxValue: number;
      unit?: 'percentOfFtp' | 'watts';
    }
  | {
      type: 'heartRate';
      minValue: number;
      maxValue: number;
      unit?: 'bpm' | 'percentOfMaxHr' | 'percentOfThresholdHr';
    }
  | {
      type: 'cadence';
      minValue: number;
      maxValue: number;
      unit?: 'rpm' | 'roundOrStridePerMinute';
    }
  | {
      type: 'pace';
      minValue: number;
      maxValue: number;
      unit?:
        | 'secondsPerKilometer'
        | 'secondsPerMile'
        | 'secondsPer100Meters'
        | 'secondsPer100Yards';
    }
  | {
      type: 'speed';
      minValue: number;
      maxValue: number;
      unit?: 'kilometersPerHour' | 'milesPerHour';
    }
  | {
      type: 'strokeRate';
      minValue: number;
      maxValue: number;
      unit?: undefined;
    }
  | {
      type: 'resistance';
      minValue: number;
      maxValue: number;
      unit?: 'kilograms' | 'pounds' | 'percentOf1RM';
    };

/**
 * Length unit for workout steps/segments
 */
export interface PlanMyPeakLength {
  unit:
    | 'second'
    | 'minute'
    | 'hour'
    | 'meter'
    | 'kilometer'
    | 'mile'
    | 'repetition';
  value: number;
}

/**
 * Individual workout step
 */
export interface PlanMyPeakStep {
  name: string;
  intensityClass: 'active' | 'warmUp' | 'rest' | 'coolDown' | 'recovery';
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
  primaryIntensityMetric:
    | 'percentOfFtp'
    | 'watts'
    | 'heartRate'
    | 'percentOfThresholdPace'
    | 'pace'
    | 'speed'
    | 'resistance';
  primaryLengthMetric: 'duration' | 'distance';
  structure: PlanMyPeakStructureBlock[];
}

/**
 * Training phase categories
 */
export type TrainingPhase =
  | 'Base'
  | 'Build'
  | 'Peak'
  | 'Recovery'
  | 'Foundation'
  | 'Taper';

/**
 * Workout type categories (multi-sport)
 */
export type WorkoutType =
  | 'mixed'
  | 'vo2max'
  | 'threshold'
  | 'sweet_spot'
  | 'tempo'
  | 'endurance'
  | 'recovery'
  | 'easy'
  | 'interval'
  | 'long_run'
  | 'fartlek'
  | 'progression'
  | 'hill_repeats'
  | 'technique'
  | 'sprint'
  | 'strength'
  | 'hypertrophy'
  | 'power'
  | 'circuit';

/**
 * Workout intensity level
 */
export type IntensityLevel = 'easy' | 'moderate' | 'hard' | 'very_hard';

/**
 * Complete PlanMyPeak workout object
 */
export interface PlanMyPeakWorkout {
  id: string;
  name: string;
  detailed_description: string | null;
  sport_type: PlanMyPeakSportType;
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
  /** External source marker used for import dedupe (e.g. TP:<sha256>) */
  source_id?: string | null;
}

/**
 * Export configuration for PlanMyPeak adapter
 */
export interface PlanMyPeakExportConfig {
  /** Output file name (without extension) */
  fileName?: string;
  /** When true, create/reuse a matching PlanMyPeak library before upload */
  createFolder?: boolean;
  /** How to handle an existing library with the same target name */
  existingLibraryAction?: 'replace' | 'append';
  /** Target PlanMyPeak library name for direct upload workflows */
  targetLibraryName?: string;
  /** Target PlanMyPeak library id for direct upload workflows */
  targetLibraryId?: string;
  /** Whether to include metadata in export */
  includeMetadata?: boolean;
  /** Default workout type if not specified */
  defaultWorkoutType?: WorkoutType;
  /** Default intensity if not specified */
  defaultIntensity?: IntensityLevel;
  /** Default suitable phases */
  defaultSuitablePhases?: TrainingPhase[];
}

export type PlanMyPeakWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface PlanMyPeakTrainingPlanMetadata {
  name: string;
  description?: string | null;
  goal?: string;
  targetFtp?: number | null;
  /** External import source marker (e.g. TP:<id>) */
  source_id?: string | null;
}

export interface PlanMyPeakWorkoutPlacementSummary {
  name: string;
  type: string;
  sport_type: PlanMyPeakSportType;
  base_duration_min: number;
  base_tss: number;
}

export interface PlanMyPeakWorkoutPlacement {
  id: string;
  order: number;
  workoutKey: string;
  workout: PlanMyPeakWorkoutPlacementSummary;
}

export interface PlanMyPeakWeekWorkoutsData {
  monday: PlanMyPeakWorkoutPlacement[];
  tuesday: PlanMyPeakWorkoutPlacement[];
  wednesday: PlanMyPeakWorkoutPlacement[];
  thursday: PlanMyPeakWorkoutPlacement[];
  friday: PlanMyPeakWorkoutPlacement[];
  saturday: PlanMyPeakWorkoutPlacement[];
  sunday: PlanMyPeakWorkoutPlacement[];
}

export interface PlanMyPeakTrainingPlanWeekData {
  weekNumber: number;
  phase: TrainingPhase;
  weeklyTss: number;
  notes?: string | null;
  workouts: PlanMyPeakWeekWorkoutsData;
}

export interface PlanMyPeakCreateTrainingPlanRequest {
  metadata: PlanMyPeakTrainingPlanMetadata;
  weeks: PlanMyPeakTrainingPlanWeekData[];
  publish?: boolean;
}

export interface PlanMyPeakSaveTrainingPlanResponse {
  success: boolean;
  planId: string;
  savedAt: string;
}

export interface PlanMyPeakTrainingPlanNote {
  id: string;
  training_plan_id: string;
  week_number: number;
  day_of_week: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanMyPeakCreatePlanNoteRequest {
  week_number: number;
  day_of_week: number;
  title: string;
  description?: string | null;
}

export interface PlanMyPeakCreatePlanNoteResponse {
  note: PlanMyPeakTrainingPlanNote;
}

export interface PlanMyPeakListPlanNotesResponse {
  notes: PlanMyPeakTrainingPlanNote[];
  total: number;
}

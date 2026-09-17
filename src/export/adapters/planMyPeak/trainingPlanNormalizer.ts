import type { LibraryItem } from '@/types';
import type { PlanWorkout } from '@/types/api.types';

interface PlanMyPeakPlanWorkoutNormalizationOptions {
  /** TP training plan id used as a synthetic source library id for adapter input */
  exerciseLibraryId?: number;
}

/**
 * The fields of a TrainingPeaks calendar workout this bridge reads. A full
 * `PlanWorkout` satisfies it; so does the compact copy kept for a captured
 * workout, which carries only these.
 */
export type PlanMyPeakNormalizableWorkout = Pick<
  PlanWorkout,
  | 'workoutId'
  | 'title'
  | 'workoutTypeValueId'
  | 'distancePlanned'
  | 'totalTimePlanned'
  | 'caloriesPlanned'
  | 'tssPlanned'
  | 'ifPlanned'
  | 'velocityPlanned'
  | 'energyPlanned'
  | 'elevationGainPlanned'
  | 'description'
  | 'coachComments'
  | 'structure'
>;

/**
 * PlanMyPeak-only adapter bridge: normalize TP training-plan workouts to the
 * TP library-item shape consumed by the existing PlanMyPeak adapter/transformer.
 */
export function normalizeTpPlanWorkoutToPlanMyPeakLibraryItem(
  workout: PlanMyPeakNormalizableWorkout,
  options: PlanMyPeakPlanWorkoutNormalizationOptions = {}
): LibraryItem {
  return {
    exerciseLibraryId: options.exerciseLibraryId ?? 0,
    exerciseLibraryItemId: workout.workoutId,
    exerciseLibraryItemType: 'Workout',
    itemName:
      typeof workout.title === 'string' && workout.title.trim().length > 0
        ? workout.title
        : `Workout ${workout.workoutId}`,
    workoutTypeId: workout.workoutTypeValueId,
    distancePlanned: workout.distancePlanned,
    totalTimePlanned: workout.totalTimePlanned,
    caloriesPlanned: workout.caloriesPlanned,
    tssPlanned: workout.tssPlanned,
    ifPlanned: workout.ifPlanned,
    velocityPlanned: workout.velocityPlanned,
    energyPlanned: workout.energyPlanned,
    elevationGainPlanned: workout.elevationGainPlanned,
    description: workout.description,
    coachComments: workout.coachComments,
    structure: workout.structure ?? undefined,
  };
}

export function normalizeTpPlanWorkoutsToPlanMyPeakLibraryItems(
  workouts: PlanWorkout[],
  options: PlanMyPeakPlanWorkoutNormalizationOptions = {}
): LibraryItem[] {
  return workouts.map((workout) =>
    normalizeTpPlanWorkoutToPlanMyPeakLibraryItem(workout, options)
  );
}

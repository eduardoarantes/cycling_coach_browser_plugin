/**
 * Selection model: what the coach picked, and what the import will cover.
 */

import { describe, it, expect } from 'vitest';
import {
  EMPTY_SELECTION,
  isSelectionEmpty,
  isWholeLibrarySelected,
  isWorkoutSelected,
  selectedItemsForLibrary,
  summarizeSelection,
  toggleLibrary,
  togglePlan,
  toggleWorkout,
  unsupportedWorkouts,
} from '@/content/overlay/selection';
import type { LibraryItem } from '@/schemas/library.schema';
import type { TrainingPlan } from '@/schemas/trainingPlan.schema';

const LIBRARY = { libraryId: 1, libraryName: 'Base Training' };

/** A minimal structure — enough for the item to be importable at all. */
const MINIMAL_STRUCTURE = {
  primaryIntensityMetric: 'percentOfFtp',
  primaryLengthMetric: 'duration',
  structure: [
    {
      type: 'step',
      length: { unit: 'minute', value: 30 },
      steps: [
        {
          name: 'Steady',
          intensityClass: 'active',
          length: { unit: 'minute', value: 30 },
          targets: [{ minValue: 70, maxValue: 80 }],
        },
      ],
    },
  ],
};

function item(
  id: number,
  workoutTypeId = 2,
  structure: unknown = MINIMAL_STRUCTURE
): LibraryItem {
  return {
    structure,
    exerciseLibraryId: 1,
    exerciseLibraryItemId: id,
    exerciseLibraryItemType: 'workout',
    itemName: `Workout ${id}`,
    workoutTypeId,
    distancePlanned: null,
    totalTimePlanned: 1,
    caloriesPlanned: null,
    tssPlanned: null,
    ifPlanned: null,
    velocityPlanned: null,
    energyPlanned: null,
    elevationGainPlanned: null,
    description: null,
    coachComments: null,
  };
}

const ITEMS = [item(10), item(11), item(12)];

function plan(planId: number, title: string): TrainingPlan {
  return { planId, title } as TrainingPlan;
}

describe('overlay selection', () => {
  describe('empty selection', () => {
    it('should start empty', () => {
      expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true);
    });

    it('should stop being empty once a library is selected', () => {
      expect(isSelectionEmpty(toggleLibrary(EMPTY_SELECTION, LIBRARY))).toBe(
        false
      );
    });

    it('should stop being empty once a plan is selected', () => {
      expect(
        isSelectionEmpty(togglePlan(EMPTY_SELECTION, plan(5, 'Century Plan')))
      ).toBe(false);
    });
  });

  describe('library selection', () => {
    it('should select a whole library', () => {
      const selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);

      expect(isWholeLibrarySelected(selection, 1)).toBe(true);
      expect(selectedItemsForLibrary(selection, 1, ITEMS)).toHaveLength(3);
    });

    it('should deselect a library when toggled again', () => {
      const selection = toggleLibrary(
        toggleLibrary(EMPTY_SELECTION, LIBRARY),
        LIBRARY
      );

      expect(isSelectionEmpty(selection)).toBe(true);
    });

    it('should treat every workout as selected under a whole-library selection', () => {
      const selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);

      expect(isWorkoutSelected(selection, 1, 10)).toBe(true);
      expect(isWorkoutSelected(selection, 1, 12)).toBe(true);
    });

    it('should not select workouts from a library that was never selected', () => {
      expect(isWorkoutSelected(EMPTY_SELECTION, 1, 10)).toBe(false);
      expect(selectedItemsForLibrary(EMPTY_SELECTION, 1, ITEMS)).toEqual([]);
    });
  });

  describe('workout selection', () => {
    it('should select an individual workout', () => {
      const selection = toggleWorkout(EMPTY_SELECTION, LIBRARY, 11, ITEMS);

      expect(selectedItemsForLibrary(selection, 1, ITEMS)).toEqual([item(11)]);
      expect(isWholeLibrarySelected(selection, 1)).toBe(false);
    });

    it('should narrow a whole-library selection when one workout is unchecked', () => {
      const whole = toggleLibrary(EMPTY_SELECTION, LIBRARY);
      const narrowed = toggleWorkout(whole, LIBRARY, 11, ITEMS);

      expect(
        selectedItemsForLibrary(narrowed, 1, ITEMS).map(
          (entry) => entry.exerciseLibraryItemId
        )
      ).toEqual([10, 12]);
    });

    it('should drop the library once its last workout is unchecked', () => {
      let selection = toggleWorkout(EMPTY_SELECTION, LIBRARY, 10, ITEMS);
      selection = toggleWorkout(selection, LIBRARY, 10, ITEMS);

      expect(isSelectionEmpty(selection)).toBe(true);
    });

    it('should accumulate multiple individually selected workouts', () => {
      let selection = toggleWorkout(EMPTY_SELECTION, LIBRARY, 10, ITEMS);
      selection = toggleWorkout(selection, LIBRARY, 12, ITEMS);

      expect(
        selectedItemsForLibrary(selection, 1, ITEMS).map(
          (entry) => entry.exerciseLibraryItemId
        )
      ).toEqual([10, 12]);
    });
  });

  describe('plan selection', () => {
    it('should carry the full plan so the export helper can use it', () => {
      const selection = togglePlan(EMPTY_SELECTION, plan(5, 'Century Plan'));

      expect(selection.plans.get(5)).toEqual({
        planId: 5,
        planName: 'Century Plan',
        plan: plan(5, 'Century Plan'),
      });
    });

    it('should deselect a plan when toggled again', () => {
      const selection = togglePlan(
        togglePlan(EMPTY_SELECTION, plan(5, 'Century Plan')),
        plan(5, 'Century Plan')
      );

      expect(selection.plans.size).toBe(0);
    });
  });

  describe('unsupported workouts', () => {
    it('should flag a training session that prescribes nothing', () => {
      // A bike workout with no segments cannot be performed, so PlanMyPeak
      // refuses it and there is nothing worth sending.
      const emptyRide = item(20, 2, null);
      const flagged = unsupportedWorkouts([item(10), emptyRide]);

      expect(flagged.map((entry) => entry.exerciseLibraryItemId)).toEqual([20]);
    });

    it('should not flag entries PlanMyPeak stores without a structure', () => {
      // Rest days, notes, races and strength sessions are stored without one:
      // for these, having nothing to prescribe is the point.
      const restDay = item(21, 7, null);
      const race = item(22, 6, null);
      const strength = item(23, 9, null);

      expect(unsupportedWorkouts([restDay, race, strength])).toEqual([]);
    });

    it('should not flag a discipline that used to be rejected locally', () => {
      // Walk and rowing have PlanMyPeak disciplines now, so a structured one is
      // sent and the server is the authority on it.
      expect(unsupportedWorkouts([item(24, 13), item(25, 12)])).toEqual([]);
    });
  });

  describe('summary', () => {
    it('should describe nothing when nothing is selected', () => {
      const summary = summarizeSelection(EMPTY_SELECTION, new Map());

      expect(summary).toMatchObject({
        libraryCount: 0,
        planCount: 0,
        workoutCount: 0,
        hasUnknownWorkoutCounts: false,
      });
    });

    it('should count a whole library once its items are loaded', () => {
      const selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);
      const summary = summarizeSelection(selection, new Map([[1, ITEMS]]));

      expect(summary.workoutCount).toBe(3);
      expect(summary.hasUnknownWorkoutCounts).toBe(false);
    });

    it('should report an unknown count for a whole library not yet loaded', () => {
      const selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);
      const summary = summarizeSelection(selection, new Map());

      expect(summary.workoutCount).toBe(0);
      expect(summary.hasUnknownWorkoutCounts).toBe(true);
    });

    it('should count individually selected workouts without loaded items', () => {
      const selection = toggleWorkout(EMPTY_SELECTION, LIBRARY, 10, ITEMS);
      const summary = summarizeSelection(selection, new Map());

      expect(summary.workoutCount).toBe(1);
      expect(summary.hasUnknownWorkoutCounts).toBe(false);
    });

    it('should surface unsupported workouts inside the selection', () => {
      const items = [item(10), item(20, 2, null)];
      const selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);
      const summary = summarizeSelection(selection, new Map([[1, items]]));

      expect(summary.unsupported.map((entry) => entry.itemName)).toEqual([
        'Workout 20',
      ]);
    });

    it('should count plans alongside libraries', () => {
      let selection = toggleLibrary(EMPTY_SELECTION, LIBRARY);
      selection = togglePlan(selection, plan(5, 'Century Plan'));
      const summary = summarizeSelection(selection, new Map([[1, ITEMS]]));

      expect(summary.libraryCount).toBe(1);
      expect(summary.planCount).toBe(1);
    });
  });
});

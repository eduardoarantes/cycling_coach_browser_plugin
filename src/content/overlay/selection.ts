/**
 * Selection model for the import overlay.
 *
 * A library is either selected whole (`'all'` — its workouts are fetched at
 * import time) or by an explicit set of workout ids. Keeping this UI-free makes
 * the mapping from selection to import payload directly testable.
 */

import type { LibraryItem } from '@/schemas/library.schema';
import type { TrainingPlan } from '@/schemas/trainingPlan.schema';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';
import { canImportTpItemToPlanMyPeak } from '@/export/adapters/planMyPeak/workoutMapping';

export type LibraryWorkoutSelection = 'all' | ReadonlySet<number>;

export interface SelectedLibrary {
  libraryId: number;
  libraryName: string;
  workouts: LibraryWorkoutSelection;
}

export interface SelectedPlan {
  planId: number;
  planName: string;
  /** The full plan, as the plan export helper needs more than id and title */
  plan: TrainingPlan;
}

export interface SelectedGroup {
  groupId: number;
  groupName: string;
  /** The full group, as the ingest endpoint takes the TrainingPeaks shape */
  group: AthleteGroup;
}

export interface OverlaySelection {
  libraries: ReadonlyMap<number, SelectedLibrary>;
  plans: ReadonlyMap<number, SelectedPlan>;
  groups: ReadonlyMap<number, SelectedGroup>;
}

export const EMPTY_SELECTION: OverlaySelection = {
  libraries: new Map(),
  plans: new Map(),
  groups: new Map(),
};

export function isSelectionEmpty(selection: OverlaySelection): boolean {
  return (
    selection.libraries.size === 0 &&
    selection.plans.size === 0 &&
    selection.groups.size === 0
  );
}

export function isLibrarySelected(
  selection: OverlaySelection,
  libraryId: number
): boolean {
  return selection.libraries.has(libraryId);
}

export function isWholeLibrarySelected(
  selection: OverlaySelection,
  libraryId: number
): boolean {
  return selection.libraries.get(libraryId)?.workouts === 'all';
}

export function isWorkoutSelected(
  selection: OverlaySelection,
  libraryId: number,
  workoutId: number
): boolean {
  const entry = selection.libraries.get(libraryId);
  if (!entry) return false;
  if (entry.workouts === 'all') return true;
  return entry.workouts.has(workoutId);
}

export function toggleLibrary(
  selection: OverlaySelection,
  library: { libraryId: number; libraryName: string }
): OverlaySelection {
  const libraries = new Map(selection.libraries);

  if (libraries.has(library.libraryId)) {
    libraries.delete(library.libraryId);
  } else {
    libraries.set(library.libraryId, {
      libraryId: library.libraryId,
      libraryName: library.libraryName,
      workouts: 'all',
    });
  }

  return { ...selection, libraries };
}

/**
 * Toggle one workout.
 *
 * Toggling a workout inside a whole-library selection narrows that selection to
 * an explicit set, which requires the library's loaded items to enumerate the
 * ones that stay selected.
 */
export function toggleWorkout(
  selection: OverlaySelection,
  library: { libraryId: number; libraryName: string },
  workoutId: number,
  loadedItems: ReadonlyArray<LibraryItem>
): OverlaySelection {
  const libraries = new Map(selection.libraries);
  const entry = libraries.get(library.libraryId);

  let workoutIds: Set<number>;
  if (!entry) {
    workoutIds = new Set([workoutId]);
  } else if (entry.workouts === 'all') {
    workoutIds = new Set(loadedItems.map((item) => item.exerciseLibraryItemId));
    workoutIds.delete(workoutId);
  } else {
    workoutIds = new Set(entry.workouts);
    if (workoutIds.has(workoutId)) {
      workoutIds.delete(workoutId);
    } else {
      workoutIds.add(workoutId);
    }
  }

  if (workoutIds.size === 0) {
    libraries.delete(library.libraryId);
  } else {
    libraries.set(library.libraryId, {
      libraryId: library.libraryId,
      libraryName: library.libraryName,
      workouts: workoutIds,
    });
  }

  return { ...selection, libraries };
}

export function togglePlan(
  selection: OverlaySelection,
  plan: TrainingPlan
): OverlaySelection {
  const plans = new Map(selection.plans);

  if (plans.has(plan.planId)) {
    plans.delete(plan.planId);
  } else {
    plans.set(plan.planId, {
      planId: plan.planId,
      planName: plan.title,
      plan,
    });
  }

  return { ...selection, plans };
}

export function isGroupSelected(
  selection: OverlaySelection,
  groupId: number
): boolean {
  return selection.groups.has(groupId);
}

export function toggleGroup(
  selection: OverlaySelection,
  group: AthleteGroup
): OverlaySelection {
  const groups = new Map(selection.groups);

  if (groups.has(group.id)) {
    groups.delete(group.id);
  } else {
    groups.set(group.id, {
      groupId: group.id,
      groupName: group.name,
      group,
    });
  }

  return { ...selection, groups };
}

/**
 * Athletes covered by the selected groups, counted once each.
 *
 * An athlete can belong to several groups, so the raw sum would overstate what
 * the import touches.
 */
export function selectedAthleteCount(selection: OverlaySelection): number {
  const athleteIds = new Set<number>();

  for (const entry of selection.groups.values()) {
    for (const athleteId of entry.group.athleteIds) {
      athleteIds.add(athleteId);
    }
  }

  return athleteIds.size;
}

/**
 * Narrow a library's loaded items to the ones the coach selected.
 */
export function selectedItemsForLibrary(
  selection: OverlaySelection,
  libraryId: number,
  loadedItems: ReadonlyArray<LibraryItem>
): LibraryItem[] {
  const entry = selection.libraries.get(libraryId);
  if (!entry) return [];
  if (entry.workouts === 'all') return [...loadedItems];

  return loadedItems.filter((item) =>
    (entry.workouts as ReadonlySet<number>).has(item.exerciseLibraryItemId)
  );
}

/**
 * Workouts in the selection whose TrainingPeaks type PlanMyPeak cannot accept.
 *
 * Surfaced before the import runs so the coach is not surprised by silently
 * skipped workouts in the result.
 */
export function unsupportedWorkouts(
  items: ReadonlyArray<LibraryItem>
): LibraryItem[] {
  return items.filter((item) => !canImportTpItemToPlanMyPeak(item));
}

export interface SelectionSummary {
  libraryCount: number;
  planCount: number;
  groupCount: number;
  /** Distinct athletes across the selected groups */
  athleteCount: number;
  /** Workouts the import will cover, across libraries whose items are loaded */
  workoutCount: number;
  /**
   * True when a whole library is selected but its workouts have not been
   * loaded yet, so `workoutCount` is a lower bound rather than the total.
   */
  hasUnknownWorkoutCounts: boolean;
  /** Selected workouts PlanMyPeak cannot accept, from loaded libraries */
  unsupported: LibraryItem[];
}

/**
 * Describe what the current selection covers, using whatever library items have
 * been loaded so far.
 */
export function summarizeSelection(
  selection: OverlaySelection,
  loadedItemsByLibrary: ReadonlyMap<number, ReadonlyArray<LibraryItem>>
): SelectionSummary {
  let workoutCount = 0;
  let hasUnknownWorkoutCounts = false;
  const unsupported: LibraryItem[] = [];

  for (const entry of selection.libraries.values()) {
    const loaded = loadedItemsByLibrary.get(entry.libraryId);

    if (entry.workouts !== 'all') {
      workoutCount += entry.workouts.size;
    } else if (loaded) {
      workoutCount += loaded.length;
    } else {
      hasUnknownWorkoutCounts = true;
    }

    if (loaded) {
      unsupported.push(
        ...unsupportedWorkouts(
          selectedItemsForLibrary(selection, entry.libraryId, loaded)
        )
      );
    }
  }

  return {
    libraryCount: selection.libraries.size,
    planCount: selection.plans.size,
    groupCount: selection.groups.size,
    athleteCount: selectedAthleteCount(selection),
    workoutCount,
    hasUnknownWorkoutCounts,
    unsupported,
  };
}

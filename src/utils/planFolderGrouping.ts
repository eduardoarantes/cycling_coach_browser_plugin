/**
 * Grouping training plans into their TrainingPeaks plan folders.
 *
 * UI-free and shared by the popup's plan list and the in-page import overlay,
 * so the two surfaces cannot show the same plans under different groupings.
 */

import type { PlanFolder, TrainingPlan } from '@/schemas/trainingPlan.schema';

/** Bucket id for plans that belong to no folder. */
export const UNGROUPED_FOLDER_ID = '__ungrouped__';

/** Label for the bucket of plans that belong to no folder. */
export const UNGROUPED_FOLDER_NAME = 'Ungrouped';

export interface PlanFolderGroup {
  id: string;
  name: string;
  plans: TrainingPlan[];
}

/**
 * Group plans by their TrainingPeaks folder.
 *
 * Membership lives on the folder as `planIds` rather than on the plan, so a
 * plan's group is found by looking its id up across folders. Plans in no folder
 * get an "Ungrouped" bucket rather than being hidden: a plan that belongs to
 * nothing must still be reachable.
 *
 * A plan claimed by an earlier folder is not repeated in a later one, so a
 * plan appears exactly once even if the API reports it in more than one folder.
 *
 * A folder naming a plan id that no plan matches — deleted upstream, or absent
 * from the list being grouped — contributes nothing, since the plans are what
 * is filtered rather than the ids. A folder can therefore come back empty, and
 * is kept: a library a coach made but never filled is a real state, and hiding
 * it would read as the library vanishing.
 */
export function groupPlansByFolder(
  plans: ReadonlyArray<TrainingPlan>,
  folders: ReadonlyArray<PlanFolder> | undefined
): PlanFolderGroup[] {
  const groups: PlanFolderGroup[] = [];
  const claimed = new Set<number>();

  for (const folder of folders ?? []) {
    const inFolder = plans.filter(
      (plan) =>
        folder.planIds.includes(plan.planId) && !claimed.has(plan.planId)
    );
    inFolder.forEach((plan) => claimed.add(plan.planId));
    groups.push({
      id: folder.folderId,
      name: folder.folderName,
      plans: inFolder,
    });
  }

  const ungrouped = plans.filter((plan) => !claimed.has(plan.planId));
  if (ungrouped.length > 0) {
    groups.push({
      id: UNGROUPED_FOLDER_ID,
      name: UNGROUPED_FOLDER_NAME,
      plans: ungrouped,
    });
  }

  return groups;
}

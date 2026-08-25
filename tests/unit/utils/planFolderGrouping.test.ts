/**
 * Grouping plans into their TrainingPeaks plan libraries.
 *
 * Shared by the popup's plan list and the overlay's plan browser, so the rules
 * here are what keeps those two surfaces showing the same shape.
 */

import { describe, it, expect } from 'vitest';
import {
  groupPlansByFolder,
  UNGROUPED_FOLDER_ID,
} from '@/utils/planFolderGrouping';
import type { PlanFolder, TrainingPlan } from '@/schemas/trainingPlan.schema';

function plan(planId: number, title = `Plan ${planId}`): TrainingPlan {
  return { planId, title } as TrainingPlan;
}

function folder(
  folderId: string,
  folderName: string,
  planIds: number[]
): PlanFolder {
  return { folderId, folderName, ownerId: 1, planIds };
}

describe('groupPlansByFolder', () => {
  it('should put each plan in its own library', () => {
    const groups = groupPlansByFolder(
      [plan(1), plan(2), plan(3)],
      [folder('f1', 'Custom Plans', [1, 2]), folder('f2', 'Off the Shelf', [3])]
    );

    expect(groups.map((group) => group.name)).toEqual([
      'Custom Plans',
      'Off the Shelf',
    ]);
    expect(groups[0].plans.map((p) => p.planId)).toEqual([1, 2]);
    expect(groups[1].plans.map((p) => p.planId)).toEqual([3]);
  });

  it('should keep a plan that belongs to no library reachable', () => {
    const groups = groupPlansByFolder(
      [plan(1), plan(2)],
      [folder('f1', 'Custom Plans', [1])]
    );

    // Hiding it would make a plan unimportable with no way to discover why.
    const ungrouped = groups.find((g) => g.id === UNGROUPED_FOLDER_ID);
    expect(ungrouped?.plans.map((p) => p.planId)).toEqual([2]);
  });

  it('should not add an empty ungrouped bucket', () => {
    const groups = groupPlansByFolder(
      [plan(1)],
      [folder('f1', 'Custom Plans', [1])]
    );

    expect(groups.map((g) => g.id)).toEqual(['f1']);
  });

  it('should list a plan once even when two libraries claim it', () => {
    const groups = groupPlansByFolder(
      [plan(1)],
      [folder('f1', 'First', [1]), folder('f2', 'Second', [1])]
    );

    expect(groups[0].plans).toHaveLength(1);
    expect(groups[1].plans).toHaveLength(0);
  });

  it('should keep an empty library, which is a real thing a coach made', () => {
    const groups = groupPlansByFolder(
      [plan(1)],
      [folder('f1', 'Custom Plans', [1]), folder('f2', 'Empty', [])]
    );

    expect(groups.map((g) => g.name)).toEqual(['Custom Plans', 'Empty']);
  });

  it('should treat every plan as ungrouped when folders are unavailable', () => {
    const groups = groupPlansByFolder([plan(1), plan(2)], undefined);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(UNGROUPED_FOLDER_ID);
    expect(groups[0].plans).toHaveLength(2);
  });

  it('should return nothing for no plans and no folders', () => {
    expect(groupPlansByFolder([], [])).toEqual([]);
  });

  it('should ignore a plan id no plan matches', () => {
    const groups = groupPlansByFolder(
      [plan(1)],
      [folder('f1', 'Custom Plans', [1, 999])]
    );

    // 999 was deleted upstream or filtered out. Plans are what gets filtered,
    // not ids, so it contributes nothing rather than a blank row.
    expect(groups[0].plans.map((p) => p.planId)).toEqual([1]);
  });

  it('should keep a library whose every plan id is stale', () => {
    const groups = groupPlansByFolder(
      [plan(1)],
      [folder('f1', 'Custom Plans', [1]), folder('f2', 'Stale', [998, 999])]
    );

    // Still the coach's library, now empty. Hiding it reads as it vanishing.
    expect(groups.map((g) => g.name)).toEqual(['Custom Plans', 'Stale']);
    expect(groups[1].plans).toEqual([]);
  });
});

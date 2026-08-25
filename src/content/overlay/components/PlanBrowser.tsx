/**
 * Browse and select TrainingPeaks training plans, and preview the contents of
 * the plan the coach opens.
 *
 * Plans are shown inside their TrainingPeaks plan library, matching the popup's
 * plan list: a coach who organises plans into libraries needs to find them the
 * same way on both surfaces. Grouping comes from the shared
 * `groupPlansByFolder` helper so the two cannot drift.
 *
 * Selection survives navigating between libraries — it lives in the overlay
 * above this component — so plans can be picked from more than one library in a
 * single import.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { useTrainingPlanFolders } from '@/hooks/useTrainingPlanFolders';
import { groupPlansByFolder } from '@/utils/planFolderGrouping';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { usePlanNotes } from '@/hooks/usePlanNotes';
import { usePlanEvents } from '@/hooks/usePlanEvents';
import type { TrainingPlan } from '@/schemas/trainingPlan.schema';
import { type OverlaySelection } from '../selection';
import { EmptyState, ErrorState, LoadingState } from './StateMessages';

export interface PlanBrowserProps {
  enabled: boolean;
  /** Plan the page asked to pre-select when opening the overlay */
  preselectedPlanId: number | null;
  selection: OverlaySelection;
  expandedPlanId: number | null;
  onExpand: (planId: number | null) => void;
  onTogglePlan: (plan: TrainingPlan) => void;
}

function PlanContents({ planId }: { planId: number }): ReactElement {
  const workouts = usePlanWorkouts(planId);
  const notes = usePlanNotes(planId);
  const events = usePlanEvents(planId);

  if (workouts.isLoading || notes.isLoading || events.isLoading) {
    return <LoadingState label="Loading plan contents…" />;
  }

  const failure = workouts.error ?? notes.error ?? events.error;
  if (failure) {
    return (
      <ErrorState
        message={`Could not load plan contents: ${failure.message}`}
        onRetry={() => {
          void workouts.refetch();
          void notes.refetch();
          void events.refetch();
        }}
      />
    );
  }

  const workoutCount = workouts.data?.length ?? 0;
  const noteCount = notes.data?.length ?? 0;
  const eventCount = events.data?.length ?? 0;

  if (workoutCount + noteCount + eventCount === 0) {
    return <EmptyState label="This training plan is empty." />;
  }

  return (
    <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-600">
      <p>
        {workoutCount} workout{workoutCount === 1 ? '' : 's'}, {noteCount} note
        {noteCount === 1 ? '' : 's'}, {eventCount} event
        {eventCount === 1 ? '' : 's'}
      </p>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
        {(workouts.data ?? []).map((workout) => (
          <li key={workout.workoutId} className="truncate text-gray-700">
            {workout.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanBrowser({
  enabled,
  preselectedPlanId,
  selection,
  expandedPlanId,
  onExpand,
  onTogglePlan,
}: PlanBrowserProps): ReactElement {
  const {
    data: plans,
    isLoading,
    error,
    refetch,
  } = useTrainingPlans({ enabled });
  const { data: planFolders } = useTrainingPlanFolders({ enabled });

  // `undefined` means the coach has not navigated yet, so the library holding a
  // pre-selected plan can stand in. Once they navigate, their choice wins -
  // including navigating back out, which is an explicit `null`.
  const [openFolderId, setOpenFolderId] = useState<string | null | undefined>(
    undefined
  );

  const folderGroups = useMemo(
    () => groupPlansByFolder(plans ?? [], planFolders),
    [plans, planFolders]
  );

  const preselectedPlanFolderId = useMemo(() => {
    if (preselectedPlanId === null) return null;
    return (
      folderGroups.find((group) =>
        group.plans.some((plan) => plan.planId === preselectedPlanId)
      )?.id ?? null
    );
  }, [folderGroups, preselectedPlanId]);

  const openFolder = useMemo(() => {
    const id =
      openFolderId === undefined ? preselectedPlanFolderId : openFolderId;
    return folderGroups.find((group) => group.id === id) ?? null;
  }, [folderGroups, openFolderId, preselectedPlanFolderId]);

  // Apply the page's pre-selection once, as soon as the named plan is known.
  // The library holding it opens by derivation above, so the coach lands on the
  // plan rather than on a library list with a selection they cannot see.
  const preselectApplied = useRef(false);
  useEffect(() => {
    if (preselectApplied.current) return;
    if (preselectedPlanId === null || !plans) return;

    const match = plans.find((plan) => plan.planId === preselectedPlanId);
    if (!match) return;

    preselectApplied.current = true;
    if (!selection.plans.has(preselectedPlanId)) {
      onTogglePlan(match);
    }
  }, [plans, preselectedPlanId, selection, onTogglePlan]);

  if (isLoading) {
    return <LoadingState label="Loading training plans…" />;
  }

  if (error) {
    return (
      <ErrorState
        message={`Could not load training plans: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!plans || plans.length === 0) {
    return <EmptyState label="No TrainingPeaks training plans found." />;
  }

  if (!openFolder) {
    return (
      <ul className="space-y-2">
        {folderGroups.map((group) => {
          const selectedInGroup = group.plans.filter((plan) =>
            selection.plans.has(plan.planId)
          ).length;

          return (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => setOpenFolderId(group.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {group.plans.length} plan
                    {group.plans.length === 1 ? '' : 's'}
                    {selectedInGroup > 0
                      ? ` · ${selectedInGroup} selected`
                      : ''}
                  </p>
                </div>
                <span aria-hidden="true" className="text-gray-400">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenFolderId(null)}
        className="rounded-md px-1 py-1 text-xs font-medium text-blue-700 hover:underline"
      >
        ← All plan libraries
      </button>
      <p className="px-1 text-sm font-medium text-gray-800">
        {openFolder.name}
      </p>
      {openFolder.plans.length === 0 ? (
        // A library a coach made but never filled is a real state. Saying so
        // reads as deliberate, where an empty panel reads as a failure to load.
        <EmptyState label="No plans in this library." />
      ) : null}
      <ul className="space-y-2">
        {openFolder.plans.map((plan) => {
          const isExpanded = expandedPlanId === plan.planId;

          return (
            <li
              key={plan.planId}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <div className="flex items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={selection.plans.has(plan.planId)}
                  onChange={() => onTogglePlan(plan)}
                  aria-label={`Select training plan ${plan.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {plan.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onExpand(isExpanded ? null : plan.planId)}
                  aria-expanded={isExpanded}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {isExpanded ? 'Hide contents' : 'View contents'}
                </button>
              </div>

              {isExpanded ? <PlanContents planId={plan.planId} /> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

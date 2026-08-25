/**
 * Browse and select the coach's TrainingPeaks athlete groups.
 *
 * Groups are flat — there is nothing to expand — so this view is a plain
 * checkbox list rather than the expandable pattern the library and plan
 * browsers use.
 */

import type { ReactElement } from 'react';
import { useAthleteGroups } from '@/hooks/useAthleteGroups';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';
import { type OverlaySelection } from '../selection';
import { EmptyState, ErrorState, LoadingState } from './StateMessages';

export interface GroupBrowserProps {
  enabled: boolean;
  selection: OverlaySelection;
  onToggleGroup: (group: AthleteGroup) => void;
}

export function GroupBrowser({
  enabled,
  selection,
  onToggleGroup,
}: GroupBrowserProps): ReactElement {
  const {
    data: groups,
    isLoading,
    error,
    refetch,
  } = useAthleteGroups({
    enabled,
  });

  if (isLoading) {
    return <LoadingState label="Loading athlete groups…" />;
  }

  if (error) {
    return (
      <ErrorState
        message={`Could not load athlete groups: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!groups || groups.length === 0) {
    return <EmptyState label="No TrainingPeaks athlete groups found." />;
  }

  return (
    <>
      <p className="px-1 text-xs text-gray-600">
        Groups are matched to athletes that already exist in PlanMyPeak.
        TrainingPeaks athletes with no PlanMyPeak match are skipped.
      </p>
      <ul className="space-y-2">
        {groups.map((group) => {
          const athleteCount = group.athleteIds.length;

          return (
            <li
              key={group.id}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <label className="flex cursor-pointer items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={selection.groups.has(group.id)}
                  onChange={() => onToggleGroup(group)}
                  aria-label={`Select athlete group ${group.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {athleteCount} athlete{athleteCount === 1 ? '' : 's'}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}

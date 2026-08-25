/**
 * Shows what the current selection covers before the import runs, including
 * workouts that will be skipped because PlanMyPeak does not support their type.
 */

import type { ReactElement } from 'react';
import type { SelectionSummary as Summary } from '../selection';

function describe(summary: Summary): string {
  const parts: string[] = [];

  if (summary.libraryCount > 0) {
    const workouts = summary.hasUnknownWorkoutCounts
      ? `${summary.workoutCount}+ workouts`
      : `${summary.workoutCount} workout${summary.workoutCount === 1 ? '' : 's'}`;
    parts.push(
      `${workouts} from ${summary.libraryCount} librar${summary.libraryCount === 1 ? 'y' : 'ies'}`
    );
  }

  if (summary.planCount > 0) {
    parts.push(
      `${summary.planCount} training plan${summary.planCount === 1 ? '' : 's'}`
    );
  }

  if (summary.groupCount > 0) {
    parts.push(
      `${summary.groupCount} athlete group${summary.groupCount === 1 ? '' : 's'} (${summary.athleteCount} athlete${summary.athleteCount === 1 ? '' : 's'})`
    );
  }

  if (parts.length === 0) return 'Nothing selected yet';
  if (parts.length === 1) return parts[0];

  // "a, b and c" rather than "a and b and c" once a third kind is selectable.
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function SelectionSummary({
  summary,
}: {
  summary: Summary;
}): ReactElement {
  return (
    <div className="text-xs text-gray-600">
      <p>{describe(summary)}</p>
      {summary.unsupported.length > 0 ? (
        <p className="mt-1 text-amber-700">
          {summary.unsupported.length} selected workout
          {summary.unsupported.length === 1 ? '' : 's'} will be skipped:{' '}
          {summary.unsupported
            .slice(0, 3)
            .map((item) => item.itemName)
            .join(', ')}
          {summary.unsupported.length > 3
            ? ` and ${summary.unsupported.length - 3} more`
            : ''}
        </p>
      ) : null}
    </div>
  );
}

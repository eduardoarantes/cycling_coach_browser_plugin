/**
 * Progress shown while an import runs: which item is being processed and how
 * many are done out of the total.
 */

import type { ReactElement } from 'react';
import type { TrainingPlanExportProgressDialogState } from '@/types/export.types';

export function ImportProgress({
  progress,
}: {
  progress: TrainingPlanExportProgressDialogState;
}): ReactElement {
  const percent =
    progress.overallTotal > 0
      ? Math.round((progress.overallCurrent / progress.overallTotal) * 100)
      : 0;

  return (
    <div role="status" className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-800">
            {progress.currentPhaseLabel}
          </span>
          <span className="text-xs text-gray-600">
            {progress.overallCurrent} of {progress.overallTotal}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
        {progress.phases.map((phase) => (
          <li key={phase.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-gray-700">
              {phase.label}
            </span>
            <span
              className={
                phase.status === 'completed'
                  ? 'shrink-0 text-green-700'
                  : phase.status === 'failed'
                    ? 'shrink-0 text-red-700'
                    : phase.status === 'started'
                      ? 'shrink-0 text-blue-700'
                      : 'shrink-0 text-gray-400'
              }
            >
              {phase.status === 'completed'
                ? 'Done'
                : phase.status === 'failed'
                  ? 'Failed'
                  : phase.status === 'started'
                    ? 'Importing…'
                    : 'Pending'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

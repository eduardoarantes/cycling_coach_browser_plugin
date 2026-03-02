import type { ReactElement } from 'react';

export interface PlanMyPeakEnvironmentIndicatorProps {
  isVisible: boolean;
  hostLabel: string;
}

export function PlanMyPeakEnvironmentIndicator({
  isVisible,
  hostLabel,
}: PlanMyPeakEnvironmentIndicatorProps): ReactElement | null {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900">
            Local PlanMyPeak Target
          </p>
          <p className="text-xs text-amber-800">
            This build targets {hostLabel} instead of planmypeak.com.
          </p>
        </div>
      </div>
    </div>
  );
}

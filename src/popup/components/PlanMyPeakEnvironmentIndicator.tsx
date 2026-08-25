import type { ReactElement } from 'react';
import {
  PLANMYPEAK_ENVIRONMENTS,
  type PlanMyPeakEnvironment,
} from '@/utils/constants';

export interface PlanMyPeakEnvironmentIndicatorProps {
  environment: PlanMyPeakEnvironment;
  hostLabel: string;
}

/**
 * Banner shown while the extension is pointed at a non-production PlanMyPeak
 * deployment (staging or the local dev app), so imports are never mistaken for
 * production ones. Renders nothing on production.
 */
export function PlanMyPeakEnvironmentIndicator({
  environment,
  hostLabel,
}: PlanMyPeakEnvironmentIndicatorProps): ReactElement | null {
  if (environment === 'production') {
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
            {PLANMYPEAK_ENVIRONMENTS[environment].label} PlanMyPeak Target
          </p>
          <p className="text-xs text-amber-800">
            This extension targets {hostLabel} instead of{' '}
            {PLANMYPEAK_ENVIRONMENTS.production.hostLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}

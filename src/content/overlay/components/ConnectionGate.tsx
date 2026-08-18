/**
 * Blocks the import when a required connection is missing, naming which one and
 * offering a way to restore it — rather than letting the coach select workouts
 * and then fail at upload time.
 */

import type { ReactElement } from 'react';

export interface ConnectionGateProps {
  isTrainingPeaksAuthenticated: boolean;
  isPlanMyPeakAuthenticated: boolean;
  isChecking: boolean;
  onOpenTrainingPeaks: () => void;
  onRecheck: () => void;
}

export function ConnectionGate({
  isTrainingPeaksAuthenticated,
  isPlanMyPeakAuthenticated,
  isChecking,
  onOpenTrainingPeaks,
  onRecheck,
}: ConnectionGateProps): ReactElement | null {
  if (isTrainingPeaksAuthenticated && isPlanMyPeakAuthenticated) {
    return null;
  }

  const missingTrainingPeaks = !isTrainingPeaksAuthenticated;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">
        {missingTrainingPeaks
          ? 'TrainingPeaks sign-in required'
          : 'PlanMyPeak sign-in required'}
      </p>
      <p className="mt-1 text-xs">
        {missingTrainingPeaks
          ? 'Sign in to TrainingPeaks so the extension can read your libraries and training plans. If you are already signed in, reload TrainingPeaks so your session is detected.'
          : 'Sign in to PlanMyPeak so workouts can be imported into your account.'}
      </p>
      <div className="mt-2 flex gap-2">
        {missingTrainingPeaks ? (
          <button
            type="button"
            onClick={onOpenTrainingPeaks}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Open TrainingPeaks
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRecheck}
          disabled={isChecking}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? 'Checking…' : 'Re-check'}
        </button>
      </div>
    </div>
  );
}

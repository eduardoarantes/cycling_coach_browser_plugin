/**
 * CapturedWorkoutList
 *
 * The New Workouts tab: workouts captured from the TrainingPeaks calendar,
 * newest first, with per-row Send / Dismiss and Send all / Clear actions.
 *
 * The list reads only local storage. Sending is gated exactly like every
 * other import: disabled without PlanMyPeak authentication or with the
 * PlanMyPeak connection turned off, and blocked on a confirmed
 * TrainingPeaks/PlanMyPeak account mismatch, with the shared banner as the
 * explanation. Send outcomes are written by the background as each upload
 * completes, so the rows reflect storage, not this component's memory.
 */

import { useMemo, type ReactElement } from 'react';
import {
  CalendarPlus as CalendarIcon,
  Trash2 as ClearIcon,
} from 'lucide-react';
import { useCapturedWorkouts } from '@/hooks/useCapturedWorkouts';
import { useSendCapturedWorkouts } from '@/hooks/useSendCapturedWorkouts';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useConnectionSettings } from '@/hooks/useConnectionSettings';
import { usePlanMyPeakAccountMatch } from '@/hooks/usePlanMyPeakAccountMatch';
import { CapturedWorkoutRow } from './CapturedWorkoutRow';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

export function CapturedWorkoutList(): ReactElement {
  const { records, pendingCount, isLoading, error, dismiss, clearFinished } =
    useCapturedWorkouts();
  const {
    send,
    sendAllPending,
    sendingKeys,
    isSending,
    lastSummary,
    outcomes,
  } = useSendCapturedWorkouts(records);
  const { isAuthenticated: isPlanMyPeakAuthenticated } = useMyPeakAuth();
  const { isPlanMyPeakEnabled } = useConnectionSettings();
  const { status: accountMatchStatus } = usePlanMyPeakAccountMatch();

  const isAccountMismatch = accountMatchStatus === 'mismatch';

  const sendDisabledReason = useMemo(() => {
    if (!isPlanMyPeakEnabled) {
      return 'Enable the PlanMyPeak connection in Settings to send workouts.';
    }
    if (!isPlanMyPeakAuthenticated) {
      return 'Connect PlanMyPeak in Settings to send workouts.';
    }
    if (isAccountMismatch) {
      return 'Sending is blocked while the TrainingPeaks and PlanMyPeak accounts do not match.';
    }
    return undefined;
  }, [isAccountMismatch, isPlanMyPeakAuthenticated, isPlanMyPeakEnabled]);

  const canSend = sendDisabledReason === undefined;
  const finishedCount = records.filter(
    (record) => record.status !== 'pending'
  ).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        Could not load captured workouts: {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-10 w-10" aria-hidden="true" />}
        title="No new workouts yet"
        message="Workouts you create on an athlete's TrainingPeaks calendar will appear here, ready to send to your PlanMyPeak library."
      />
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">New Workouts</h2>
          <p className="text-xs text-gray-600">
            {records.length} captured · {pendingCount} pending
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void sendAllPending();
            }}
            disabled={!canSend || isSending || pendingCount === 0}
            title={sendDisabledReason}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? 'Sending…' : 'Send all pending'}
          </button>
          <button
            type="button"
            onClick={() => {
              void clearFinished();
            }}
            disabled={isSending || finishedCount === 0}
            aria-label="Clear sent & dismissed"
            title="Clear sent & dismissed"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClearIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {sendDisabledReason ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {sendDisabledReason}
        </p>
      ) : null}

      {lastSummary && !isSending ? (
        <p
          className="mb-3 text-xs text-gray-600"
          data-testid="captured-send-summary"
        >
          Last send: {lastSummary.sent} sent
          {lastSummary.failed > 0 ? `, ${lastSummary.failed} failed` : ''}
          {lastSummary.skipped > 0 ? `, ${lastSummary.skipped} skipped` : ''}
          {lastSummary.errors.length > 0
            ? ` — ${lastSummary.errors.join('; ')}`
            : ''}
        </p>
      ) : null}

      <ul className="space-y-2">
        {records.map((record) => (
          <CapturedWorkoutRow
            key={record.key}
            record={record}
            isSending={sendingKeys.has(record.key)}
            canSend={canSend}
            sendDisabledReason={sendDisabledReason}
            outcome={outcomes[record.key]}
            onSend={(key) => {
              void send([key]);
            }}
            onDismiss={(key) => {
              void dismiss(key);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

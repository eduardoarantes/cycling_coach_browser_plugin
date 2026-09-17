/**
 * CapturedWorkoutRow
 *
 * One workout captured from the TrainingPeaks calendar: what it is, where it
 * came from, where it stands, and the two things the coach can do with it.
 */

import type { ReactElement } from 'react';
import { Loader2, Send as SendIcon, X as DismissIcon } from 'lucide-react';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';
import { mapTpWorkoutTypeIdToPlanMyPeakDiscipline } from '@/export/adapters/planMyPeak/workoutMapping';
import {
  formatDisciplineLabel,
  formatPlannedDuration,
  formatWorkoutDay,
} from '@/utils/capturedWorkoutFormat';

export interface CapturedWorkoutRowProps {
  record: CapturedWorkoutRecord;
  /** True while this row's send is in flight */
  isSending: boolean;
  /** False when sending is gated (no PlanMyPeak auth, account mismatch) */
  canSend: boolean;
  /** Shown on the disabled Send button when `canSend` is false */
  sendDisabledReason?: string;
  /** Result of the last send that included this row, if any */
  outcome?: { error?: string; warning?: string };
  onSend: (key: string) => void;
  onDismiss: (key: string) => void;
}

const STATUS_STYLES: Record<CapturedWorkoutRecord['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<CapturedWorkoutRecord['status'], string> = {
  pending: 'Pending',
  sent: 'Sent',
  dismissed: 'Dismissed',
};

export function CapturedWorkoutRow({
  record,
  isSending,
  canSend,
  sendDisabledReason,
  outcome,
  onSend,
  onDismiss,
}: CapturedWorkoutRowProps): ReactElement {
  const { workout } = record;
  const sport = formatDisciplineLabel(
    mapTpWorkoutTypeIdToPlanMyPeakDiscipline(workout.workoutTypeValueId)
  );
  const duration = formatPlannedDuration(workout.totalTimePlanned);
  const tss =
    workout.tssPlanned !== null && Number.isFinite(workout.tssPlanned)
      ? `TSS ${Math.round(workout.tssPlanned)}`
      : null;
  const metrics = [sport, duration, tss].filter(Boolean).join(' · ');

  const showSend = record.status !== 'dismissed';
  const showDismiss = record.status === 'pending';
  const sendDisabled = isSending || !canSend;
  const errorText = record.lastSendError ?? outcome?.error;

  return (
    <li
      className="rounded-lg border border-gray-200 bg-white p-3"
      data-testid={`captured-row-${record.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {workout.title}
            </h3>
            {record.environment === 'sandbox' ? (
              <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-700">
                Sandbox
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-gray-600">
            {formatWorkoutDay(workout.workoutDay)} · Athlete {record.athleteId}
          </p>
          {metrics ? (
            <p className="mt-0.5 text-xs text-gray-500">{metrics}</p>
          ) : null}
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[record.status]}`}
        >
          {isSending ? 'Sending…' : STATUS_LABELS[record.status]}
        </span>
      </div>

      {record.status === 'sent' && record.planMyPeakLibraryName ? (
        <p className="mt-1.5 text-xs text-green-700">
          In {record.planMyPeakLibraryName}
        </p>
      ) : null}

      {errorText ? (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {errorText}
        </p>
      ) : null}

      {outcome?.warning ? (
        <p className="mt-1.5 text-xs text-amber-700">{outcome.warning}</p>
      ) : null}

      {showSend || showDismiss ? (
        <div className="mt-2 flex items-center gap-2">
          {showSend ? (
            <button
              type="button"
              onClick={() => onSend(record.key)}
              disabled={sendDisabled}
              title={!canSend ? sendDisabledReason : undefined}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <SendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {record.status === 'sent' ? 'Send again' : 'Send to PlanMyPeak'}
            </button>
          ) : null}

          {showDismiss ? (
            <button
              type="button"
              onClick={() => onDismiss(record.key)}
              disabled={isSending}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DismissIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

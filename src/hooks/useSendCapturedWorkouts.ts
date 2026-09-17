/**
 * Send captured workouts to the coach's default PlanMyPeak library.
 *
 * Runs the shared PlanMyPeak path — `planMyPeakAdapter.transform` →
 * `validate` → `export` — once per TrainingPeaks environment, with
 * `createFolder: false` so the target resolves to the `isDefault` library and
 * a namespaced provider id (`cal:{workoutId}`, `cal-sandbox:{workoutId}`)
 * minted by the transformer.
 *
 * This hook does **not** write send outcomes. The background upload loop
 * marks each record `sent` or stores its `lastSendError` as it goes, through
 * `capturedKeys` on the export message, so a popup closed mid-send loses
 * nothing. The one thing recorded from here is a transform-time skip: a
 * workout the adapter could not turn into a PlanMyPeak workout never reaches
 * the upload loop, so its reason is stored through the normal update message.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ExportItemResult } from '@/export/adapters/base';
import type { ValidationMessage } from '@/export/adapters/base';
import type { ApiResponse } from '@/types/api.types';
import type {
  CapturedWorkoutRecord,
  UpdateCapturedWorkoutMessage,
} from '@/types';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type { TrainingPeaksEnvironment } from '@/utils/constants';
import {
  normalizeTpPlanWorkoutToPlanMyPeakLibraryItem,
  planMyPeakAdapter,
} from '@/export/adapters/planMyPeak';
import { logger } from '@/utils/logger';

/** Provider-id namespace for a capture's environment. */
export function providerIdNamespaceFor(
  environment: TrainingPeaksEnvironment
): string {
  return environment === 'sandbox' ? 'cal-sandbox' : 'cal';
}

/** What happened to one record in the last send, keyed by record key. */
export interface CapturedSendOutcome {
  key: string;
  status: 'sent' | 'failed' | 'skipped';
  /** Upload or transform error, for the row's error line */
  error?: string;
  /** Adapter warning that did not stop the upload (e.g. sent without structure) */
  warning?: string;
  remoteId?: string;
  libraryName?: string;
}

export interface CapturedSendSummary {
  sent: number;
  failed: number;
  skipped: number;
  outcomes: Record<string, CapturedSendOutcome>;
  /** Run-level errors not attributable to one workout (e.g. library lookup) */
  errors: string[];
}

export interface UseSendCapturedWorkoutsReturn {
  send: (keys: string[]) => Promise<CapturedSendSummary>;
  sendAllPending: () => Promise<CapturedSendSummary>;
  /** Keys currently being sent */
  sendingKeys: ReadonlySet<string>;
  isSending: boolean;
  lastSummary: CapturedSendSummary | null;
  /** Per-record outcome of the last send that included it */
  outcomes: Record<string, CapturedSendOutcome>;
}

/** The library-item shape the transformer consumes, from a stored record. */
export function toLibraryItem(record: CapturedWorkoutRecord): LibraryItem {
  return normalizeTpPlanWorkoutToPlanMyPeakLibraryItem({
    workoutId: record.workoutId,
    title: record.workout.title,
    workoutTypeValueId: record.workout.workoutTypeValueId,
    distancePlanned: record.workout.distancePlanned,
    totalTimePlanned: record.workout.totalTimePlanned,
    caloriesPlanned: record.workout.caloriesPlanned,
    tssPlanned: record.workout.tssPlanned,
    ifPlanned: record.workout.ifPlanned,
    velocityPlanned: record.workout.velocityPlanned,
    energyPlanned: record.workout.energyPlanned,
    elevationGainPlanned: record.workout.elevationGainPlanned,
    description: record.workout.description,
    coachComments: record.workout.coachComments,
    structure: record.workout.structure,
  });
}

/**
 * The item a transform-time adapter message is about, by the TrainingPeaks id
 * it embeds (`structure:{id}`, `targets:{id}`, `workouts[{id}]`). Validation
 * messages index into the output array instead (`workouts[{i}].name`) and are
 * deliberately not matched here.
 */
function itemIdFromField(field: string): number | null {
  const match = /^(?:structure:|targets:|workouts\[)(\d+)\]?$/.exec(field);
  return match ? Number(match[1]) : null;
}

async function recordSkip(key: string, reason: string): Promise<void> {
  try {
    await chrome.runtime.sendMessage<
      UpdateCapturedWorkoutMessage,
      ApiResponse<CapturedWorkoutRecord | null>
    >({ type: 'UPDATE_CAPTURED_WORKOUT', key, lastSendError: reason });
  } catch (error) {
    logger.warn('Could not record captured-workout skip:', error);
  }
}

function emptySummary(): CapturedSendSummary {
  return { sent: 0, failed: 0, skipped: 0, outcomes: {}, errors: [] };
}

function mergeSummary(
  into: CapturedSendSummary,
  from: CapturedSendSummary
): CapturedSendSummary {
  return {
    sent: into.sent + from.sent,
    failed: into.failed + from.failed,
    skipped: into.skipped + from.skipped,
    outcomes: { ...into.outcomes, ...from.outcomes },
    errors: [...into.errors, ...from.errors],
  };
}

/**
 * Send one environment's records through the adapter.
 */
async function sendEnvironment(
  environment: TrainingPeaksEnvironment,
  records: CapturedWorkoutRecord[]
): Promise<CapturedSendSummary> {
  const summary = emptySummary();
  const namespace = providerIdNamespaceFor(environment);

  const keyByWorkoutId = new Map<number, string>();
  const capturedKeys: Record<string, string> = {};
  for (const record of records) {
    keyByWorkoutId.set(record.workoutId, record.key);
    capturedKeys[`${namespace}:${record.workoutId}`] = record.key;
  }

  const config: PlanMyPeakExportConfig = {
    createFolder: false,
    providerIdNamespace: namespace,
    capturedKeys,
  };

  const items = records.map(toLibraryItem);
  const workouts = await planMyPeakAdapter.transform(items, config);
  const validation = await planMyPeakAdapter.validate(workouts);

  // Adapter warnings by item: a skip means the workout never reaches the
  // upload loop, so it is recorded here; anything else rides along as a
  // warning on the row.
  const skippedKeys = new Set<string>();
  const transformedIds = new Set(
    workouts.map((workout) => workout.provider_workout_id)
  );
  const warningsByKey = new Map<string, string[]>();

  const noteWarning = (message: ValidationMessage): void => {
    const id = itemIdFromField(message.field);
    const key = id === null ? undefined : keyByWorkoutId.get(id);
    if (!key) return;
    const list = warningsByKey.get(key) ?? [];
    list.push(message.message);
    warningsByKey.set(key, list);
  };
  validation.warnings.forEach(noteWarning);

  for (const record of records) {
    if (!transformedIds.has(`${namespace}:${record.workoutId}`)) {
      skippedKeys.add(record.key);
      const reason =
        warningsByKey.get(record.key)?.[0] ??
        `"${record.workout.title}" could not be converted for PlanMyPeak`;
      await recordSkip(record.key, reason);
      summary.skipped += 1;
      summary.outcomes[record.key] = {
        key: record.key,
        status: 'skipped',
        error: reason,
      };
    }
  }

  if (!validation.isValid) {
    const reason = validation.errors.map((entry) => entry.message).join('; ');
    for (const record of records) {
      if (skippedKeys.has(record.key)) continue;
      await recordSkip(record.key, reason);
      summary.skipped += 1;
      summary.outcomes[record.key] = {
        key: record.key,
        status: 'skipped',
        error: reason,
      };
    }
    return summary;
  }

  if (workouts.length === 0) {
    return summary;
  }

  const result = await planMyPeakAdapter.export(workouts, config);

  const itemResults = new Map<string, ExportItemResult>();
  for (const entry of result.itemResults ?? []) {
    itemResults.set(entry.providerWorkoutId, entry);
  }

  const runError = result.errors?.length
    ? result.errors.join('; ')
    : 'PlanMyPeak upload failed';

  for (const record of records) {
    if (skippedKeys.has(record.key)) continue;
    const providerWorkoutId = `${namespace}:${record.workoutId}`;
    const item = itemResults.get(providerWorkoutId);
    const warning = warningsByKey.get(record.key)?.join(' ');

    if (item?.success) {
      summary.sent += 1;
      summary.outcomes[record.key] = {
        key: record.key,
        status: 'sent',
        remoteId: item.remoteId,
        libraryName: item.libraryName,
        warning,
      };
      continue;
    }

    summary.failed += 1;
    summary.outcomes[record.key] = {
      key: record.key,
      status: 'failed',
      error: item?.error ?? runError,
      warning,
    };
  }

  if (!result.success && itemResults.size === 0) {
    // Nothing was attempted (library lookup failed, say): the background
    // touched no record, so the only place this error lives is here.
    summary.errors.push(runError);
  }

  return summary;
}

export function useSendCapturedWorkouts(
  records: CapturedWorkoutRecord[]
): UseSendCapturedWorkoutsReturn {
  const [sendingKeys, setSendingKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [lastSummary, setLastSummary] = useState<CapturedSendSummary | null>(
    null
  );
  const [outcomes, setOutcomes] = useState<Record<string, CapturedSendOutcome>>(
    {}
  );

  const recordsByKey = useMemo(() => {
    const map = new Map<string, CapturedWorkoutRecord>();
    for (const record of records) {
      map.set(record.key, record);
    }
    return map;
  }, [records]);

  const send = useCallback(
    async (keys: string[]): Promise<CapturedSendSummary> => {
      const selected = keys
        .map((key) => recordsByKey.get(key))
        .filter((record): record is CapturedWorkoutRecord => !!record);

      if (selected.length === 0) {
        const empty = emptySummary();
        setLastSummary(empty);
        return empty;
      }

      setSendingKeys(new Set(selected.map((record) => record.key)));

      try {
        const byEnvironment = new Map<
          TrainingPeaksEnvironment,
          CapturedWorkoutRecord[]
        >();
        for (const record of selected) {
          const list = byEnvironment.get(record.environment) ?? [];
          list.push(record);
          byEnvironment.set(record.environment, list);
        }

        let summary = emptySummary();
        for (const [environment, group] of byEnvironment) {
          try {
            summary = mergeSummary(
              summary,
              await sendEnvironment(environment, group)
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Send failed';
            logger.error('Captured workout send failed:', error);
            const failed = emptySummary();
            failed.errors.push(message);
            for (const record of group) {
              failed.failed += 1;
              failed.outcomes[record.key] = {
                key: record.key,
                status: 'failed',
                error: message,
              };
            }
            summary = mergeSummary(summary, failed);
          }
        }

        setOutcomes((previous) => ({ ...previous, ...summary.outcomes }));
        setLastSummary(summary);
        return summary;
      } finally {
        setSendingKeys(new Set());
      }
    },
    [recordsByKey]
  );

  const sendAllPending = useCallback(
    () =>
      send(
        records
          .filter((record) => record.status === 'pending')
          .map((record) => record.key)
      ),
    [records, send]
  );

  return {
    send,
    sendAllPending,
    sendingKeys,
    isSending: sendingKeys.size > 0,
    lastSummary,
    outcomes,
  };
}

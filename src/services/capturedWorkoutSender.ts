/**
 * Send captured workouts to the coach's default PlanMyPeak library — UI-free.
 *
 * Runs the shared PlanMyPeak path — `adapter.transform` → `validate` →
 * `export` — once per TrainingPeaks environment, with `createFolder: false` so
 * the target resolves to the `isDefault` library and a namespaced provider id
 * (`cal:{workoutId}`, `cal-sandbox:{workoutId}`) minted by the transformer.
 *
 * Two surfaces call this with different dependencies and nothing else
 * changes: the popup's `useSendCapturedWorkouts` hook hands it the runtime-
 * message adapter and records skips through a runtime message; the background
 * worker, importing on behalf of a PlanMyPeak page, hands it an adapter on the
 * direct transport and records skips through the service. The rules — what
 * is a skip, what is a failure, how outcomes are keyed — live here once.
 *
 * This module does **not** write upload outcomes. The background upload loop
 * marks each record `sent` or stores its `lastSendError` as it goes, through
 * `capturedKeys` on the export, so a popup closed mid-send loses nothing. The
 * one thing recorded from here is a transform-time skip: a workout the adapter
 * could not turn into a PlanMyPeak workout never reaches the upload loop, so
 * its reason is stored through `recordSkip`.
 */

import type {
  ExportItemResult,
  ValidationMessage,
} from '@/export/adapters/base';
import type { LibraryItem } from '@/types';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type { TrainingPeaksEnvironment } from '@/utils/constants';
import type { PlanMyPeakAdapter } from '@/export/adapters/planMyPeak/PlanMyPeakAdapter';
import { normalizeTpPlanWorkoutToPlanMyPeakLibraryItem } from '@/export/adapters/planMyPeak/trainingPlanNormalizer';
import { logger } from '@/utils/logger';

/** Provider-id namespace for a capture's environment. */
export function providerIdNamespaceFor(
  environment: TrainingPeaksEnvironment
): string {
  return environment === 'sandbox' ? 'cal-sandbox' : 'cal';
}

/** The provider identity the transformer will mint for a record. */
export function capturedProviderWorkoutId(
  record: Pick<CapturedWorkoutRecord, 'environment' | 'workoutId'>
): string {
  return `${providerIdNamespaceFor(record.environment)}:${record.workoutId}`;
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

export interface CapturedSendDeps {
  adapter: Pick<PlanMyPeakAdapter, 'transform' | 'validate' | 'export'>;
  /** Persist a transform-time skip on the record so the popup can show it. */
  recordSkip: (key: string, reason: string) => Promise<void>;
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

export function emptySendSummary(): CapturedSendSummary {
  return { sent: 0, failed: 0, skipped: 0, outcomes: {}, errors: [] };
}

export function mergeSendSummary(
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
  records: CapturedWorkoutRecord[],
  deps: CapturedSendDeps
): Promise<CapturedSendSummary> {
  const summary = emptySendSummary();
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
  const workouts = await deps.adapter.transform(items, config);
  const validation = await deps.adapter.validate(workouts);

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
      await deps.recordSkip(record.key, reason);
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
      await deps.recordSkip(record.key, reason);
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

  const result = await deps.adapter.export(workouts, config);

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

/**
 * Send records, grouped by TrainingPeaks environment so each group carries
 * its own provider-id namespace. A group that throws is reported as failed in
 * full rather than aborting the other groups.
 */
export async function sendCapturedRecords(
  records: CapturedWorkoutRecord[],
  deps: CapturedSendDeps
): Promise<CapturedSendSummary> {
  const byEnvironment = new Map<
    TrainingPeaksEnvironment,
    CapturedWorkoutRecord[]
  >();
  for (const record of records) {
    const list = byEnvironment.get(record.environment) ?? [];
    list.push(record);
    byEnvironment.set(record.environment, list);
  }

  let summary = emptySendSummary();
  for (const [environment, group] of byEnvironment) {
    try {
      summary = mergeSendSummary(
        summary,
        await sendEnvironment(environment, group, deps)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed';
      logger.error('Captured workout send failed:', error);
      const failed = emptySendSummary();
      failed.errors.push(message);
      for (const record of group) {
        failed.failed += 1;
        failed.outcomes[record.key] = {
          key: record.key,
          status: 'failed',
          error: message,
        };
      }
      summary = mergeSendSummary(summary, failed);
    }
  }

  return summary;
}

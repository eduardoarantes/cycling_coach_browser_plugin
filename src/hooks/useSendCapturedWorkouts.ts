/**
 * Send captured workouts to the coach's default PlanMyPeak library, from the
 * popup.
 *
 * The rules live in `capturedWorkoutSender.ts`, shared with the background's
 * page-driven import; this hook supplies the popup's dependencies — the
 * runtime-message adapter, and a skip recorder that goes through
 * `UPDATE_CAPTURED_WORKOUT` — and keeps the React state around a send.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ApiResponse } from '@/types/api.types';
import type {
  CapturedWorkoutRecord,
  UpdateCapturedWorkoutMessage,
} from '@/types';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import {
  emptySendSummary,
  sendCapturedRecords,
  type CapturedSendOutcome,
  type CapturedSendSummary,
} from '@/services/capturedWorkoutSender';
import { logger } from '@/utils/logger';

export {
  providerIdNamespaceFor,
  toLibraryItem,
} from '@/services/capturedWorkoutSender';
export type {
  CapturedSendOutcome,
  CapturedSendSummary,
} from '@/services/capturedWorkoutSender';

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
        const empty = emptySendSummary();
        setLastSummary(empty);
        return empty;
      }

      setSendingKeys(new Set(selected.map((record) => record.key)));

      try {
        const summary = await sendCapturedRecords(selected, {
          adapter: planMyPeakAdapter,
          recordSkip,
        });

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

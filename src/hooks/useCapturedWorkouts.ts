/**
 * Captured workouts in the popup.
 *
 * Storage is the source of truth: the list is loaded once through the
 * background and then kept current from `chrome.storage.onChanged`, the same
 * pattern as `useExportProgress`. No React Query, because the data is local
 * and event-driven.
 *
 * Every mutation goes through a runtime message. The popup never writes the
 * `captured_workouts` key itself: the background serializes all writes, and
 * that only holds while it is the sole writer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CapturedWorkoutRecord,
  CapturedWorkoutsListResult,
  ClaimCapturedWorkoutsMessage,
  ClaimCapturedWorkoutsResult,
  GetCapturedWorkoutsMessage,
  RemoveCapturedWorkoutsMessage,
  RemoveCapturedWorkoutsResult,
  UpdateCapturedWorkoutMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import {
  countPendingCapturedWorkouts,
  countUnlinkedCapturedWorkouts,
  parseCapturedWorkoutsStorage,
  sortCapturedWorkoutsNewestFirst,
} from '@/schemas/capturedWorkout.schema';
import { STORAGE_KEYS } from '@/utils/constants';
import { logger } from '@/utils/logger';

export interface UseCapturedWorkoutsReturn {
  /** Newest first */
  records: CapturedWorkoutRecord[];
  pendingCount: number;
  /** Pending records no PlanMyPeak account owns yet; see `claim`. */
  unlinkedCount: number;
  isLoading: boolean;
  error: string | null;
  /**
   * Link every unowned record to the PlanMyPeak account the extension is
   * signed in to. The background resolves that account; nothing is named here.
   * Resolves to an error message, or null when it worked.
   */
  claim: () => Promise<string | null>;
  /** Mark one record dismissed. */
  dismiss: (key: string) => Promise<void>;
  /** Remove every sent and dismissed record. */
  clearFinished: () => Promise<void>;
  /** Reload from the background. */
  refresh: () => Promise<void>;
}

export function useCapturedWorkouts(): UseCapturedWorkoutsReturn {
  const [records, setRecords] = useState<CapturedWorkoutRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage<
        GetCapturedWorkoutsMessage,
        ApiResponse<CapturedWorkoutsListResult>
      >({ type: 'GET_CAPTURED_WORKOUTS' });

      if (response.success) {
        setRecords(response.data.records);
        setError(null);
      } else {
        setError(response.error.message);
      }
    } catch (refreshError) {
      logger.error('Failed to load captured workouts:', refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load captured workouts'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismiss = useCallback(
    async (key: string) => {
      await chrome.runtime.sendMessage<
        UpdateCapturedWorkoutMessage,
        ApiResponse<CapturedWorkoutRecord | null>
      >({ type: 'UPDATE_CAPTURED_WORKOUT', key, status: 'dismissed' });
      await refresh();
    },
    [refresh]
  );

  const claim = useCallback(async (): Promise<string | null> => {
    try {
      const response = await chrome.runtime.sendMessage<
        ClaimCapturedWorkoutsMessage,
        ApiResponse<ClaimCapturedWorkoutsResult>
      >({ type: 'CLAIM_CAPTURED_WORKOUTS' });
      await refresh();
      return response.success ? null : response.error.message;
    } catch (claimError) {
      logger.error('Failed to link captured workouts:', claimError);
      return claimError instanceof Error
        ? claimError.message
        : 'Failed to link captured workouts';
    }
  }, [refresh]);

  const clearFinished = useCallback(async () => {
    await chrome.runtime.sendMessage<
      RemoveCapturedWorkoutsMessage,
      ApiResponse<RemoveCapturedWorkoutsResult>
    >({ type: 'REMOVE_CAPTURED_WORKOUTS', statuses: ['sent', 'dismissed'] });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const change = changes[STORAGE_KEYS.CAPTURED_WORKOUTS];
      if (!change) return;

      const map = parseCapturedWorkoutsStorage(change.newValue);
      setRecords(sortCapturedWorkoutsNewestFirst(Object.values(map)));
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const pendingCount = useMemo(
    () => countPendingCapturedWorkouts(records),
    [records]
  );

  const unlinkedCount = useMemo(
    () => countUnlinkedCapturedWorkouts(records),
    [records]
  );

  return {
    records,
    pendingCount,
    unlinkedCount,
    isLoading,
    error,
    claim,
    dismiss,
    clearFinished,
    refresh,
  };
}

/**
 * Hook for consuming export progress state in the popup
 *
 * Provides real-time export progress updates and status recovery
 * when the popup is reopened during or after an export.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getExportProgress,
  clearExportProgress,
  type ExportProgressState,
} from '@/services/exportProgressService';

export interface UseExportProgressReturn {
  /** Current export progress state */
  progress: ExportProgressState | null;
  /** Whether there's an active export */
  isExporting: boolean;
  /** Whether the last export completed successfully */
  isComplete: boolean;
  /** Whether the last export failed */
  isFailed: boolean;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Dismiss/clear the current export state */
  dismiss: () => Promise<void>;
  /** Refresh the export progress from storage */
  refresh: () => Promise<void>;
}

export function useExportProgress(): UseExportProgressReturn {
  const [progress, setProgress] = useState<ExportProgressState | null>(null);

  const refresh = useCallback(async () => {
    const state = await getExportProgress();
    setProgress(state);
  }, []);

  const dismiss = useCallback(async () => {
    await clearExportProgress();
    setProgress(null);
  }, []);

  // Load initial state
  useEffect(() => {
    let isMounted = true;

    void getExportProgress().then((state) => {
      if (isMounted) {
        setProgress(state);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to storage changes for real-time updates
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ): void => {
      if (areaName !== 'local') return;

      const exportProgressChange = changes['export_progress'];
      if (exportProgressChange) {
        setProgress(
          (exportProgressChange.newValue as ExportProgressState | undefined) ??
            null
        );
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const isExporting = progress?.status === 'in_progress';
  const isComplete = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  const percentage =
    progress && progress.totalItems > 0
      ? Math.round((progress.completedItems / progress.totalItems) * 100)
      : 0;

  return {
    progress,
    isExporting,
    isComplete,
    isFailed,
    percentage,
    dismiss,
    refresh,
  };
}

/**
 * useExport Hook
 *
 * Manages export state and provides export functionality for multiple destinations
 */
import { useState, useCallback } from 'react';
import type { LibraryItem } from '@/types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type { IntervalsIcuExportConfig } from '@/types/intervalsicu.types';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';
import type { ExportDestination } from '@/types/export.types';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import { intervalsIcuAdapter } from '@/export/adapters/intervalsicu';
import { logger } from '@/utils/logger';

export type ExportConfig = PlanMyPeakExportConfig | IntervalsIcuExportConfig;

interface UseExportReturn {
  /** Whether export dialog is open */
  isDialogOpen: boolean;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export result (if completed) */
  exportResult: ExportResultType | null;
  /** Open the export dialog */
  openDialog: () => void;
  /** Close the export dialog */
  closeDialog: () => void;
  /** Execute the export */
  executeExport: (
    config: ExportConfig,
    destination: ExportDestination
  ) => Promise<void>;
  /** Close the result modal */
  closeResult: () => void;
  /** Reset export state */
  reset: () => void;
}

/**
 * Hook for managing workout export to multiple destinations
 *
 * @param items - Library items to export
 * @returns Export state and methods
 */
export function useExport(items: LibraryItem[]): UseExportReturn {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResultType | null>(
    null
  );

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const closeResult = useCallback(() => {
    setExportResult(null);
  }, []);

  const reset = useCallback(() => {
    setIsDialogOpen(false);
    setIsExporting(false);
    setExportResult(null);
  }, []);

  const executeExport = useCallback(
    async (
      config: ExportConfig,
      destination: ExportDestination
    ): Promise<void> => {
      setIsExporting(true);

      try {
        logger.info(
          `[useExport] Starting export of ${items.length} workouts to ${destination}`,
          config
        );

        let result: ExportResultType;

        // Execute export based on destination
        if (destination === 'planmypeak') {
          const pmpConfig = config as PlanMyPeakExportConfig;

          // Step 1: Transform
          const pmpWorkouts = await planMyPeakAdapter.transform(
            items,
            pmpConfig
          );
          logger.debug(
            `[useExport] Transformed ${pmpWorkouts.length} workouts`
          );

          // Step 2: Validate
          const validation = await planMyPeakAdapter.validate(pmpWorkouts);
          logger.debug('[useExport] Validation result:', validation);

          if (!validation.isValid) {
            logger.error('[useExport] Validation failed:', validation.errors);
            setExportResult({
              success: false,
              fileName: pmpConfig.fileName || 'export.json',
              format: 'json',
              itemsExported: 0,
              warnings: validation.warnings,
              errors: validation.errors.map((e) => e.message),
            });
            setIsDialogOpen(false);
            setIsExporting(false);
            return;
          }

          // Step 3: Export
          result = await planMyPeakAdapter.export(pmpWorkouts, pmpConfig);
        } else {
          // Intervals.icu export
          const intervalsConfig = config as IntervalsIcuExportConfig;

          // Step 1: Transform (includes upload to Intervals.icu)
          const intervalsWorkouts = await intervalsIcuAdapter.transform(
            items,
            intervalsConfig
          );
          logger.debug(
            `[useExport] Uploaded ${intervalsWorkouts.length} workouts`
          );

          // Step 2: Validate
          const validation =
            await intervalsIcuAdapter.validate(intervalsWorkouts);
          logger.debug('[useExport] Validation result:', validation);

          if (!validation.isValid) {
            logger.error('[useExport] Validation failed:', validation.errors);
            setExportResult({
              success: false,
              fileName: 'intervals_icu_export',
              format: 'api',
              itemsExported: 0,
              warnings: validation.warnings,
              errors: validation.errors.map((e) => e.message),
            });
            setIsDialogOpen(false);
            setIsExporting(false);
            return;
          }

          // Step 3: Export (returns result summary)
          result = await intervalsIcuAdapter.export(
            intervalsWorkouts,
            intervalsConfig
          );
        }

        logger.info('[useExport] Export complete:', result);
        setExportResult(result);
        setIsDialogOpen(false);
      } catch (error) {
        logger.error('[useExport] Export failed:', error);
        setExportResult({
          success: false,
          fileName: config.fileName || 'export',
          format: destination === 'planmypeak' ? 'json' : 'api',
          itemsExported: 0,
          warnings: [],
          errors: [
            error instanceof Error ? error.message : 'Unknown error occurred',
          ],
        });
        setIsDialogOpen(false);
      } finally {
        setIsExporting(false);
      }
    },
    [items]
  );

  return {
    isDialogOpen,
    isExporting,
    exportResult,
    openDialog,
    closeDialog,
    executeExport,
    closeResult,
    reset,
  };
}

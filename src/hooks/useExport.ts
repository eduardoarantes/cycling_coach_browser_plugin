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
import type { TrainingPlanExportProgressDialogState } from '@/popup/components/export/ExportDialog';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import { intervalsIcuAdapter } from '@/export/adapters/intervalsicu';
import { logger } from '@/utils/logger';
import { logErrorWithAuthDowngrade } from '@/utils/apiErrorLogging';

export type ExportConfig = PlanMyPeakExportConfig | IntervalsIcuExportConfig;

interface UseExportReturn {
  /** Whether export dialog is open */
  isDialogOpen: boolean;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export result (if completed) */
  exportResult: ExportResultType | null;
  /** Current export progress (0-100) */
  progress: number;
  /** Current export status message */
  statusMessage: string;
  /** Detailed progress state shown in shared ExportDialog */
  detailedProgress: TrainingPlanExportProgressDialogState | null;
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

function createSingleLibraryDetailedProgress(
  destination: ExportDestination,
  workoutCount: number
): TrainingPlanExportProgressDialogState {
  const transformLabel =
    destination === 'intervalsicu' ? 'Upload Workouts' : 'Transform Workouts';
  const finalizeLabel =
    destination === 'intervalsicu' ? 'Finalize Export' : 'Generate File';

  return {
    overallCurrent: 0,
    overallTotal: 3,
    currentPhaseLabel: 'Preparing export',
    currentPhaseCurrent: 0,
    currentPhaseTotal: 3,
    message: `${workoutCount} workout${workoutCount === 1 ? '' : 's'}`,
    phases: [
      {
        id: 'transform',
        label: transformLabel,
        status: 'pending',
        current: 0,
        total: 1,
      },
      {
        id: 'validate',
        label: 'Validate Export',
        status: 'pending',
        current: 0,
        total: 1,
      },
      {
        id: 'finalize',
        label: finalizeLabel,
        status: 'pending',
        current: 0,
        total: 1,
      },
    ],
  };
}

function updateDetailedPhase(
  previous: TrainingPlanExportProgressDialogState | null,
  options: {
    phaseId: string;
    phaseLabel?: string;
    phaseStatus: 'pending' | 'started' | 'progress' | 'completed' | 'failed';
    phaseCurrent?: number;
    phaseTotal?: number;
    overallCurrent?: number;
    overallTotal?: number;
    currentPhaseLabel?: string;
    currentPhaseCurrent?: number;
    currentPhaseTotal?: number;
    message?: string;
    itemName?: string;
  }
): TrainingPlanExportProgressDialogState | null {
  if (!previous) {
    return previous;
  }

  return {
    ...previous,
    overallCurrent: options.overallCurrent ?? previous.overallCurrent,
    overallTotal: options.overallTotal ?? previous.overallTotal,
    currentPhaseLabel: options.currentPhaseLabel ?? previous.currentPhaseLabel,
    currentPhaseCurrent:
      options.currentPhaseCurrent ?? previous.currentPhaseCurrent,
    currentPhaseTotal: options.currentPhaseTotal ?? previous.currentPhaseTotal,
    message: options.message ?? previous.message,
    currentItemName: options.itemName ?? previous.currentItemName,
    phases: previous.phases.map((phase) =>
      phase.id !== options.phaseId
        ? phase
        : {
            ...phase,
            label: options.phaseLabel ?? phase.label,
            status: options.phaseStatus,
            current: options.phaseCurrent ?? phase.current,
            total: options.phaseTotal ?? phase.total,
            itemName: options.itemName ?? phase.itemName,
            message: options.message ?? phase.message,
          }
    ),
  };
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
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [detailedProgress, setDetailedProgress] =
    useState<TrainingPlanExportProgressDialogState | null>(null);

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
    setProgress(0);
    setStatusMessage('');
    setDetailedProgress(null);
  }, []);

  const executeExport = useCallback(
    async (
      config: ExportConfig,
      destination: ExportDestination
    ): Promise<void> => {
      setIsExporting(true);
      setProgress(0);
      setStatusMessage('Preparing export...');
      setDetailedProgress(
        createSingleLibraryDetailedProgress(destination, items.length)
      );

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
          setStatusMessage('Transforming workouts...');
          setProgress(20);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'transform',
              phaseStatus: 'progress',
              phaseCurrent: 0,
              phaseTotal: 1,
              overallCurrent: 0,
              currentPhaseLabel: 'Transforming workouts',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
              message: `${items.length} workout${items.length === 1 ? '' : 's'}`,
            })
          );
          const pmpWorkouts = await planMyPeakAdapter.transform(
            items,
            pmpConfig
          );
          logger.debug(
            `[useExport] Transformed ${pmpWorkouts.length} workouts`
          );

          // Step 2: Validate
          setStatusMessage('Validating export...');
          setProgress(55);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'transform',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              overallCurrent: 1,
              currentPhaseLabel: 'Validating export',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
            })
          );
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'validate',
              phaseStatus: 'progress',
              phaseCurrent: 0,
            })
          );
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
            setProgress(100);
            setStatusMessage('Export failed');
            setDetailedProgress((prev) =>
              updateDetailedPhase(prev, {
                phaseId: 'validate',
                phaseStatus: 'failed',
                overallCurrent: 1,
                currentPhaseLabel: 'Validation failed',
                currentPhaseCurrent: 1,
                currentPhaseTotal: 1,
                message: 'Validation failed',
              })
            );
            setIsDialogOpen(false);
            setIsExporting(false);
            return;
          }

          // Step 3: Export
          setStatusMessage('Generating file...');
          setProgress(80);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'validate',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              overallCurrent: 2,
              currentPhaseLabel: 'Generating file',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
            })
          );
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'finalize',
              phaseStatus: 'progress',
              phaseCurrent: 0,
            })
          );
          result = await planMyPeakAdapter.export(pmpWorkouts, pmpConfig);
        } else {
          // Intervals.icu export
          const intervalsConfig = config as IntervalsIcuExportConfig;

          // Step 1: Transform (includes upload to Intervals.icu)
          setStatusMessage('Uploading workouts to Intervals.icu...');
          setProgress(20);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'transform',
              phaseLabel: 'Upload Workouts',
              phaseStatus: 'progress',
              phaseCurrent: 0,
              phaseTotal: 1,
              overallCurrent: 0,
              currentPhaseLabel: 'Uploading workouts to Intervals.icu',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
              message: `${items.length} workout${items.length === 1 ? '' : 's'}`,
            })
          );
          const intervalsWorkouts = await intervalsIcuAdapter.transform(
            items,
            intervalsConfig
          );
          logger.debug(
            `[useExport] Uploaded ${intervalsWorkouts.length} workouts`
          );

          // Step 2: Validate
          setStatusMessage('Validating uploaded workouts...');
          setProgress(80);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'transform',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              overallCurrent: 1,
              currentPhaseLabel: 'Validating uploaded workouts',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
            })
          );
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'validate',
              phaseStatus: 'progress',
              phaseCurrent: 0,
            })
          );
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
            setProgress(100);
            setStatusMessage('Export failed');
            setDetailedProgress((prev) =>
              updateDetailedPhase(prev, {
                phaseId: 'validate',
                phaseStatus: 'failed',
                overallCurrent: 1,
                currentPhaseLabel: 'Validation failed',
                currentPhaseCurrent: 1,
                currentPhaseTotal: 1,
                message: 'Validation failed',
              })
            );
            setIsDialogOpen(false);
            setIsExporting(false);
            return;
          }

          // Step 3: Export (returns result summary)
          setStatusMessage('Finalizing export...');
          setProgress(92);
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'validate',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              overallCurrent: 2,
              currentPhaseLabel: 'Finalizing export',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
            })
          );
          setDetailedProgress((prev) =>
            updateDetailedPhase(prev, {
              phaseId: 'finalize',
              phaseLabel: 'Finalize Export',
              phaseStatus: 'progress',
              phaseCurrent: 0,
            })
          );
          result = await intervalsIcuAdapter.export(
            intervalsWorkouts,
            intervalsConfig
          );
        }

        logger.info('[useExport] Export complete:', result);
        setProgress(100);
        setStatusMessage('Export complete!');
        setDetailedProgress((prev) =>
          updateDetailedPhase(prev, {
            phaseId: 'finalize',
            phaseStatus: 'completed',
            phaseCurrent: 1,
            overallCurrent: 3,
            currentPhaseLabel: 'Completed',
            currentPhaseCurrent: 3,
            currentPhaseTotal: 3,
            message: 'Export complete',
          })
        );
        setExportResult(result);
        setIsDialogOpen(false);
      } catch (error) {
        logErrorWithAuthDowngrade('[useExport] Export failed:', error);
        setProgress(100);
        setStatusMessage('Export failed');
        setDetailedProgress((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentPhaseLabel: 'Export failed',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
          };
        });
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
    progress,
    statusMessage,
    detailedProgress,
    openDialog,
    closeDialog,
    executeExport,
    closeResult,
    reset,
  };
}

/**
 * useMultiLibraryExport Hook
 *
 * Manages multi-library export state and functionality
 */
import { useState, useCallback } from 'react';
import type { LibraryItem } from '@/types';
import type { GetLibraryItemsMessage } from '@/types';
import type { Library, ApiResponse } from '@/types/api.types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type { IntervalsIcuExportConfig } from '@/types/intervalsicu.types';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';
import type { ExportDestination } from '@/types/export.types';
import type { TrainingPlanExportProgressDialogState } from '@/popup/components/export/ExportDialog';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import { intervalsIcuAdapter } from '@/export/adapters/intervalsicu';
import { logger } from '@/utils/logger';
import {
  logApiResponseError,
  logErrorWithAuthDowngrade,
} from '@/utils/apiErrorLogging';

export type ExportStrategy = 'separate' | 'combined';

export interface MultiLibraryExportConfig extends PlanMyPeakExportConfig {
  /** Export strategy: separate files or combined */
  strategy: ExportStrategy;
}

export type MultiLibraryDestinationConfig =
  | MultiLibraryExportConfig
  | IntervalsIcuExportConfig;

interface UseMultiLibraryExportReturn {
  /** Whether export dialog is open */
  isDialogOpen: boolean;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export results (multiple for separate files) */
  exportResults: ExportResultType[];
  /** Current progress (0-100) */
  progress: number;
  /** Current status message */
  statusMessage: string;
  /** Detailed progress state for shared export dialog */
  detailedProgress: TrainingPlanExportProgressDialogState | null;
  /** Open the export dialog */
  openDialog: () => void;
  /** Close the export dialog */
  closeDialog: () => void;
  /** Execute the export */
  executeExport: (
    libraryIds: number[],
    libraries: Library[],
    config: MultiLibraryDestinationConfig,
    destination: ExportDestination
  ) => Promise<void>;
  /** Close the result modal */
  closeResults: () => void;
  /** Reset export state */
  reset: () => void;
}

function createMultiLibraryDetailedProgress(
  totalLibraries: number,
  destination: ExportDestination
): TrainingPlanExportProgressDialogState {
  const isDirectUploadDestination =
    destination === 'intervalsicu' || destination === 'planmypeak';
  return {
    overallCurrent: 0,
    overallTotal: Math.max(1, totalLibraries * 4),
    currentPhaseLabel: 'Preparing export',
    currentPhaseCurrent: 0,
    currentPhaseTotal: totalLibraries,
    message: `${totalLibraries} librar${totalLibraries === 1 ? 'y' : 'ies'}`,
    phases: [
      {
        id: 'libraries',
        label: 'Libraries',
        status: 'pending',
        current: 0,
        total: totalLibraries,
      },
      {
        id: 'fetch',
        label: 'Fetch Workouts',
        status: 'pending',
        current: 0,
        total: 1,
      },
      {
        id: 'transform',
        label: isDirectUploadDestination ? 'Upload / Transform' : 'Transform',
        status: 'pending',
        current: 0,
        total: 1,
      },
      {
        id: 'validate',
        label: 'Validate',
        status: 'pending',
        current: 0,
        total: 1,
      },
      {
        id: 'export',
        label: isDirectUploadDestination ? 'Finalize Upload' : 'Generate File',
        status: 'pending',
        current: 0,
        total: 1,
      },
    ],
  };
}

function updateDetailedProgress(
  previous: TrainingPlanExportProgressDialogState | null,
  options: {
    overallCurrent?: number;
    overallTotal?: number;
    currentPhaseLabel?: string;
    currentPhaseCurrent?: number;
    currentPhaseTotal?: number;
    message?: string;
    itemName?: string;
    phaseId?: string;
    phaseStatus?: 'pending' | 'started' | 'progress' | 'completed' | 'failed';
    phaseCurrent?: number;
    phaseTotal?: number;
    phaseLabel?: string;
  }
): TrainingPlanExportProgressDialogState | null {
  if (!previous) return previous;

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
            status: options.phaseStatus ?? phase.status,
            current: options.phaseCurrent ?? phase.current,
            total: options.phaseTotal ?? phase.total,
            itemName: options.itemName ?? phase.itemName,
            message: options.message ?? phase.message,
          }
    ),
  };
}

/**
 * Fetch library items for a given library ID
 */
async function fetchLibraryItems(libraryId: number): Promise<LibraryItem[]> {
  logger.debug(
    `[useMultiLibraryExport] Fetching items for library ${libraryId}`
  );

  const response = await chrome.runtime.sendMessage<
    GetLibraryItemsMessage,
    ApiResponse<LibraryItem[]>
  >({
    type: 'GET_LIBRARY_ITEMS',
    libraryId,
  });

  if (response.success) {
    logger.debug(
      `[useMultiLibraryExport] Fetched ${response.data.length} items for library ${libraryId}`
    );
    return response.data;
  } else {
    logApiResponseError(
      `[useMultiLibraryExport] Failed to fetch items for library ${libraryId}:`,
      response.error
    );
    throw new Error(
      response.error.message || `Failed to fetch library ${libraryId}`
    );
  }
}

/**
 * Hook for managing multi-library export to PlanMyPeak
 */
export function useMultiLibraryExport(): UseMultiLibraryExportReturn {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResults, setExportResults] = useState<ExportResultType[]>([]);
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

  const closeResults = useCallback(() => {
    setExportResults([]);
  }, []);

  const reset = useCallback(() => {
    setIsDialogOpen(false);
    setIsExporting(false);
    setExportResults([]);
    setProgress(0);
    setStatusMessage('');
    setDetailedProgress(null);
  }, []);

  const executeExport = useCallback(
    async (
      libraryIds: number[],
      libraries: Library[],
      config: MultiLibraryDestinationConfig,
      destination: ExportDestination
    ): Promise<void> => {
      setIsExporting(true);
      setProgress(0);
      setStatusMessage('Preparing export...');
      setDetailedProgress(
        createMultiLibraryDetailedProgress(libraryIds.length, destination)
      );

      try {
        logger.info(
          `[useMultiLibraryExport] Starting export of ${libraryIds.length} libraries`,
          { destination, config }
        );

        // Create a map for quick library lookup
        const libraryMap = new Map(
          libraries.map((lib) => [lib.exerciseLibraryId, lib])
        );

        if (destination === 'intervalsicu') {
          const intervalsConfig = config as IntervalsIcuExportConfig;
          const results: ExportResultType[] = [];
          const totalLibraries = libraryIds.length;

          for (let i = 0; i < libraryIds.length; i++) {
            const libraryId = libraryIds[i];
            const library = libraryMap.get(libraryId);

            if (!library) {
              logger.warn(`Library ${libraryId} not found in library map`);
              continue;
            }

            setStatusMessage(
              `Uploading ${library.libraryName} to Intervals.icu (${i + 1}/${totalLibraries})...`
            );
            setDetailedProgress((prev) =>
              updateDetailedProgress(prev, {
                currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Fetch Workouts`,
                currentPhaseCurrent: i + 1,
                currentPhaseTotal: totalLibraries,
                itemName: library.libraryName,
                message: 'Fetching workouts from TrainingPeaks library...',
                phaseId: 'libraries',
                phaseStatus: 'progress',
                phaseCurrent: i,
                phaseTotal: totalLibraries,
              })
            );

            try {
              const items = await fetchLibraryItems(libraryId);
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 1,
                  phaseId: 'libraries',
                  phaseCurrent: i + 1,
                  phaseStatus: 'progress',
                  phaseTotal: totalLibraries,
                })
              );
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  phaseId: 'fetch',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Upload / Transform`,
                  itemName: library.libraryName,
                  message: `Uploading ${items.length} workout${items.length === 1 ? '' : 's'} to Intervals.icu...`,
                })
              );
              const exported = await intervalsIcuAdapter.transform(items, {
                ...intervalsConfig,
                libraryName: library.libraryName,
              });
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 2,
                  phaseId: 'transform',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Validate`,
                  itemName: library.libraryName,
                  message: 'Validating uploaded workouts...',
                })
              );
              const validation = await intervalsIcuAdapter.validate(exported);
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 3,
                  phaseId: 'validate',
                  phaseStatus: validation.isValid ? 'completed' : 'failed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Finalize`,
                  itemName: library.libraryName,
                  message: validation.isValid
                    ? 'Finalizing export...'
                    : 'Validation failed',
                })
              );

              if (!validation.isValid) {
                results.push({
                  success: false,
                  fileName: library.libraryName,
                  format: 'api',
                  itemsExported: 0,
                  warnings: validation.warnings,
                  errors: validation.errors.map((e) => e.message),
                });
              } else {
                const result = await intervalsIcuAdapter.export(
                  exported,
                  intervalsConfig
                );
                results.push({
                  ...result,
                  fileName: library.libraryName,
                });
              }

              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 4,
                  phaseId: 'export',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Completed`,
                  itemName: library.libraryName,
                  message: 'Library export completed',
                })
              );

              setProgress(Math.round(((i + 1) / totalLibraries) * 100));
            } catch (error) {
              logErrorWithAuthDowngrade(
                `[useMultiLibraryExport] Failed to export library ${libraryId} to Intervals.icu:`,
                error
              );
              results.push({
                success: false,
                fileName: library.libraryName,
                format: 'api',
                itemsExported: 0,
                warnings: [],
                errors: [
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
                ],
              });
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  phaseId: 'export',
                  phaseStatus: 'failed',
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Failed`,
                  itemName: library.libraryName,
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error occurred',
                })
              );
            }
          }

          logger.info(
            '[useMultiLibraryExport] Intervals multi-library export complete'
          );
          setExportResults(results);
        } else if (
          (config as MultiLibraryExportConfig).strategy === 'separate'
        ) {
          const planMyPeakConfig = config as MultiLibraryExportConfig;
          // Export each library as a separate file
          const results: ExportResultType[] = [];
          const totalLibraries = libraryIds.length;

          for (let i = 0; i < libraryIds.length; i++) {
            const libraryId = libraryIds[i];
            const library = libraryMap.get(libraryId);

            if (!library) {
              logger.warn(`Library ${libraryId} not found in library map`);
              continue;
            }

            setStatusMessage(
              `Exporting ${library.libraryName} (${i + 1}/${totalLibraries})...`
            );
            setDetailedProgress((prev) =>
              updateDetailedProgress(prev, {
                currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Fetch Workouts`,
                currentPhaseCurrent: i + 1,
                currentPhaseTotal: totalLibraries,
                itemName: library.libraryName,
                message: 'Fetching workouts...',
                phaseId: 'libraries',
                phaseStatus: 'progress',
                phaseCurrent: i,
                phaseTotal: totalLibraries,
              })
            );

            try {
              // Fetch items
              const items = await fetchLibraryItems(libraryId);
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 1,
                  phaseId: 'libraries',
                  phaseCurrent: i + 1,
                  phaseStatus: 'progress',
                  phaseTotal: totalLibraries,
                })
              );
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  phaseId: 'fetch',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Transform`,
                  itemName: library.libraryName,
                  message: 'Transforming workouts...',
                })
              );

              // Transform
              const pmpWorkouts = await planMyPeakAdapter.transform(
                items,
                planMyPeakConfig
              );
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 2,
                  phaseId: 'transform',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Validate`,
                  itemName: library.libraryName,
                  message: 'Validating export...',
                })
              );

              // Validate
              const validation = await planMyPeakAdapter.validate(pmpWorkouts);
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 3,
                  phaseId: 'validate',
                  phaseStatus: validation.isValid ? 'completed' : 'failed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Export`,
                  itemName: library.libraryName,
                  message: validation.isValid
                    ? 'Uploading workouts...'
                    : 'Validation failed',
                })
              );

              if (!validation.isValid) {
                results.push({
                  success: false,
                  fileName: library.libraryName,
                  format: 'api',
                  itemsExported: 0,
                  warnings: validation.warnings,
                  errors: validation.errors.map((e) => e.message),
                });
                continue;
              }

              // Export with library-specific filename
              const libraryConfig = {
                ...config,
                ...planMyPeakConfig,
                targetLibraryName: library.libraryName,
                fileName:
                  planMyPeakConfig.fileName ||
                  library.libraryName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
              };

              const result = await planMyPeakAdapter.export(
                pmpWorkouts,
                libraryConfig
              );
              results.push(result);
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i * 4 + 4,
                  phaseId: 'export',
                  phaseStatus: 'completed',
                  phaseCurrent: 1,
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Completed`,
                  itemName: library.libraryName,
                  message: 'Library export completed',
                })
              );

              // Update progress
              setProgress(Math.round(((i + 1) / totalLibraries) * 100));
            } catch (error) {
              logErrorWithAuthDowngrade(
                `[useMultiLibraryExport] Failed to export library ${libraryId}:`,
                error
              );
              results.push({
                success: false,
                fileName: library.libraryName,
                format: 'api',
                itemsExported: 0,
                warnings: [],
                errors: [
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
                ],
              });
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  phaseId: 'export',
                  phaseStatus: 'failed',
                  currentPhaseLabel: `Library ${i + 1}/${totalLibraries} · Failed`,
                  itemName: library.libraryName,
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error occurred',
                })
              );
            }
          }

          logger.info('[useMultiLibraryExport] Separate export complete');
          setExportResults(results);
        } else {
          const planMyPeakConfig = config as MultiLibraryExportConfig;
          // Combined export: Merge all workouts into one file
          setStatusMessage('Fetching workouts from all libraries...');
          setDetailedProgress((prev) =>
            updateDetailedProgress(prev, {
              overallTotal: libraryIds.length + 3,
              currentPhaseLabel: 'Fetching workouts from all libraries',
              currentPhaseCurrent: 0,
              currentPhaseTotal: libraryIds.length,
              message: 'Preparing combined export...',
              phaseId: 'libraries',
              phaseStatus: 'progress',
              phaseCurrent: 0,
              phaseTotal: libraryIds.length,
            })
          );
          const allItems: LibraryItem[] = [];

          for (let i = 0; i < libraryIds.length; i++) {
            const libraryId = libraryIds[i];
            const library = libraryMap.get(libraryId);

            if (!library) continue;

            try {
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  currentPhaseLabel: `Fetching library ${i + 1}/${libraryIds.length}`,
                  currentPhaseCurrent: i + 1,
                  currentPhaseTotal: libraryIds.length,
                  itemName: library?.libraryName,
                  message: 'Fetching workouts...',
                })
              );
              const items = await fetchLibraryItems(libraryId);
              allItems.push(...items);
              setProgress(Math.round(((i + 1) / libraryIds.length) * 50));
              setDetailedProgress((prev) =>
                updateDetailedProgress(prev, {
                  overallCurrent: i + 1,
                  phaseId: 'libraries',
                  phaseStatus: 'progress',
                  phaseCurrent: i + 1,
                  phaseTotal: libraryIds.length,
                })
              );
            } catch (error) {
              logErrorWithAuthDowngrade(
                `[useMultiLibraryExport] Failed to fetch library ${libraryId}:`,
                error
              );
            }
          }

          setStatusMessage('Exporting combined file...');
          setDetailedProgress((prev) =>
            updateDetailedProgress(prev, {
              currentPhaseLabel: 'Transforming combined export',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
              itemName: undefined,
              message: `${allItems.length} total workout${allItems.length === 1 ? '' : 's'}`,
              phaseId: 'transform',
              phaseStatus: 'progress',
              phaseCurrent: 0,
              phaseTotal: 1,
            })
          );
          logger.info(
            `[useMultiLibraryExport] Exporting ${allItems.length} total workouts`
          );

          // Transform
          const pmpWorkouts = await planMyPeakAdapter.transform(
            allItems,
            planMyPeakConfig
          );
          setProgress(70);
          setDetailedProgress((prev) =>
            updateDetailedProgress(prev, {
              overallCurrent: libraryIds.length + 1,
              phaseId: 'transform',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              currentPhaseLabel: 'Validating combined export',
              currentPhaseCurrent: 0,
              currentPhaseTotal: 1,
              message: 'Validating export...',
            })
          );

          // Validate
          const validation = await planMyPeakAdapter.validate(pmpWorkouts);
          setProgress(85);
          setDetailedProgress((prev) =>
            updateDetailedProgress(prev, {
              overallCurrent: libraryIds.length + 2,
              phaseId: 'validate',
              phaseStatus: validation.isValid ? 'completed' : 'failed',
              phaseCurrent: 1,
              currentPhaseLabel: validation.isValid
                ? 'Uploading combined export'
                : 'Validation failed',
              currentPhaseCurrent: validation.isValid ? 0 : 1,
              currentPhaseTotal: 1,
              message: validation.isValid
                ? 'Uploading workouts...'
                : 'Validation failed',
            })
          );

          if (!validation.isValid) {
            logger.error(
              '[useMultiLibraryExport] Validation failed:',
              validation.errors
            );
            setExportResults([
              {
                success: false,
                fileName:
                  planMyPeakConfig.targetLibraryName || 'PlanMyPeak Library',
                format: 'api',
                itemsExported: 0,
                warnings: validation.warnings,
                errors: validation.errors.map((e) => e.message),
              },
            ]);
            setIsDialogOpen(false);
            setIsExporting(false);
            setProgress(100);
            setDetailedProgress((prev) =>
              updateDetailedProgress(prev, {
                phaseId: 'validate',
                phaseStatus: 'failed',
                currentPhaseLabel: 'Validation failed',
                currentPhaseCurrent: 1,
                currentPhaseTotal: 1,
                message: 'Validation failed',
              })
            );
            return;
          }

          // Export
          const result = await planMyPeakAdapter.export(pmpWorkouts, {
            ...planMyPeakConfig,
            fileName: planMyPeakConfig.fileName || 'combined_export',
          });
          setProgress(100);
          setDetailedProgress((prev) =>
            updateDetailedProgress(prev, {
              overallCurrent: libraryIds.length + 3,
              phaseId: 'export',
              phaseStatus: 'completed',
              phaseCurrent: 1,
              currentPhaseLabel: 'Completed',
              currentPhaseCurrent: libraryIds.length + 3,
              currentPhaseTotal: libraryIds.length + 3,
              message: 'Combined upload completed',
            })
          );

          logger.info(
            '[useMultiLibraryExport] Combined export complete:',
            result
          );
          setExportResults([result]);
        }

        setIsDialogOpen(false);
        setStatusMessage('Export complete!');
      } catch (error) {
        logErrorWithAuthDowngrade(
          '[useMultiLibraryExport] Export failed:',
          error
        );
        setDetailedProgress((prev) =>
          prev
            ? {
                ...prev,
                currentPhaseLabel: 'Export failed',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
              }
            : prev
        );
        setExportResults([
          {
            success: false,
            fileName: config.fileName || 'export',
            format: 'api',
            itemsExported: 0,
            warnings: [],
            errors: [
              error instanceof Error ? error.message : 'Unknown error occurred',
            ],
          },
        ]);
        setIsDialogOpen(false);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    isDialogOpen,
    isExporting,
    exportResults,
    progress,
    statusMessage,
    detailedProgress,
    openDialog,
    closeDialog,
    executeExport,
    closeResults,
    reset,
  };
}

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
import type { ExportResult as ExportResultType } from '@/export/adapters/base';
import { planMyPeakAdapter } from '@/export/adapters/planMyPeak';
import { logger } from '@/utils/logger';

export type ExportStrategy = 'separate' | 'combined';

export interface MultiLibraryExportConfig extends PlanMyPeakExportConfig {
  /** Export strategy: separate files or combined */
  strategy: ExportStrategy;
}

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
  /** Open the export dialog */
  openDialog: () => void;
  /** Close the export dialog */
  closeDialog: () => void;
  /** Execute the export */
  executeExport: (
    libraryIds: number[],
    libraries: Library[],
    config: MultiLibraryExportConfig
  ) => Promise<void>;
  /** Close the result modal */
  closeResults: () => void;
  /** Reset export state */
  reset: () => void;
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
    logger.error(
      `[useMultiLibraryExport] Failed to fetch items for library ${libraryId}:`,
      response.error.message
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
  }, []);

  const executeExport = useCallback(
    async (
      libraryIds: number[],
      libraries: Library[],
      config: MultiLibraryExportConfig
    ): Promise<void> => {
      setIsExporting(true);
      setProgress(0);
      setStatusMessage('Preparing export...');

      try {
        logger.info(
          `[useMultiLibraryExport] Starting export of ${libraryIds.length} libraries`,
          config
        );

        // Create a map for quick library lookup
        const libraryMap = new Map(
          libraries.map((lib) => [lib.exerciseLibraryId, lib])
        );

        if (config.strategy === 'separate') {
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

            try {
              // Fetch items
              const items = await fetchLibraryItems(libraryId);

              // Transform
              const pmpWorkouts = await planMyPeakAdapter.transform(
                items,
                config
              );

              // Validate
              const validation = await planMyPeakAdapter.validate(pmpWorkouts);

              if (!validation.isValid) {
                results.push({
                  success: false,
                  fileName: `${library.libraryName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
                  format: 'json',
                  itemsExported: 0,
                  warnings: validation.warnings,
                  errors: validation.errors.map((e) => e.message),
                });
                continue;
              }

              // Export with library-specific filename
              const libraryConfig = {
                ...config,
                fileName:
                  config.fileName ||
                  library.libraryName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
              };

              const result = await planMyPeakAdapter.export(
                pmpWorkouts,
                libraryConfig
              );
              results.push(result);

              // Update progress
              setProgress(Math.round(((i + 1) / totalLibraries) * 100));
            } catch (error) {
              logger.error(
                `[useMultiLibraryExport] Failed to export library ${libraryId}:`,
                error
              );
              results.push({
                success: false,
                fileName: `${library.libraryName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
                format: 'json',
                itemsExported: 0,
                warnings: [],
                errors: [
                  error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
                ],
              });
            }
          }

          logger.info('[useMultiLibraryExport] Separate export complete');
          setExportResults(results);
        } else {
          // Combined export: Merge all workouts into one file
          setStatusMessage('Fetching workouts from all libraries...');
          const allItems: LibraryItem[] = [];

          for (let i = 0; i < libraryIds.length; i++) {
            const libraryId = libraryIds[i];
            const library = libraryMap.get(libraryId);

            if (!library) continue;

            try {
              const items = await fetchLibraryItems(libraryId);
              allItems.push(...items);
              setProgress(Math.round(((i + 1) / libraryIds.length) * 50));
            } catch (error) {
              logger.error(
                `[useMultiLibraryExport] Failed to fetch library ${libraryId}:`,
                error
              );
            }
          }

          setStatusMessage('Exporting combined file...');
          logger.info(
            `[useMultiLibraryExport] Exporting ${allItems.length} total workouts`
          );

          // Transform
          const pmpWorkouts = await planMyPeakAdapter.transform(
            allItems,
            config
          );
          setProgress(70);

          // Validate
          const validation = await planMyPeakAdapter.validate(pmpWorkouts);
          setProgress(85);

          if (!validation.isValid) {
            logger.error(
              '[useMultiLibraryExport] Validation failed:',
              validation.errors
            );
            setExportResults([
              {
                success: false,
                fileName: config.fileName || 'combined_export.json',
                format: 'json',
                itemsExported: 0,
                warnings: validation.warnings,
                errors: validation.errors.map((e) => e.message),
              },
            ]);
            setIsDialogOpen(false);
            setIsExporting(false);
            setProgress(100);
            return;
          }

          // Export
          const result = await planMyPeakAdapter.export(pmpWorkouts, {
            ...config,
            fileName: config.fileName || 'combined_export',
          });
          setProgress(100);

          logger.info(
            '[useMultiLibraryExport] Combined export complete:',
            result
          );
          setExportResults([result]);
        }

        setIsDialogOpen(false);
        setStatusMessage('Export complete!');
      } catch (error) {
        logger.error('[useMultiLibraryExport] Export failed:', error);
        setExportResults([
          {
            success: false,
            fileName: config.fileName || 'export.json',
            format: 'json',
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
    openDialog,
    closeDialog,
    executeExport,
    closeResults,
    reset,
  };
}

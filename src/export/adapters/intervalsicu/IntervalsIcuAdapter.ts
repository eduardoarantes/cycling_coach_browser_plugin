/**
 * Intervals.icu Export Adapter
 *
 * Adapter for exporting workouts to Intervals.icu library (NOT calendar).
 * Uses folder-based organization and workout templates without dates.
 * Implements the ExportAdapter interface following the established pattern.
 *
 * @see PlanMyPeakAdapter for reference implementation
 */
import type {
  ExportAdapter,
  ExportResult,
  ValidationMessage,
  ValidationResult,
} from '../base';
import type { LibraryItem } from '@/types';
import type {
  IntervalsIcuExportConfig,
  IntervalsWorkoutResponse,
  IntervalsFolderResponse,
} from '@/types/intervalsicu.types';
import type {
  CreateIntervalsFolderMessage,
  DeleteIntervalsFolderMessage,
  ExportWorkoutsToLibraryMessage,
  FindIntervalsLibraryFolderByNameMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';
import { hasIntervalsApiKey } from '@/services/intervalsApiKeyService';

/**
 * Intervals.icu adapter for exporting TrainingPeaks workouts to library
 *
 * This adapter exports workouts as library templates (NOT calendar events).
 * Workouts can optionally be organized in folders for better organization.
 * NO dates are involved - this is pure library/template export.
 */
export class IntervalsIcuAdapter implements ExportAdapter<
  IntervalsIcuExportConfig,
  IntervalsWorkoutResponse[]
> {
  readonly id = 'intervalsicu';
  readonly name = 'Intervals.icu';
  readonly description = 'Export workouts to Intervals.icu library via API';
  readonly supportedFormats = ['api']; // Direct upload, not file download
  readonly icon = '🚴‍♂️';

  /**
   * Transform TrainingPeaks library items to Intervals.icu workout templates
   *
   * This method:
   * 1. Validates API key exists
   * 2. Creates folder if requested (optional)
   * 3. Exports workouts to library (with or without folder)
   *
   * NO dates involved - workouts are exported as library templates.
   *
   * @param items - TrainingPeaks library items to transform
   * @param config - Export configuration with library name and folder options
   * @returns Array of created Intervals.icu workout templates
   * @throws Error if config is invalid or API call fails
   */
  async transform(
    items: LibraryItem[],
    config: IntervalsIcuExportConfig
  ): Promise<IntervalsWorkoutResponse[]> {
    logger.info(
      `[IntervalsIcuAdapter] Transforming ${items.length} workouts for library export`
    );

    // 1. Validate API key exists
    const hasKey = await hasIntervalsApiKey();
    if (!hasKey) {
      throw new Error('Intervals.icu API key not configured');
    }

    // 2. Create folder if requested
    let folderId: number | undefined;
    if (config.createFolder) {
      const targetLibraryName = config.libraryName || 'TrainingPeaks Library';

      if (config.existingLibraryAction) {
        const existingFolderResult = await chrome.runtime.sendMessage<
          FindIntervalsLibraryFolderByNameMessage,
          ApiResponse<IntervalsFolderResponse | null>
        >({
          type: 'FIND_INTERVALS_LIBRARY_FOLDER_BY_NAME',
          folderName: targetLibraryName,
        });

        if (!existingFolderResult.success) {
          throw new Error(
            `Failed to validate existing folder: ${existingFolderResult.error.message}`
          );
        }

        const existingFolder = existingFolderResult.data;
        if (existingFolder) {
          if (config.existingLibraryAction === 'append') {
            folderId = existingFolder.id;
            logger.info(
              '[IntervalsIcuAdapter] Reusing existing folder:',
              folderId,
              targetLibraryName
            );
          } else if (config.existingLibraryAction === 'replace') {
            const deleteResult = await chrome.runtime.sendMessage<
              DeleteIntervalsFolderMessage,
              ApiResponse<null>
            >({
              type: 'DELETE_INTERVALS_FOLDER',
              folderId: existingFolder.id,
            });

            if (!deleteResult.success) {
              throw new Error(
                `Failed to delete existing folder: ${deleteResult.error.message}`
              );
            }

            logger.info(
              '[IntervalsIcuAdapter] Deleted existing folder before replace:',
              existingFolder.id,
              targetLibraryName
            );
          }
        }
      }

      if (!folderId) {
        const folderResult = await chrome.runtime.sendMessage<
          CreateIntervalsFolderMessage,
          ApiResponse<IntervalsFolderResponse>
        >({
          type: 'CREATE_INTERVALS_FOLDER',
          libraryName: targetLibraryName,
          description: config.description,
        });

        if (!folderResult.success) {
          throw new Error(
            `Failed to create folder: ${folderResult.error.message}`
          );
        }

        folderId = folderResult.data.id;
        logger.info('[IntervalsIcuAdapter] Created folder:', folderId);
      }
    }

    // 3. Export workouts to library
    const exportResult = await chrome.runtime.sendMessage<
      ExportWorkoutsToLibraryMessage,
      ApiResponse<IntervalsWorkoutResponse[]>
    >({
      type: 'EXPORT_WORKOUTS_TO_LIBRARY',
      workouts: items,
      folderId,
    });

    if (!exportResult.success) {
      throw new Error(
        `Failed to export workouts: ${exportResult.error.message}`
      );
    }

    logger.info(
      '[IntervalsIcuAdapter] Exported workouts:',
      exportResult.data.length
    );
    return exportResult.data;
  }

  /**
   * Validate Intervals.icu workout templates
   *
   * Checks that workout templates were created successfully.
   * Warnings are generated for missing names or IDs.
   *
   * @param workouts - Exported workout responses from Intervals.icu
   * @returns Validation result with errors/warnings
   */
  async validate(
    workouts: IntervalsWorkoutResponse[]
  ): Promise<ValidationResult> {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];

    // Validate each workout template
    workouts.forEach((workout, index) => {
      // Check for missing or empty names
      if (!workout.name || workout.name.trim() === '') {
        warnings.push({
          field: `workouts[${index}].name`,
          message: 'Workout template has no name',
          severity: 'warning',
        });
      }

      // Check if workout was created (should have valid ID)
      if (!workout.id || workout.id === 0) {
        warnings.push({
          field: `workouts[${index}].id`,
          message: 'Workout template was not created',
          severity: 'warning',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export is already complete (direct upload), this returns result
   *
   * The transform method already uploaded the workouts to Intervals.icu.
   * This method validates the results and returns the export summary.
   *
   * @param workouts - Uploaded workout responses from Intervals.icu
   * @param config - Export configuration (not used, export already complete)
   * @returns Export result with success status and warnings
   */
  async export(
    workouts: IntervalsWorkoutResponse[],
    _config: IntervalsIcuExportConfig
  ): Promise<ExportResult> {
    logger.info(
      `[IntervalsIcuAdapter] Export complete: ${workouts.length} workout templates`
    );

    const validation = await this.validate(workouts);

    return {
      success: true,
      fileName: `intervals_icu_export_${Date.now()}`,
      format: 'api',
      itemsExported: workouts.length,
      warnings: validation.warnings,
    };
  }
}

/**
 * Singleton instance of Intervals.icu adapter
 */
export const intervalsIcuAdapter = new IntervalsIcuAdapter();

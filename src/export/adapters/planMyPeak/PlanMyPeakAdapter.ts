/**
 * PlanMyPeak Export Adapter
 *
 * Transforms TrainingPeaks workouts to PlanMyPeak format.
 * PlanMyPeak is a cycling training platform that uses a similar
 * structured workout format but with some differences in metadata.
 */

import type { LibraryItem } from '@/types';
import type {
  CreatePlanMyPeakLibraryMessage,
  DeletePlanMyPeakLibraryMessage,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetPlanMyPeakLibrariesMessage,
} from '@/types';
import type {
  ExportAdapter,
  ExportResult,
  ValidationMessage,
  ValidationResult,
} from '../base';
import type { ApiResponse } from '@/types/api.types';
import type {
  PlanMyPeakExportConfig,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import { PlanMyPeakWorkoutSchema } from '@/schemas/planMyPeak.schema';
import { logger } from '@/utils/logger';
import { transformToPlanMyPeak } from './transformer';
import { isSupportedTpWorkoutTypeForPlanMyPeak } from './workoutMapping';

/**
 * PlanMyPeak adapter for exporting TrainingPeaks workouts
 */
export class PlanMyPeakAdapter implements ExportAdapter<
  PlanMyPeakExportConfig,
  PlanMyPeakWorkout[]
> {
  readonly id = 'planmypeak';
  readonly name = 'PlanMyPeak';
  readonly description = 'Export workouts to PlanMyPeak library via API';
  readonly supportedFormats = ['api'];
  readonly icon = '🚴';
  private lastTransformWarnings: ValidationMessage[] = [];

  private async getLibraries(): Promise<PlanMyPeakLibrary[]> {
    const response = await chrome.runtime.sendMessage<
      GetPlanMyPeakLibrariesMessage,
      ApiResponse<PlanMyPeakLibrary[]>
    >({
      type: 'GET_PLANMYPEAK_LIBRARIES',
    });

    if (!response.success) {
      throw new Error(
        response.error.message || 'Failed to fetch PlanMyPeak libraries'
      );
    }

    return response.data;
  }

  private async createLibrary(name: string): Promise<PlanMyPeakLibrary> {
    const response = await chrome.runtime.sendMessage<
      CreatePlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakLibrary>
    >({
      type: 'CREATE_PLANMYPEAK_LIBRARY',
      name,
    });

    if (!response.success) {
      throw new Error(
        response.error.message || `Failed to create library "${name}"`
      );
    }

    return response.data;
  }

  private async deleteLibrary(libraryId: string): Promise<void> {
    const response = await chrome.runtime.sendMessage<
      DeletePlanMyPeakLibraryMessage,
      ApiResponse<null>
    >({
      type: 'DELETE_PLANMYPEAK_LIBRARY',
      libraryId,
    });

    if (!response.success) {
      throw new Error(
        response.error.message || `Failed to delete library ${libraryId}`
      );
    }
  }

  private async resolveTargetLibrary(
    config: PlanMyPeakExportConfig
  ): Promise<PlanMyPeakLibrary> {
    const targetLibraryId = config.targetLibraryId?.trim();
    const targetLibraryName =
      config.targetLibraryName?.trim() || 'TrainingPeaks Library';
    const shouldCreateLibrary = config.createFolder !== false;
    const existingLibraryAction = config.existingLibraryAction;

    const libraries = await this.getLibraries();

    if (targetLibraryId) {
      const byId = libraries.find((library) => library.id === targetLibraryId);
      if (!byId) {
        throw new Error('Selected PlanMyPeak library was not found');
      }
      return byId;
    }

    if (shouldCreateLibrary) {
      const existing = libraries.find(
        (library) =>
          !library.is_system &&
          library.name.trim().toLowerCase() === targetLibraryName.toLowerCase()
      );

      if (existing) {
        if (existingLibraryAction === 'replace') {
          logger.info(
            '[PlanMyPeakAdapter] Replacing existing library:',
            existing.id,
            existing.name
          );
          await this.deleteLibrary(existing.id);
          const recreated = await this.createLibrary(targetLibraryName);
          return recreated;
        }

        logger.info(
          '[PlanMyPeakAdapter] Reusing existing library:',
          existing.id,
          existing.name
        );
        return existing;
      }

      try {
        const created = await this.createLibrary(targetLibraryName);
        logger.info(
          '[PlanMyPeakAdapter] Created PlanMyPeak library:',
          created.id,
          created.name
        );
        return created;
      } catch (error) {
        // Handle duplicate-name races by re-fetching and retrying exact name match.
        logger.warn(
          '[PlanMyPeakAdapter] Library create failed, attempting refetch:',
          error
        );
        const retryLibraries = await this.getLibraries();
        const afterRetry = retryLibraries.find(
          (library) =>
            !library.is_system &&
            library.name.trim().toLowerCase() ===
              targetLibraryName.toLowerCase()
        );
        if (afterRetry) {
          return afterRetry;
        }
        throw error;
      }
    }

    const defaultLibrary =
      libraries.find((library) => !library.is_system && library.is_default) ||
      libraries.find((library) => !library.is_system);

    if (!defaultLibrary) {
      throw new Error(
        'No writable PlanMyPeak library found. Enable "Create library" or create one in PlanMyPeak first.'
      );
    }

    logger.info(
      '[PlanMyPeakAdapter] Using existing default/user library:',
      defaultLibrary.id,
      defaultLibrary.name
    );
    return defaultLibrary;
  }

  /**
   * Transform TrainingPeaks library items to PlanMyPeak format
   */
  async transform(
    items: LibraryItem[],
    config: PlanMyPeakExportConfig
  ): Promise<PlanMyPeakWorkout[]> {
    logger.info(
      `[PlanMyPeakAdapter] Transforming ${items.length} workouts to PlanMyPeak format`
    );

    this.lastTransformWarnings = [];
    const transformed: PlanMyPeakWorkout[] = [];

    items.forEach((item) => {
      if (!isSupportedTpWorkoutTypeForPlanMyPeak(item.workoutTypeId)) {
        this.lastTransformWarnings.push({
          field: `workoutTypeId:${item.exerciseLibraryItemId}`,
          message: `Skipped "${item.itemName}" (TP workoutTypeId ${item.workoutTypeId}) - PlanMyPeak export currently supports cycling, running, and swimming workouts`,
          severity: 'warning',
        });
        return;
      }

      try {
        transformed.push(transformToPlanMyPeak(item, config));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown transform error';
        logger.warn(
          '[PlanMyPeakAdapter] Skipping unsupported TP workout for PlanMyPeak:',
          item.itemName,
          message
        );
        this.lastTransformWarnings.push({
          field: `workouts[${item.exerciseLibraryItemId}]`,
          message: `Skipped "${item.itemName}" - ${message}`,
          severity: 'warning',
        });
      }
    });

    logger.info(
      `[PlanMyPeakAdapter] Successfully transformed ${transformed.length} workouts`
    );

    return transformed;
  }

  /**
   * Validate PlanMyPeak workouts meet format requirements
   */
  async validate(workouts: PlanMyPeakWorkout[]): Promise<ValidationResult> {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [...this.lastTransformWarnings];

    workouts.forEach((workout, index) => {
      try {
        // Validate with Zod schema
        PlanMyPeakWorkoutSchema.parse(workout);

        // Additional business logic validations
        if (!workout.name || workout.name.trim() === '') {
          errors.push({
            field: `workouts[${index}].name`,
            message: 'Workout name is required',
            severity: 'error',
          });
        }

        if (workout.structure.structure.length === 0) {
          errors.push({
            field: `workouts[${index}].structure`,
            message: 'Workout must have at least one structure block',
            severity: 'error',
          });
        }

        if (workout.base_duration_min <= 0) {
          warnings.push({
            field: `workouts[${index}].base_duration_min`,
            message: 'Duration should be greater than 0',
            severity: 'warning',
          });
        }

        if (workout.base_tss < 0) {
          warnings.push({
            field: `workouts[${index}].base_tss`,
            message: 'TSS should not be negative',
            severity: 'warning',
          });
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push({
            field: `workouts[${index}]`,
            message: `Validation failed: ${error.message}`,
            severity: 'error',
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export PlanMyPeak workouts via direct API upload
   */
  async export(
    workouts: PlanMyPeakWorkout[],
    config: PlanMyPeakExportConfig
  ): Promise<ExportResult> {
    logger.info(
      `[PlanMyPeakAdapter] Uploading ${workouts.length} workouts to PlanMyPeak API`
    );

    const warnings: ValidationMessage[] = [];

    try {
      const targetLibrary = await this.resolveTargetLibrary(config);
      const uploadResult = await chrome.runtime.sendMessage<
        ExportWorkoutsToPlanMyPeakLibraryMessage,
        ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
      >({
        type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
        workouts,
        libraryId: targetLibrary.id,
      });

      if (!uploadResult.success) {
        logger.error(
          '[PlanMyPeakAdapter] Upload failed:',
          uploadResult.error.message
        );
        return {
          success: false,
          fileName: targetLibrary.name,
          format: 'api',
          itemsExported: 0,
          warnings,
          errors: [uploadResult.error.message || 'PlanMyPeak upload failed'],
        };
      }

      logger.info(
        `[PlanMyPeakAdapter] Upload successful: ${uploadResult.data.length} workouts -> ${targetLibrary.name}`
      );

      // Preserve transform-time warnings (skipped unsupported workouts) in the result modal.
      warnings.push(...this.lastTransformWarnings);

      return {
        success: true,
        fileName: targetLibrary.name,
        format: 'api',
        itemsExported: uploadResult.data.length,
        warnings,
      };
    } catch (error) {
      logger.error('[PlanMyPeakAdapter] Export failed:', error);
      return {
        success: false,
        fileName: config.targetLibraryName || 'PlanMyPeak Library',
        format: 'api',
        itemsExported: 0,
        warnings,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}

/**
 * Singleton instance of PlanMyPeak adapter
 */
export const planMyPeakAdapter = new PlanMyPeakAdapter();

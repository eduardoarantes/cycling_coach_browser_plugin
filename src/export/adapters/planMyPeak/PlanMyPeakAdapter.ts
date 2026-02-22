/**
 * PlanMyPeak Export Adapter
 *
 * Transforms TrainingPeaks workouts to PlanMyPeak format.
 * PlanMyPeak is a cycling training platform that uses a similar
 * structured workout format but with some differences in metadata.
 */

import type { LibraryItem } from '@/types';
import type {
  ExportAdapter,
  ExportResult,
  ValidationMessage,
  ValidationResult,
} from '../base';
import type {
  PlanMyPeakExportConfig,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import { PlanMyPeakWorkoutSchema } from '@/schemas/planMyPeak.schema';
import { logger } from '@/utils/logger';
import { transformToPlanMyPeak } from './transformer';

/**
 * PlanMyPeak adapter for exporting TrainingPeaks workouts
 */
export class PlanMyPeakAdapter implements ExportAdapter<
  PlanMyPeakExportConfig,
  PlanMyPeakWorkout[]
> {
  readonly id = 'planmypeak';
  readonly name = 'PlanMyPeak';
  readonly description = 'Export workouts to PlanMyPeak JSON format';
  readonly supportedFormats = ['json'];
  readonly icon = '🚴';

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

    const transformed = items.map((item) =>
      transformToPlanMyPeak(item, config)
    );

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
    const warnings: ValidationMessage[] = [];

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
   * Export PlanMyPeak workouts as downloadable JSON file(s)
   */
  async export(
    workouts: PlanMyPeakWorkout[],
    config: PlanMyPeakExportConfig
  ): Promise<ExportResult> {
    logger.info(
      `[PlanMyPeakAdapter] Exporting ${workouts.length} workouts to JSON`
    );

    const warnings: ValidationMessage[] = [];

    try {
      // Single file for all workouts
      const fileName =
        config.fileName || `planmypeak_workouts_${Date.now()}.json`;
      const jsonContent = JSON.stringify(workouts, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const fileUrl = URL.createObjectURL(blob);

      logger.info(`[PlanMyPeakAdapter] Export successful: ${fileName}`);

      return {
        success: true,
        fileUrl,
        fileName: fileName.endsWith('.json') ? fileName : `${fileName}.json`,
        format: 'json',
        itemsExported: workouts.length,
        warnings,
      };
    } catch (error) {
      logger.error('[PlanMyPeakAdapter] Export failed:', error);
      return {
        success: false,
        fileName: config.fileName || 'export.json',
        format: 'json',
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

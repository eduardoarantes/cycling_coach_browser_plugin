/**
 * Intervals.icu Export Adapter
 *
 * Adapter for exporting workouts to Intervals.icu via direct API upload.
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
  IntervalsEventResponse,
} from '@/types/intervalsicu.types';
import { IntervalsBulkResponseSchema } from '@/schemas/intervalsicu.schema';
import { logger } from '@/utils/logger';
import { exportToIntervals } from '@/background/api/intervalsicu';

/**
 * Intervals.icu adapter for exporting TrainingPeaks workouts
 *
 * This adapter directly uploads workouts to Intervals.icu via API
 * rather than generating a downloadable file.
 */
export class IntervalsIcuAdapter implements ExportAdapter<
  IntervalsIcuExportConfig,
  IntervalsEventResponse[]
> {
  readonly id = 'intervalsicu';
  readonly name = 'Intervals.icu';
  readonly description = 'Export workouts to Intervals.icu calendar via API';
  readonly supportedFormats = ['api']; // Direct upload, not file download
  readonly icon = '🚴‍♂️';

  /**
   * Transform TrainingPeaks library items to Intervals.icu format
   *
   * Note: Transformation happens in API client. This method validates
   * config and calls the API client to perform the export.
   *
   * @param items - TrainingPeaks library items to transform
   * @param config - Export configuration with API key and start date
   * @returns Array of created Intervals.icu events
   * @throws Error if config is invalid or API call fails
   */
  async transform(
    items: LibraryItem[],
    config: IntervalsIcuExportConfig
  ): Promise<IntervalsEventResponse[]> {
    logger.info(
      `[IntervalsIcuAdapter] Preparing ${items.length} workouts for export`
    );

    // Validate we have API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('Intervals.icu API key is required');
    }

    // Validate start date
    if (!config.startDate) {
      throw new Error('Start date is required');
    }

    // Calculate dates for each workout (daily spacing)
    const startDate = new Date(config.startDate);
    const dates = items.map((_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    });

    // Call API client (transformation and upload happens there)
    const response = await exportToIntervals(items, dates);

    if (!response.success) {
      throw new Error(response.error.message);
    }

    logger.info(
      `[IntervalsIcuAdapter] Successfully exported ${response.data.length} workouts`
    );

    return response.data;
  }

  /**
   * Validate Intervals.icu export results
   *
   * Since export happens during transform, this validates the results
   * after upload. Mainly for logging and warning generation.
   *
   * @param workouts - Exported workout responses from Intervals.icu
   * @returns Validation result with errors/warnings
   */
  async validate(
    workouts: IntervalsEventResponse[]
  ): Promise<ValidationResult> {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];

    // Validate each workout response
    workouts.forEach((workout, index) => {
      try {
        // Validate with Zod schema
        IntervalsBulkResponseSchema.parse([workout]);

        // Business logic validations
        if (!workout.name || workout.name.trim() === '') {
          warnings.push({
            field: `workouts[${index}].name`,
            message: 'Workout uploaded without a name',
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
    workouts: IntervalsEventResponse[],
    config: IntervalsIcuExportConfig
  ): Promise<ExportResult> {
    logger.info(
      `[IntervalsIcuAdapter] Export complete: ${workouts.length} workouts uploaded`
    );

    const validation = await this.validate(workouts);

    return {
      success: true,
      fileName: `intervals_icu_export_${Date.now()}`, // No actual file
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

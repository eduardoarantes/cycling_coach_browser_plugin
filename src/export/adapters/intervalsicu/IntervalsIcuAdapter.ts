/**
 * Intervals.icu Export Adapter
 *
 * Adapter for exporting workouts to Intervals.icu format
 *
 * Status: Placeholder / Coming Soon
 */
import type {
  ExportAdapter,
  ExportConfig,
  ValidationResult,
  ExportResult,
} from '../base';
import type { LibraryItem } from '@/types';
import { logger } from '@/utils/logger';

export interface IntervalsIcuExportConfig extends ExportConfig {
  fileName?: string;
  includeMetadata?: boolean;
}

/**
 * Placeholder adapter for Intervals.icu export
 *
 * TODO: Implement transformation logic for Intervals.icu format
 */
export class IntervalsIcuAdapter implements ExportAdapter<
  IntervalsIcuExportConfig,
  unknown
> {
  readonly id = 'intervalsicu';
  readonly name = 'Intervals.icu Adapter';
  readonly description = 'Export workouts to Intervals.icu format';
  readonly supportedFormats = ['json'];

  async transform(
    _items: LibraryItem[],
    _config: IntervalsIcuExportConfig
  ): Promise<unknown> {
    logger.warn('[IntervalsIcuAdapter] Transform not yet implemented');
    throw new Error('Intervals.icu export is not yet available');
  }

  async validate(_output: unknown): Promise<ValidationResult> {
    logger.warn('[IntervalsIcuAdapter] Validate not yet implemented');
    return {
      isValid: false,
      errors: [
        {
          message: 'Intervals.icu export is not yet available',
          field: 'general',
          severity: 'error',
        },
      ],
      warnings: [],
    };
  }

  async export(
    _output: unknown,
    config: IntervalsIcuExportConfig
  ): Promise<ExportResult> {
    logger.warn('[IntervalsIcuAdapter] Export not yet implemented');
    return {
      success: false,
      fileName: config.fileName || 'export',
      format: 'json',
      itemsExported: 0,
      warnings: [],
      errors: ['Intervals.icu export is not yet available'],
    };
  }
}

export const intervalsIcuAdapter = new IntervalsIcuAdapter();

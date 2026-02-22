/**
 * Base Export Adapter Interface
 *
 * Defines the contract that all export adapters must implement.
 * Follows the adapter pattern to support multiple export destinations.
 */

import type { LibraryItem } from '@/types';

/**
 * Base configuration for all export adapters
 */
export interface ExportConfig {
  /** Output file name (without extension) */
  fileName?: string;
  /** Whether to include metadata in export */
  includeMetadata?: boolean;
}

/**
 * Validation error or warning
 */
export interface ValidationMessage {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  lostData?: string; // Description of what data will be lost
}

/**
 * Result of transformation validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

/**
 * Result of export operation
 */
export interface ExportResult {
  success: boolean;
  fileUrl?: string; // Blob URL for download
  fileName: string;
  format: string;
  itemsExported: number;
  warnings: ValidationMessage[];
  errors?: string[];
}

/**
 * Generic export adapter interface
 * @typeParam TConfig - Adapter-specific configuration extending ExportConfig
 * @typeParam TOutput - Target platform data structure
 */
export interface ExportAdapter<
  TConfig extends ExportConfig,
  TOutput = unknown,
> {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Description of what this adapter exports to */
  readonly description: string;

  /** Supported output formats (file extensions) */
  readonly supportedFormats: string[];

  /** Icon for UI display (optional) */
  readonly icon?: string;

  /**
   * Transform TrainingPeaks data to target format
   * @param items - Library items to transform
   * @param config - Adapter-specific configuration
   * @returns Transformed data in target format
   */
  transform(items: LibraryItem[], config: TConfig): Promise<TOutput>;

  /**
   * Validate transformed data meets target requirements
   * @param output - Transformed data
   * @returns Validation result with errors/warnings
   */
  validate(output: TOutput): Promise<ValidationResult>;

  /**
   * Execute the export (generate file, download, etc.)
   * @param output - Validated output data
   * @param config - Export configuration
   * @returns Export result with download URL
   */
  export(output: TOutput, config: TConfig): Promise<ExportResult>;
}

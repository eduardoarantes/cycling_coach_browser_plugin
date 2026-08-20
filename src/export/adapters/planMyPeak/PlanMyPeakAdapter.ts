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
  DeletePlanMyPeakWorkoutMessage,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetPlanMyPeakLibrariesMessage,
  GetPlanMyPeakWorkoutsMessage,
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
import {
  TRAINING_PEAKS_PROVIDER_CODE,
  type PlanMyPeakLibrary,
  type PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakUploadSummary } from '@/background/api/planMyPeak';
import { PlanMyPeakWorkoutSchema } from '@/schemas/planMyPeak.schema';
import { logger } from '@/utils/logger';
import { transformToPlanMyPeak } from './transformer';
import {
  DISCIPLINES_ALLOWING_EMPTY_STRUCTURE,
  canImportTpItemToPlanMyPeak,
  collectTpTargetUnits,
  hasImportableStructure,
} from './workoutMapping';

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

  /**
   * Pick the library to import into.
   *
   * Resolution is by name, which is a known weakness: a coach who renames the
   * library we created will get a fresh one created here, while the workouts
   * themselves upsert in place inside the renamed library. `export` detects that
   * and reports it rather than leaving an unexplained empty library behind.
   */
  private async resolveTargetLibrary(
    config: PlanMyPeakExportConfig
  ): Promise<{ library: PlanMyPeakLibrary; createdByUs: boolean }> {
    const targetLibraryId = config.targetLibraryId?.trim();
    const targetLibraryName =
      config.targetLibraryName?.trim() || 'TrainingPeaks Library';
    const shouldCreateLibrary = config.createFolder !== false;

    const libraries = await this.getLibraries();

    if (targetLibraryId) {
      const byId = libraries.find((library) => library.id === targetLibraryId);
      if (!byId) {
        throw new Error('Selected PlanMyPeak library was not found');
      }
      return { library: byId, createdByUs: false };
    }

    if (shouldCreateLibrary) {
      const existing = libraries.find(
        (library) =>
          library.name.trim().toLowerCase() === targetLibraryName.toLowerCase()
      );

      if (existing) {
        // Both Replace and Append reuse the library. Replace used to delete and
        // recreate it, which the server now refuses with a 409 while it holds
        // workouts — and rightly so, since deleting a container should not
        // destroy the sessions inside it. Replace instead reconciles the
        // contents after upload; see reconcileLibraryContents.
        logger.info(
          '[PlanMyPeakAdapter] Reusing existing library:',
          existing.id,
          existing.name
        );
        return { library: existing, createdByUs: false };
      }

      try {
        const created = await this.createLibrary(targetLibraryName);
        logger.info(
          '[PlanMyPeakAdapter] Created PlanMyPeak library:',
          created.id,
          created.name
        );
        return { library: created, createdByUs: true };
      } catch (error) {
        // Handle duplicate-name races by re-fetching and retrying exact name match.
        logger.warn(
          '[PlanMyPeakAdapter] Library create failed, attempting refetch:',
          error
        );
        const retryLibraries = await this.getLibraries();
        const afterRetry = retryLibraries.find(
          (library) =>
            library.name.trim().toLowerCase() ===
            targetLibraryName.toLowerCase()
        );
        if (afterRetry) {
          return { library: afterRetry, createdByUs: false };
        }
        throw error;
      }
    }

    // Every coach has exactly one default library, and listing libraries creates
    // it if they somehow have none, so this is always available.
    const defaultLibrary =
      libraries.find((library) => library.isDefault) ?? libraries[0];

    if (!defaultLibrary) {
      throw new Error(
        'No writable PlanMyPeak library found. Enable "Create library" or create one in PlanMyPeak first.'
      );
    }

    logger.info(
      '[PlanMyPeakAdapter] Using default library:',
      defaultLibrary.id,
      defaultLibrary.name
    );
    return { library: defaultLibrary, createdByUs: false };
  }

  /**
   * Remove TrainingPeaks-imported workouts the source no longer contains.
   *
   * This is what Replace means now that a non-empty library cannot be deleted.
   * Only workouts carrying our own provider identity are considered, so a
   * coach's hand-written workouts in the same library are never touched.
   *
   * A delete refused with 409 means a training plan still schedules that
   * workout. That is designed behaviour, so it is collected and reported rather
   * than aborting the reconcile.
   */
  private async reconcileLibraryContents(
    libraryId: string,
    keepProviderWorkoutIds: Set<string>
  ): Promise<ValidationMessage[]> {
    const warnings: ValidationMessage[] = [];

    const response = await chrome.runtime.sendMessage<
      GetPlanMyPeakWorkoutsMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
    >({
      type: 'GET_PLANMYPEAK_WORKOUTS',
      libraryId,
      provider: TRAINING_PEAKS_PROVIDER_CODE,
    });

    if (!response.success) {
      warnings.push({
        field: 'replace',
        message: `Could not check for workouts to remove: ${response.error.message}`,
        severity: 'warning',
      });
      return warnings;
    }

    const stale = response.data.filter(
      (workout) =>
        workout.providerWorkoutId !== null &&
        !keepProviderWorkoutIds.has(workout.providerWorkoutId)
    );

    for (const workout of stale) {
      const deleted = await chrome.runtime.sendMessage<
        DeletePlanMyPeakWorkoutMessage,
        ApiResponse<null>
      >({
        type: 'DELETE_PLANMYPEAK_WORKOUT',
        workoutId: workout.id,
      });

      if (!deleted.success) {
        warnings.push({
          field: `replace:${workout.id}`,
          message: `Kept "${workout.name}" - ${deleted.error.message}`,
          severity: 'warning',
        });
      }
    }

    return warnings;
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
      // Discipline does not gate the import — PlanMyPeak accepts thirteen of
      // them and is the authority on the rest. A structure is required only for
      // disciplines that must prescribe something: rest days, notes, races and
      // strength sessions are stored without one.
      if (!canImportTpItemToPlanMyPeak(item)) {
        this.lastTransformWarnings.push({
          field: `structure:${item.exerciseLibraryItemId}`,
          message: `Skipped "${item.itemName}" - a ${item.exerciseLibraryItemType || 'workout'} of this type must prescribe at least one segment, and it has none`,
          severity: 'warning',
        });
        return;
      }

      try {
        const workout = transformToPlanMyPeak(item, config);

        // A workout that had a structure and lost it was sent as prose because
        // we could not express its targets. Report the units we could not map:
        // that is the fact that says what to add, and without it a mapping gap
        // just looks like a workout that happened to arrive empty.
        if (
          workout.structure.structure.length === 0 &&
          hasImportableStructure(item)
        ) {
          const units = collectTpTargetUnits(item);
          this.lastTransformWarnings.push({
            field: `targets:${item.exerciseLibraryItemId}`,
            message: units.length
              ? `Sent "${item.itemName}" without its structure - could not map target unit(s): ${units.join(', ')}`
              : `Sent "${item.itemName}" without its structure - it prescribes no targets we can map`,
            severity: 'warning',
          });
        }

        transformed.push(workout);
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
   * Identify a workout in a message.
   *
   * Every validation message names the item it is about — a list of rules with
   * no subject leaves the user to guess which of fifty workouts tripped it. Uses
   * the name when there is one, and falls back to the TrainingPeaks id for the
   * one case where there is not: a blank name is itself an error.
   */
  private describeWorkout(workout: PlanMyPeakWorkout, index: number): string {
    const name = workout.name?.trim();
    if (name) {
      return `"${name}"`;
    }

    return workout.provider_workout_id
      ? `the workout with TrainingPeaks id ${workout.provider_workout_id}`
      : `workout ${index + 1}`;
  }

  /**
   * Validate PlanMyPeak workouts meet format requirements
   */
  async validate(workouts: PlanMyPeakWorkout[]): Promise<ValidationResult> {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [...this.lastTransformWarnings];

    workouts.forEach((workout, index) => {
      const subject = this.describeWorkout(workout, index);

      try {
        // Validate with Zod schema
        PlanMyPeakWorkoutSchema.parse(workout);

        // Additional business logic validations
        if (!workout.name || workout.name.trim() === '') {
          errors.push({
            field: `workouts[${index}].name`,
            message: `${subject} has no name, and PlanMyPeak requires one`,
            severity: 'error',
          });
        }

        // Rest days, notes, races and prose strength sessions are stored with
        // no structure, so an empty block list is correct for them. Requiring
        // one unconditionally would reject exactly the workouts we now build
        // that way.
        if (
          workout.structure.structure.length === 0 &&
          !DISCIPLINES_ALLOWING_EMPTY_STRUCTURE.has(workout.discipline)
        ) {
          errors.push({
            field: `workouts[${index}].structure`,
            message: `${subject} has no structure blocks — a ${workout.discipline} workout has to prescribe at least one`,
            severity: 'error',
          });
        }

        if (workout.base_duration_min <= 0) {
          warnings.push({
            field: `workouts[${index}].base_duration_min`,
            message: `${subject} has no usable duration`,
            severity: 'warning',
          });
        }

        if (workout.base_tss < 0) {
          warnings.push({
            field: `workouts[${index}].base_tss`,
            message: `${subject} has a negative TSS (${workout.base_tss})`,
            severity: 'warning',
          });
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.push({
            field: `workouts[${index}]`,
            message: `${subject} failed validation: ${error.message}`,
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
   * Upload workouts to PlanMyPeak.
   *
   * The write is an upsert keyed on TrainingPeaks identity, so a re-import
   * updates in place instead of duplicating. Two outcomes are worth surfacing
   * rather than hiding: workouts the coach has filed into another library are
   * updated where they live and not moved back, and if *every* workout turns out
   * to live elsewhere the destination we just created is left empty — which
   * reads as a broken import unless it is explained.
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
      const { library: targetLibrary, createdByUs } =
        await this.resolveTargetLibrary(config);

      const uploadResult = await chrome.runtime.sendMessage<
        ExportWorkoutsToPlanMyPeakLibraryMessage,
        ApiResponse<PlanMyPeakUploadSummary>
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

      const summary = uploadResult.data;

      logger.info(
        `[PlanMyPeakAdapter] Upload complete: ${summary.createdCount} created, ${summary.updatedCount} updated -> ${targetLibrary.name}`
      );

      if (summary.updatedCount > 0) {
        warnings.push({
          field: 'upsert',
          message: `${summary.updatedCount} workout(s) already existed in PlanMyPeak and were updated in place.`,
          severity: 'warning',
        });
      }

      const filedElsewhere = summary.results.filter(
        (entry) => entry.filedElsewhere
      );
      if (filedElsewhere.length > 0) {
        const libraryNames = [
          ...new Set(filedElsewhere.map((entry) => entry.workout.library.name)),
        ];
        warnings.push({
          field: 'filedElsewhere',
          message:
            `${filedElsewhere.length} workout(s) live in ${libraryNames.join(', ')} ` +
            `because you moved them there, and were updated there rather than moved back.`,
          severity: 'warning',
        });
      }

      // PlanMyPeak's library page opens filtered to Bike. Anything else we send
      // is stored correctly and still invisible on the coach's first look, which
      // from where they stand is indistinguishable from the import having
      // dropped it. Say so here rather than let a successful import look empty.
      const nonCycling = summary.results.filter(
        (entry) =>
          typeof entry.workout.workoutType === 'string' &&
          entry.workout.workoutType !== 'bike'
      );
      if (nonCycling.length > 0) {
        const disciplines = [
          ...new Set(nonCycling.map((entry) => entry.workout.workoutType)),
        ].sort();
        warnings.push({
          field: 'visibility',
          message:
            `${nonCycling.length} workout(s) are not cycling (${disciplines.join(', ')}). ` +
            `PlanMyPeak's library opens filtered to Bike, so these are stored but ` +
            `will not appear until you change the discipline filter.`,
          severity: 'warning',
        });
      }

      for (const failure of summary.failures) {
        warnings.push({
          field: 'upload',
          message: `Failed to upload "${failure.name}": ${failure.message}`,
          severity: 'warning',
        });
      }

      // Replace means reconciling the library's contents, since a library
      // holding workouts can no longer be deleted and recreated.
      if (config.existingLibraryAction === 'replace') {
        const keep = new Set(
          workouts.map((workout) => workout.provider_workout_id)
        );
        warnings.push(
          ...(await this.reconcileLibraryContents(targetLibrary.id, keep))
        );
      }

      // Nothing landed in the library we made, so it is an empty container we
      // created for nothing. Remove it rather than leaving it unexplained.
      if (summary.destinationEmpty && createdByUs) {
        warnings.push({
          field: 'destination',
          message:
            `"${targetLibrary.name}" was left empty: every workout already existed ` +
            `and was updated where it already lives. Removing the empty library.`,
          severity: 'warning',
        });
        try {
          await this.deleteLibrary(targetLibrary.id);
        } catch (error) {
          logger.warn(
            '[PlanMyPeakAdapter] Could not remove empty library:',
            error
          );
        }
      }

      // Preserve transform-time warnings (skipped unsupported workouts) in the result modal.
      warnings.push(...this.lastTransformWarnings);

      return {
        success: true,
        fileName: targetLibrary.name,
        format: 'api',
        itemsExported: summary.results.length,
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

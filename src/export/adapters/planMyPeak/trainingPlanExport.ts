import type {
  CreatePlanMyPeakLibraryMessage,
  GetTrainingPlanFoldersMessage,
  GetPlanMyPeakPlanLibrariesMessage,
  CreatePlanMyPeakPlanLibraryMessage,
  GetPlanMyPeakPlanMessage,
  UpsertPlanMyPeakPlanMessage,
  UpdatePlanMyPeakPlanMessage,
  UpsertPlanMyPeakPlanEntryMessage,
  DeletePlanMyPeakPlanEntryMessage,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetPlanMyPeakLibrariesMessage,
  GetPlanMyPeakWorkoutByProviderIdMessage,
  TrainingPlanExportProgressPayload,
} from '@/types';
import type { PlanMyPeakUploadSummary } from '@/background/api/planMyPeak';
import type { PlanFolder } from '@/schemas/trainingPlan.schema';
import type {
  PlanMyPeakPlanLibrary,
  PlanMyPeakPlanSummary,
  PlanMyPeakPlanDetail,
  PlanMyPeakPlanEntry,
} from '@/schemas/planMyPeakApi.schema';
import { TRAINING_PEAKS_PROVIDER_CODE } from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakUpsertResult } from '@/background/api/planMyPeak';
import type {
  ApiResponse,
  CalendarNote,
  PlanWorkout,
  TrainingPlan,
} from '@/types/api.types';
import type {
  ExportResult as ExportResultType,
  ValidationMessage,
} from '../base';
import type {
  PlanMyPeakExportConfig,
  PlanMyPeakWorkout,
} from '@/types/planMyPeak.types';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import { getDayOfWeek, getWeekNumber } from '@/utils/dateUtils';
import { planMyPeakAdapter } from './PlanMyPeakAdapter';
import { normalizeTpPlanWorkoutsToPlanMyPeakLibraryItems } from './trainingPlanNormalizer';

const TP_SHARED_PLAN_WORKOUT_LIBRARY_NAME = 'TrainingPeaks Plan Workouts';

/**
 * The TrainingPeaks folder a plan sits in, used as the PlanMyPeak plan library.
 *
 * Membership lives on the folder rather than the plan — `/planfolder/v1/folder/all`
 * returns each folder with the ids it holds — so the plan's folder is the one
 * listing its id. A plan in no folder returns null and lands in the coach's
 * default plan library.
 */
function resolveTrainingPeaksPlanFolderName(
  planId: number,
  folders: PlanFolder[]
): string | null {
  const folder = folders.find((entry) => entry.planIds.includes(planId));
  return folder?.folderName.trim() || null;
}

/** PlanMyPeak bounds a plan to 52 weeks and a day to 51 positions. */
const MAX_PLAN_WEEKS = 52;
const MAX_ENTRY_POSITION = 50;

interface ExportTrainingPlanClassicWorkoutsToPlanMyPeakOptions {
  trainingPlan: TrainingPlan;
  workouts: PlanWorkout[];
  notes?: CalendarNote[];
  config: PlanMyPeakExportConfig;
  onProgress?: (progress: TrainingPlanExportProgressPayload) => void;
}

function normalizeForStableHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableHash(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );

    return entries.reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      acc[key] = normalizeForStableHash(entryValue);
      return acc;
    }, {});
  }

  return value;
}

async function sha256Hex(value: unknown): Promise<string> {
  const normalized = JSON.stringify(normalizeForStableHash(value));
  const encoded = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildWorkoutSourceIdFromStructure(
  structure: unknown
): Promise<string | null> {
  if (!structure || typeof structure !== 'object') {
    return null;
  }

  const hash = await sha256Hex(structure);
  return `TP:${hash}`;
}

function parseTpDateToUtcMidnight(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveSharedPlanWorkoutLibrary(
  preferredName?: string
): Promise<ApiResponse<PlanMyPeakLibrary>> {
  const librariesResponse = await chrome.runtime.sendMessage<
    GetPlanMyPeakLibrariesMessage,
    ApiResponse<PlanMyPeakLibrary[]>
  >({
    type: 'GET_PLANMYPEAK_LIBRARIES',
  });

  if (!librariesResponse.success) {
    return librariesResponse;
  }

  // Libraries carry no provider identity of their own, so name is all we have
  // to recognise ours by. A coach who renames it gets a second one created here.
  // Provider identity on the library would fix that; raised with the backend as
  // a future item.
  const sharedName =
    preferredName?.trim() || `${TP_SHARED_PLAN_WORKOUT_LIBRARY_NAME} (Shared)`;

  const existing = librariesResponse.data.find(
    (library) => library.name.trim().toLowerCase() === sharedName.toLowerCase()
  );
  if (existing) {
    return { success: true, data: existing };
  }

  return chrome.runtime.sendMessage<
    CreatePlanMyPeakLibraryMessage,
    ApiResponse<PlanMyPeakLibrary>
  >({
    type: 'CREATE_PLANMYPEAK_LIBRARY',
    name: sharedName,
  });
}

/**
 * PlanMyPeak training-plan export path.
 *
 * Flow:
 * 1. Transform TP plan workouts into PlanMyPeak workout payloads
 * 2. Deduplicate workouts by source_id (TP + SHA-256(structure)) in a shared library
 * 3. Create training plan template referencing workout IDs (workoutKey)
 * 4. Create plan notes (week/day) when available
 */
export async function exportTrainingPlanClassicWorkoutsToPlanMyPeak({
  trainingPlan,
  workouts,
  notes = [],
  config,
  onProgress,
}: ExportTrainingPlanClassicWorkoutsToPlanMyPeakOptions): Promise<ExportResultType> {
  const planName =
    trainingPlan.title?.trim() || `Training Plan ${trainingPlan.planId}`;
  const warnings: ValidationMessage[] = [];
  const tpWorkoutSourceIdById = new Map<number, string>();

  for (const workout of workouts) {
    const sourceId = await buildWorkoutSourceIdFromStructure(workout.structure);
    if (!sourceId) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Workout "${workout.title}" has no structured data; skipping TP source_id generation`,
      });
      continue;
    }

    tpWorkoutSourceIdById.set(workout.workoutId, sourceId);
  }

  const normalizedItems = normalizeTpPlanWorkoutsToPlanMyPeakLibraryItems(
    workouts,
    { exerciseLibraryId: trainingPlan.planId }
  );

  if (normalizedItems.length === 0) {
    onProgress?.({
      phase: 'complete',
      status: 'failed',
      current: 0,
      total: 1,
      overallCurrent: 0,
      overallTotal: 1,
      itemName: planName,
      message: 'No classic plan workouts were available to export',
    });

    return {
      success: false,
      fileName: planName,
      format: 'api',
      itemsExported: 0,
      warnings,
      errors: ['No classic plan workouts were available to export'],
    };
  }

  const transformConfig: PlanMyPeakExportConfig = {
    ...config,
    createFolder: true,
    targetLibraryName: config.targetLibraryName || `${planName} - Workouts`,
  };

  const transformedWorkouts = await planMyPeakAdapter.transform(
    normalizedItems,
    transformConfig
  );
  const validation = await planMyPeakAdapter.validate(transformedWorkouts);
  warnings.push(...validation.warnings);

  if (!validation.isValid) {
    const errors = validation.errors.map((error) => error.message);
    onProgress?.({
      phase: 'complete',
      status: 'failed',
      current: 0,
      total: 1,
      overallCurrent: 0,
      overallTotal: 1,
      itemName: planName,
      message: errors[0] || 'Validation failed',
    });

    return {
      success: false,
      fileName: planName,
      format: 'api',
      itemsExported: 0,
      warnings,
      errors,
    };
  }

  const folderPhaseTotal = 2;
  const classicPhaseTotal = transformedWorkouts.length;
  const notesPhaseTotal = notes.length;
  const overallTotal = Math.max(
    1,
    folderPhaseTotal + classicPhaseTotal + notesPhaseTotal
  );

  let overallCurrent = 0;
  let folderCurrent = 0;
  let classicCurrent = 0;

  const emitProgress = (
    phase: TrainingPlanExportProgressPayload['phase'],
    status: TrainingPlanExportProgressPayload['status'],
    current: number,
    total: number,
    itemName?: string,
    message?: string
  ): void => {
    onProgress?.({
      phase,
      status,
      current,
      total,
      overallCurrent,
      overallTotal,
      itemName,
      message,
    });
  };

  const failWithProgress = (
    errors: string[],
    options: {
      phase: Exclude<TrainingPlanExportProgressPayload['phase'], 'complete'>;
      phaseCurrent: number;
      phaseTotal: number;
      message: string;
      itemsExported?: number;
    }
  ): ExportResultType => {
    emitProgress(
      options.phase,
      'failed',
      options.phaseCurrent,
      options.phaseTotal,
      planName,
      options.message
    );
    emitProgress(
      'complete',
      'failed',
      overallCurrent,
      overallTotal,
      planName,
      options.message
    );

    return {
      success: false,
      fileName: planName,
      format: 'api',
      itemsExported: options.itemsExported ?? 0,
      warnings,
      errors,
    };
  };

  emitProgress(
    'folder',
    'started',
    folderCurrent,
    folderPhaseTotal,
    planName,
    'Resolving shared PlanMyPeak workout library'
  );

  const libraryResult = await resolveSharedPlanWorkoutLibrary(
    transformConfig.targetLibraryName
  );
  if (!libraryResult.success) {
    return failWithProgress(
      [
        libraryResult.error.message ||
          'Failed to resolve PlanMyPeak shared plan workout library',
      ],
      {
        phase: 'folder',
        phaseCurrent: folderCurrent,
        phaseTotal: folderPhaseTotal,
        message: 'Failed to resolve shared PlanMyPeak workout library',
      }
    );
  }

  folderCurrent += 1;
  overallCurrent += 1;
  emitProgress(
    'folder',
    'progress',
    folderCurrent,
    folderPhaseTotal,
    libraryResult.data.name,
    'Shared workout library ready'
  );

  const sourceIdToWorkoutId = new Map<string, string>();
  const sourceIdToSummary = new Map<
    string,
    {
      name: string;
      type: string;
      sport_type: PlanMyPeakWorkout['sport_type'];
      base_duration_min: number;
      base_tss: number;
    }
  >();

  emitProgress(
    'classicWorkouts',
    'started',
    classicCurrent,
    classicPhaseTotal,
    planName,
    'Resolving and uploading classic workouts'
  );

  for (const workout of transformedWorkouts) {
    let itemMessage = '';

    const tpWorkoutId = Number.parseInt(workout.id, 36);
    const sourceId = Number.isFinite(tpWorkoutId)
      ? (tpWorkoutSourceIdById.get(tpWorkoutId) ?? null)
      : null;
    if (!sourceId) {
      warnings.push({
        field: `workouts:${workout.id}`,
        severity: 'warning',
        message: `Skipped "${workout.name}" because TP source_id could not be resolved`,
      });
      itemMessage = 'Skipped: TP source_id could not be resolved';
      classicCurrent += 1;
      overallCurrent += 1;
      emitProgress(
        'classicWorkouts',
        'progress',
        classicCurrent,
        classicPhaseTotal,
        workout.name,
        itemMessage
      );
      continue;
    }

    sourceIdToSummary.set(sourceId, {
      name: workout.name,
      type: workout.type,
      sport_type: workout.sport_type,
      base_duration_min: workout.base_duration_min,
      base_tss: workout.base_tss,
    });

    if (sourceIdToWorkoutId.has(sourceId)) {
      itemMessage = 'Reused deduped workout from this export batch';
      classicCurrent += 1;
      overallCurrent += 1;
      emitProgress(
        'classicWorkouts',
        'progress',
        classicCurrent,
        classicPhaseTotal,
        workout.name,
        itemMessage
      );
      continue;
    }

    const existingResult = await chrome.runtime.sendMessage<
      GetPlanMyPeakWorkoutByProviderIdMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem | null>
    >({
      type: 'GET_PLANMYPEAK_WORKOUT_BY_PROVIDER_ID',
      providerWorkoutId: workout.provider_workout_id,
      libraryId: libraryResult.data.id,
    });

    if (!existingResult.success) {
      return failWithProgress(
        [
          existingResult.error.message ||
            `Failed to resolve existing workout for source_id ${sourceId}`,
        ],
        {
          phase: 'classicWorkouts',
          phaseCurrent: classicCurrent,
          phaseTotal: classicPhaseTotal,
          message: `Failed while resolving workout "${workout.name}"`,
        }
      );
    }

    if (existingResult.data) {
      sourceIdToWorkoutId.set(sourceId, existingResult.data.id);
      itemMessage = 'Reused existing workout from shared library';
      classicCurrent += 1;
      overallCurrent += 1;
      emitProgress(
        'classicWorkouts',
        'progress',
        classicCurrent,
        classicPhaseTotal,
        workout.name,
        itemMessage
      );
      continue;
    }

    const uploadResult = await chrome.runtime.sendMessage<
      ExportWorkoutsToPlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakUploadSummary>
    >({
      type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
      workouts: [workout],
      libraryId: libraryResult.data.id,
    });

    if (!uploadResult.success || uploadResult.data.results.length === 0) {
      return failWithProgress(
        [
          uploadResult.success
            ? `Failed to create PlanMyPeak workout for source_id ${sourceId}`
            : uploadResult.error.message,
        ],
        {
          phase: 'classicWorkouts',
          phaseCurrent: classicCurrent,
          phaseTotal: classicPhaseTotal,
          message: `Failed while creating workout "${workout.name}"`,
        }
      );
    }

    sourceIdToWorkoutId.set(sourceId, uploadResult.data.results[0].workout.id);
    itemMessage = 'Created workout in shared library';
    classicCurrent += 1;
    overallCurrent += 1;
    emitProgress(
      'classicWorkouts',
      'progress',
      classicCurrent,
      classicPhaseTotal,
      workout.name,
      itemMessage
    );
  }

  emitProgress(
    'classicWorkouts',
    'completed',
    classicCurrent,
    classicPhaseTotal,
    planName,
    'Classic workout processing complete'
  );

  const planStart = parseTpDateToUtcMidnight(trainingPlan.startDate);
  if (!planStart) {
    return failWithProgress(
      [`Invalid training plan startDate: ${trainingPlan.startDate}`],
      {
        phase: 'folder',
        phaseCurrent: folderCurrent,
        phaseTotal: folderPhaseTotal,
        message: 'Invalid training plan start date',
      }
    );
  }

  /** One scheduled session, in PlanMyPeak's terms. */
  interface Placement {
    providerEntryId: string;
    weekNumber: number;
    dayOfWeek: number;
    position: number;
    planMyPeakWorkoutId: string;
    title: string;
  }

  const placements: Placement[] = [];
  const seenProviderEntryIds = new Set<string>();

  // Earliest first, so `orderOnDay` gaps fall back to a stable ordering.
  const sortedPlanWorkouts = [...workouts].sort((a, b) => {
    const dayCompare = a.workoutDay.localeCompare(b.workoutDay);
    return dayCompare !== 0
      ? dayCompare
      : (a.orderOnDay ?? 0) - (b.orderOnDay ?? 0);
  });

  for (const workout of sortedPlanWorkouts) {
    const structureSourceId = tpWorkoutSourceIdById.get(workout.workoutId);
    const planMyPeakWorkoutId = structureSourceId
      ? sourceIdToWorkoutId.get(structureSourceId)
      : undefined;
    if (!planMyPeakWorkoutId) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped placement for "${workout.title}" because its workout was not uploaded`,
      });
      continue;
    }

    const workoutDate = parseTpDateToUtcMidnight(workout.workoutDay);
    if (!workoutDate) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped placement for "${workout.title}" due to invalid date ${workout.workoutDay}`,
      });
      continue;
    }

    const weekNumber = getWeekNumber(workoutDate, planStart);
    if (weekNumber < 1 || weekNumber > MAX_PLAN_WEEKS) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped placement for "${workout.title}": week ${weekNumber} is outside the 1-${MAX_PLAN_WEEKS} PlanMyPeak supports`,
      });
      continue;
    }

    const providerEntryId = String(workout.workoutId);

    // The diagnostic the PlanMyPeak side needs: if TrainingPeaks reuses a
    // workoutId within one plan, the second occurrence would be read as a *move*
    // of the first and the plan would silently end up short. Detected here, in
    // the payload, before any request — no round trip and no confusing it with a
    // coach having moved something.
    if (seenProviderEntryIds.has(providerEntryId)) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `TrainingPeaks reused workout id ${providerEntryId} within this plan. Only the last occurrence will be scheduled — please report this, it affects how imports identify sessions.`,
      });
    }
    seenProviderEntryIds.add(providerEntryId);

    placements.push({
      providerEntryId,
      weekNumber,
      // getDayOfWeek is 0 = Monday; PlanMyPeak uses ISO, 1 = Monday.
      dayOfWeek: getDayOfWeek(workoutDate) + 1,
      position:
        typeof workout.orderOnDay === 'number' &&
        Number.isFinite(workout.orderOnDay)
          ? Math.min(
              MAX_ENTRY_POSITION,
              Math.max(0, Math.round(workout.orderOnDay))
            )
          : 0,
      planMyPeakWorkoutId,
      title: workout.title,
    });
  }

  const sourceWeekCount = Math.min(
    MAX_PLAN_WEEKS,
    Math.max(
      1,
      trainingPlan.weekCount ?? 0,
      ...placements.map((placement) => placement.weekNumber)
    )
  );

  // Resolve the plan's container. Listing creates the coach's default if they
  // have none, so there is always somewhere to put it.
  const planLibrariesResponse = await chrome.runtime.sendMessage<
    GetPlanMyPeakPlanLibrariesMessage,
    ApiResponse<PlanMyPeakPlanLibrary[]>
  >({ type: 'GET_PLANMYPEAK_PLAN_LIBRARIES' });

  if (!planLibrariesResponse.success) {
    return failWithProgress([planLibrariesResponse.error.message], {
      phase: 'plan',
      phaseCurrent: 0,
      phaseTotal: 1,
      message: 'Failed to read PlanMyPeak plan libraries',
    });
  }

  // Mirror the TrainingPeaks folder as the PlanMyPeak plan library, the way a
  // workout library already mirrors its TrainingPeaks source. Falls back to the
  // coach's default when we have no folder name — listing creates that default
  // if they have none, so there is always a destination.
  const foldersResponse = await chrome.runtime.sendMessage<
    GetTrainingPlanFoldersMessage,
    ApiResponse<PlanFolder[]>
  >({ type: 'GET_TRAINING_PLAN_FOLDERS' });

  if (!foldersResponse.success) {
    warnings.push({
      field: 'planLibrary',
      severity: 'warning',
      message: `Could not read TrainingPeaks plan folders, using the default PlanMyPeak plan library: ${foldersResponse.error.message}`,
    });
  }

  const planFolderName = foldersResponse.success
    ? resolveTrainingPeaksPlanFolderName(
        trainingPlan.planId,
        foldersResponse.data
      )
    : null;

  let planLibrary =
    planLibrariesResponse.data.find((library) => library.isDefault) ??
    planLibrariesResponse.data[0];

  if (planFolderName) {
    const byName = planLibrariesResponse.data.find(
      (library) =>
        library.name.trim().toLowerCase() === planFolderName.toLowerCase()
    );

    if (byName) {
      planLibrary = byName;
    } else {
      const created = await chrome.runtime.sendMessage<
        CreatePlanMyPeakPlanLibraryMessage,
        ApiResponse<PlanMyPeakPlanLibrary>
      >({
        type: 'CREATE_PLANMYPEAK_PLAN_LIBRARY',
        name: planFolderName,
      });

      if (created.success) {
        planLibrary = created.data;
      } else {
        warnings.push({
          field: 'planLibrary',
          severity: 'warning',
          message: `Could not create plan library "${planFolderName}", using "${planLibrary?.name ?? 'the default'}" instead: ${created.error.message}`,
        });
      }
    }
  }

  emitProgress('plan', 'started', 0, 1, planName, 'Creating training plan');

  // The plan is created at its full length. Shortening happens last, after any
  // stranded entries are gone, because the server refuses to shrink a plan below
  // its highest scheduled week.
  const upsertPlanResponse = await chrome.runtime.sendMessage<
    UpsertPlanMyPeakPlanMessage,
    ApiResponse<PlanMyPeakUpsertResult<PlanMyPeakPlanSummary>>
  >({
    type: 'UPSERT_PLANMYPEAK_PLAN',
    payload: {
      name: planName,
      description: trainingPlan.description ?? null,
      weekCount: sourceWeekCount,
      libraryId: planLibrary?.id,
      provider: TRAINING_PEAKS_PROVIDER_CODE,
      providerPlanId: String(trainingPlan.planId),
      providerMetadata: {
        trainingPeaksPlanId: trainingPlan.planId,
        trainingPeaksStartDate: trainingPlan.startDate,
      },
    },
  });

  if (!upsertPlanResponse.success) {
    return failWithProgress([upsertPlanResponse.error.message], {
      phase: 'plan',
      phaseCurrent: 0,
      phaseTotal: 1,
      message: `Failed to create training plan "${planName}"`,
    });
  }

  const plan = upsertPlanResponse.data.value;
  if (!upsertPlanResponse.data.created) {
    warnings.push({
      field: 'plan',
      severity: 'warning',
      message: `"${plan.name}" already existed in PlanMyPeak and was updated in place.`,
    });
  }
  if (planLibrary && plan.library.id !== planLibrary.id) {
    warnings.push({
      field: 'plan',
      severity: 'warning',
      message: `"${plan.name}" lives in "${plan.library.name}" because you moved it there, and was updated there rather than moved back.`,
    });
  }

  emitProgress('plan', 'completed', 1, 1, planName, 'Training plan ready');

  // Read the existing schedule before touching it, so the reconcile knows which
  // entries the source no longer has.
  const existingPlanResponse = await chrome.runtime.sendMessage<
    GetPlanMyPeakPlanMessage,
    ApiResponse<PlanMyPeakPlanDetail>
  >({ type: 'GET_PLANMYPEAK_PLAN', planId: plan.id });

  const existingEntries = existingPlanResponse.success
    ? existingPlanResponse.data.entries
    : [];

  emitProgress(
    'entries',
    'started',
    0,
    placements.length,
    planName,
    'Scheduling workouts'
  );

  let entriesCurrent = 0;
  let scheduledWorkoutCount = 0;

  for (const placement of placements) {
    const entryResponse = await chrome.runtime.sendMessage<
      UpsertPlanMyPeakPlanEntryMessage,
      ApiResponse<PlanMyPeakUpsertResult<PlanMyPeakPlanEntry>>
    >({
      type: 'UPSERT_PLANMYPEAK_PLAN_ENTRY',
      planId: plan.id,
      payload: {
        workoutId: placement.planMyPeakWorkoutId,
        weekNumber: placement.weekNumber,
        dayOfWeek: placement.dayOfWeek,
        position: placement.position,
        provider: TRAINING_PEAKS_PROVIDER_CODE,
        providerEntryId: placement.providerEntryId,
        // `note` is deliberately absent: an omitted note is kept, and we have
        // none to offer. Sending null would erase whatever the coach wrote.
      },
    });

    entriesCurrent += 1;
    overallCurrent += 1;

    if (!entryResponse.success) {
      warnings.push({
        field: `entries:${placement.providerEntryId}`,
        severity: 'warning',
        message: `Failed to schedule "${placement.title}" in week ${placement.weekNumber}: ${entryResponse.error.message}`,
      });
    } else {
      scheduledWorkoutCount += 1;
    }

    emitProgress(
      'entries',
      'progress',
      entriesCurrent,
      placements.length,
      placement.title,
      entryResponse.success ? 'Scheduled' : 'Failed'
    );
  }

  emitProgress(
    'entries',
    'completed',
    entriesCurrent,
    placements.length,
    planName,
    'Scheduling complete'
  );

  // Remove sessions this import no longer has. Only entries we placed are
  // considered: one a coach scheduled by hand carries no provider identity and
  // is never adopted, so it is never removed either.
  const stale = existingEntries.filter(
    (entry) =>
      entry.provider === TRAINING_PEAKS_PROVIDER_CODE &&
      entry.providerEntryId !== null &&
      !seenProviderEntryIds.has(entry.providerEntryId)
  );

  for (const entry of stale) {
    const deleted = await chrome.runtime.sendMessage<
      DeletePlanMyPeakPlanEntryMessage,
      ApiResponse<null>
    >({
      type: 'DELETE_PLANMYPEAK_PLAN_ENTRY',
      planId: plan.id,
      entryId: entry.id,
    });

    if (!deleted.success) {
      warnings.push({
        field: `entries:${entry.id}`,
        severity: 'warning',
        message: `Kept "${entry.workout.name}" in week ${entry.weekNumber}: ${deleted.error.message}`,
      });
    }
  }

  // Shortening last, once nothing is stranded outside the new length.
  if (plan.weekCount > sourceWeekCount) {
    const shortened = await chrome.runtime.sendMessage<
      UpdatePlanMyPeakPlanMessage,
      ApiResponse<PlanMyPeakPlanSummary>
    >({
      type: 'UPDATE_PLANMYPEAK_PLAN',
      planId: plan.id,
      payload: { weekCount: sourceWeekCount },
    });

    if (!shortened.success) {
      warnings.push({
        field: 'plan',
        severity: 'warning',
        message: `Left "${plan.name}" at ${plan.weekCount} weeks: ${shortened.error.message}`,
      });
    }
  }

  if (notes.length > 0) {
    // TrainingPeaks calendar notes are day-level annotations. PlanMyPeak models
    // a note only on a scheduled entry, so a note on a day with no session has
    // nowhere to go. Reported rather than dropped silently.
    warnings.push({
      field: 'notes',
      severity: 'warning',
      message: `${notes.length} TrainingPeaks calendar note(s) were not imported - PlanMyPeak attaches notes to a scheduled workout, not to a day.`,
    });
  }

  emitProgress(
    'complete',
    'completed',
    overallCurrent,
    overallTotal,
    planName,
    'Training plan export complete'
  );

  return {
    success: true,
    fileName: planName,
    format: 'api',
    itemsExported: scheduledWorkoutCount,
    warnings,
  };
}

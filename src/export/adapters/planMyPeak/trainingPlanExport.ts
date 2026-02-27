import type {
  CreatePlanMyPeakLibraryMessage,
  CreatePlanMyPeakTrainingPlanMessage,
  CreatePlanMyPeakTrainingPlanNoteMessage,
  ExportWorkoutsToPlanMyPeakLibraryMessage,
  GetPlanMyPeakLibrariesMessage,
  GetPlanMyPeakWorkoutBySourceIdMessage,
  TrainingPlanExportProgressPayload,
} from '@/types';
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
  PlanMyPeakCreateTrainingPlanRequest,
  PlanMyPeakExportConfig,
  PlanMyPeakTrainingPlanNote,
  PlanMyPeakWeekWorkoutsData,
  PlanMyPeakWorkout,
  TrainingPhase,
} from '@/types/planMyPeak.types';
import type {
  PlanMyPeakLibrary,
  PlanMyPeakWorkoutLibraryItem,
} from '@/schemas/planMyPeakApi.schema';
import { getDayOfWeek, getWeekNumber } from '@/utils/dateUtils';
import { planMyPeakAdapter } from './PlanMyPeakAdapter';
import { normalizeTpPlanWorkoutsToPlanMyPeakLibraryItems } from './trainingPlanNormalizer';

const TP_SHARED_PLAN_WORKOUT_LIBRARY_SOURCE_ID = 'TP:PLAN_WORKOUTS_V1';
const TP_SHARED_PLAN_WORKOUT_LIBRARY_NAME = 'TrainingPeaks Plan Workouts';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

interface ExportTrainingPlanClassicWorkoutsToPlanMyPeakOptions {
  trainingPlan: TrainingPlan;
  workouts: PlanWorkout[];
  notes?: CalendarNote[];
  config: PlanMyPeakExportConfig;
  onProgress?: (progress: TrainingPlanExportProgressPayload) => void;
}

interface WeekBuildState {
  workouts: PlanMyPeakWeekWorkoutsData;
  weeklyTss: number;
}

function createEmptyWeekWorkouts(): PlanMyPeakWeekWorkoutsData {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
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

function inferWeekPhase(weekNumber: number, totalWeeks: number): TrainingPhase {
  if (totalWeeks <= 1) {
    return 'Base';
  }

  if (weekNumber === totalWeeks) {
    return 'Recovery';
  }

  const progress = weekNumber / totalWeeks;
  if (progress <= 0.5) {
    return 'Base';
  }
  if (progress >= 0.85) {
    return 'Peak';
  }

  return 'Build';
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

  const existing = librariesResponse.data.find(
    (library) => library.source_id === TP_SHARED_PLAN_WORKOUT_LIBRARY_SOURCE_ID
  );
  if (existing) {
    return { success: true, data: existing };
  }

  return chrome.runtime.sendMessage<
    CreatePlanMyPeakLibraryMessage,
    ApiResponse<PlanMyPeakLibrary>
  >({
    type: 'CREATE_PLANMYPEAK_LIBRARY',
    name:
      preferredName?.trim() ||
      `${TP_SHARED_PLAN_WORKOUT_LIBRARY_NAME} (Shared)`,
    sourceId: TP_SHARED_PLAN_WORKOUT_LIBRARY_SOURCE_ID,
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
  let notesCurrent = 0;

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
      GetPlanMyPeakWorkoutBySourceIdMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem | null>
    >({
      type: 'GET_PLANMYPEAK_WORKOUT_BY_SOURCE_ID',
      sourceId,
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

    const uploadPayload: PlanMyPeakWorkout = {
      ...workout,
      source_id: sourceId,
    };

    const uploadResult = await chrome.runtime.sendMessage<
      ExportWorkoutsToPlanMyPeakLibraryMessage,
      ApiResponse<PlanMyPeakWorkoutLibraryItem[]>
    >({
      type: 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY',
      workouts: [uploadPayload],
      libraryId: libraryResult.data.id,
    });

    if (!uploadResult.success || uploadResult.data.length === 0) {
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

    sourceIdToWorkoutId.set(sourceId, uploadResult.data[0].id);
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

  const weekState = new Map<number, WeekBuildState>();
  let scheduledWorkoutCount = 0;

  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dayCompare = a.workoutDay.localeCompare(b.workoutDay);
    if (dayCompare !== 0) {
      return dayCompare;
    }

    const aOrder =
      typeof a.orderOnDay === 'number' ? a.orderOnDay : Number.MAX_SAFE_INTEGER;
    const bOrder =
      typeof b.orderOnDay === 'number' ? b.orderOnDay : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

  for (const workout of sortedWorkouts) {
    const sourceId = tpWorkoutSourceIdById.get(workout.workoutId) ?? null;
    if (!sourceId) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped workout placement for "${workout.title}" because structure was missing`,
      });
      continue;
    }

    const planMyPeakWorkoutId = sourceIdToWorkoutId.get(sourceId);
    const summary = sourceIdToSummary.get(sourceId);
    if (!planMyPeakWorkoutId || !summary) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped workout placement for "${workout.title}" because deduped workout was unavailable`,
      });
      continue;
    }

    const workoutDate = parseTpDateToUtcMidnight(workout.workoutDay);
    if (!workoutDate) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped workout placement for "${workout.title}" due to invalid date ${workout.workoutDay}`,
      });
      continue;
    }

    const weekNumber = getWeekNumber(workoutDate, planStart);
    if (weekNumber < 1) {
      warnings.push({
        field: `workouts:${workout.workoutId}`,
        severity: 'warning',
        message: `Skipped workout placement for "${workout.title}" because it occurs before plan start`,
      });
      continue;
    }

    const dayIndex = getDayOfWeek(workoutDate);
    const dayKey = DAY_KEYS[dayIndex];

    let week = weekState.get(weekNumber);
    if (!week) {
      week = {
        workouts: createEmptyWeekWorkouts(),
        weeklyTss: 0,
      };
      weekState.set(weekNumber, week);
    }

    const fallbackOrder = week.workouts[dayKey].length;
    const order =
      typeof workout.orderOnDay === 'number' &&
      Number.isFinite(workout.orderOnDay)
        ? Math.max(0, Math.round(workout.orderOnDay))
        : fallbackOrder;

    week.workouts[dayKey].push({
      id: `tp-${workout.workoutId}-${weekNumber}-${dayIndex}-${order}`,
      order,
      workoutKey: planMyPeakWorkoutId,
      workout: {
        name: summary.name,
        type: summary.type,
        sport_type: summary.sport_type,
        base_duration_min: Math.max(
          1,
          Math.round(summary.base_duration_min || 1)
        ),
        base_tss: Math.max(0, Math.round(summary.base_tss || 0)),
      },
    });

    week.weeklyTss += Math.max(0, Math.round(summary.base_tss || 0));
    scheduledWorkoutCount += 1;
  }

  const weekNumbers = Array.from(weekState.keys());
  const maxWeekFromWorkouts =
    weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0;
  const totalWeeks = Math.max(
    trainingPlan.weekCount || 0,
    maxWeekFromWorkouts,
    1
  );

  const weeks: PlanMyPeakCreateTrainingPlanRequest['weeks'] = [];
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    const state = weekState.get(weekNumber) ?? {
      workouts: createEmptyWeekWorkouts(),
      weeklyTss: 0,
    };

    for (const dayKey of DAY_KEYS) {
      state.workouts[dayKey].sort((a, b) => a.order - b.order);
    }

    weeks.push({
      weekNumber,
      phase: inferWeekPhase(weekNumber, totalWeeks),
      weeklyTss: state.weeklyTss,
      notes: null,
      workouts: state.workouts,
    });
  }

  const createPlanPayload: PlanMyPeakCreateTrainingPlanRequest = {
    metadata: {
      name: planName,
      description: trainingPlan.description,
      goal: `Imported from TrainingPeaks plan ${trainingPlan.planId}`,
      source_id: `TP:${trainingPlan.planId}`,
    },
    weeks,
    publish: true,
  };

  emitProgress(
    'folder',
    'progress',
    folderCurrent,
    folderPhaseTotal,
    planName,
    'Creating PlanMyPeak training plan'
  );

  const createPlanResponse = await chrome.runtime.sendMessage<
    CreatePlanMyPeakTrainingPlanMessage,
    ApiResponse<{ success: boolean; planId: string; savedAt: string }>
  >({
    type: 'CREATE_PLANMYPEAK_TRAINING_PLAN',
    payload: createPlanPayload,
  });

  if (!createPlanResponse.success) {
    return failWithProgress(
      [
        createPlanResponse.error.message ||
          `Failed to create PlanMyPeak training plan "${planName}"`,
      ],
      {
        phase: 'folder',
        phaseCurrent: folderCurrent,
        phaseTotal: folderPhaseTotal,
        message: `Failed to create PlanMyPeak training plan "${planName}"`,
        itemsExported: scheduledWorkoutCount,
      }
    );
  }

  folderCurrent += 1;
  overallCurrent += 1;
  emitProgress(
    'folder',
    'completed',
    folderCurrent,
    folderPhaseTotal,
    planName,
    'Training plan created'
  );

  emitProgress(
    'notes',
    'started',
    notesCurrent,
    notesPhaseTotal,
    planName,
    notesPhaseTotal > 0 ? 'Creating plan notes' : 'No notes to export'
  );

  for (const note of notes) {
    const noteTitle = note.title?.trim() || `Note ${note.id}`;
    let noteMessage = '';

    const noteDate = parseTpDateToUtcMidnight(note.noteDate);
    if (!noteDate) {
      warnings.push({
        field: `notes:${note.id}`,
        severity: 'warning',
        message: `Skipped note "${note.title}" due to invalid date ${note.noteDate}`,
      });
      noteMessage = `Skipped: invalid date ${note.noteDate}`;
      notesCurrent += 1;
      overallCurrent += 1;
      emitProgress(
        'notes',
        'progress',
        notesCurrent,
        notesPhaseTotal,
        noteTitle,
        noteMessage
      );
      continue;
    }

    const weekNumber = getWeekNumber(noteDate, planStart);
    if (weekNumber < 1) {
      warnings.push({
        field: `notes:${note.id}`,
        severity: 'warning',
        message: `Skipped note "${note.title}" because it occurs before plan start`,
      });
      noteMessage = 'Skipped: note occurs before plan start';
      notesCurrent += 1;
      overallCurrent += 1;
      emitProgress(
        'notes',
        'progress',
        notesCurrent,
        notesPhaseTotal,
        noteTitle,
        noteMessage
      );
      continue;
    }

    const dayOfWeek = getDayOfWeek(noteDate);
    const createNoteResponse = await chrome.runtime.sendMessage<
      CreatePlanMyPeakTrainingPlanNoteMessage,
      ApiResponse<PlanMyPeakTrainingPlanNote>
    >({
      type: 'CREATE_PLANMYPEAK_TRAINING_PLAN_NOTE',
      planId: createPlanResponse.data.planId,
      payload: {
        week_number: weekNumber,
        day_of_week: dayOfWeek,
        title: note.title?.trim() || `Note ${note.id}`,
        description: note.description?.trim() ? note.description.trim() : null,
      },
    });

    if (!createNoteResponse.success) {
      warnings.push({
        field: `notes:${note.id}`,
        severity: 'warning',
        message: `Failed to create note "${note.title}" for week ${weekNumber}, day ${dayOfWeek}: ${createNoteResponse.error.message}`,
      });
      noteMessage = `Failed: ${createNoteResponse.error.message}`;
    } else {
      noteMessage = `Created note for week ${weekNumber}, day ${dayOfWeek}`;
    }

    notesCurrent += 1;
    overallCurrent += 1;
    emitProgress(
      'notes',
      'progress',
      notesCurrent,
      notesPhaseTotal,
      noteTitle,
      noteMessage
    );
  }

  emitProgress(
    'notes',
    'completed',
    notesCurrent,
    notesPhaseTotal,
    planName,
    'Plan notes processing complete'
  );

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

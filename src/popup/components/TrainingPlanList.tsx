/**
 * TrainingPlanList component
 *
 * Displays list of training plans with loading, error, and empty states
 */

import { useState, useMemo, useEffect, useRef, type ReactElement } from 'react';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { TrainingPlanCard } from './TrainingPlanCard';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { ExportDialog, ExportResult } from './export';
import {
  is401Error,
  is403Error,
  getUserFriendlyErrorMessage,
  openTrainingPeaksTab,
} from '@/utils/trainingPeaksTab';
import {
  logApiResponseError,
  logErrorWithAuthDowngrade,
} from '@/utils/apiErrorLogging';
import type {
  ApiResponse,
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
  RxBuilderWorkout,
} from '@/types/api.types';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';
import type { ValidationMessage } from '@/export/adapters/base';
import type { ExportDestination } from '@/types/export.types';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type {
  IntervalsIcuExportConfig,
  IntervalsTrainingPlanExportResult,
} from '@/types/intervalsicu.types';
import type {
  ExportTrainingPlanToIntervalsMessage,
  GetPlanEventsMessage,
  GetPlanNotesMessage,
  GetPlanWorkoutsMessage,
  GetRxBuilderWorkoutsMessage,
  TrainingPlanExportProgressMessage,
  TrainingPlanExportProgressPayload,
  TrainingPlanExportProgressStatus,
} from '@/types';
import type { TrainingPlanExportProgressDialogState } from './export/ExportDialog';

export interface TrainingPlanListProps {
  onSelectPlan: (planId: number) => void;
}

type PlanExportDialogConfig = PlanMyPeakExportConfig | IntervalsIcuExportConfig;

type TrainingPlanExportPhaseUiStatus =
  | 'pending'
  | TrainingPlanExportProgressStatus;

interface TrainingPlanBatchExportBundle {
  trainingPlan: TrainingPlan;
  workouts: PlanWorkout[];
  rxWorkouts: RxBuilderWorkout[];
  notes: CalendarNote[];
  events: CalendarEvent[];
  totalStepCount: number;
}

interface ActiveBatchTrainingPlanProgressContext {
  completedStepsBeforePlan: number;
  batchOverallTotal: number;
  planIndex: number;
  planCount: number;
  planName: string;
}

function getTrainingPlanExportPhaseLabel(
  phase: TrainingPlanExportProgressPayload['phase']
): string {
  switch (phase) {
    case 'folder':
      return 'Creating Plan Folder';
    case 'classicWorkouts':
      return 'Classic Workouts';
    case 'rxWorkouts':
      return 'Strength Workouts';
    case 'notes':
      return 'Notes';
    case 'events':
      return 'Events';
    case 'complete':
      return 'Completed';
    default:
      return 'Exporting';
  }
}

function createTrainingPlanExportId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `intervals-plan-export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPhaseRows(
  classicCount: number,
  rxCount: number,
  notesCount: number,
  eventsCount: number
): TrainingPlanExportProgressDialogState['phases'] {
  return [
    {
      id: 'folder',
      label: 'Creating Plan Folder',
      status: 'pending',
      current: 0,
      total: 1,
    },
    {
      id: 'classicWorkouts',
      label: 'Classic Workouts',
      status: 'pending',
      current: 0,
      total: classicCount,
    },
    {
      id: 'rxWorkouts',
      label: 'Strength Workouts',
      status: 'pending',
      current: 0,
      total: rxCount,
    },
    {
      id: 'notes',
      label: 'Notes',
      status: 'pending',
      current: 0,
      total: notesCount,
    },
    {
      id: 'events',
      label: 'Events',
      status: 'pending',
      current: 0,
      total: eventsCount,
    },
  ];
}

function createPreparationProgressState(
  totalPlans: number,
  completedPlans: number,
  currentPlanName?: string
): TrainingPlanExportProgressDialogState {
  return {
    overallCurrent: completedPlans,
    overallTotal: totalPlans,
    currentPhaseLabel: 'Loading Selected Plans',
    currentPhaseCurrent: completedPlans,
    currentPhaseTotal: totalPlans,
    currentItemName: currentPlanName,
    message: 'Fetching workouts, strength workouts, notes, and events...',
    phases: createPhaseRows(0, 0, 0, 0),
  };
}

function createPlanExecutionProgressState(
  bundle: TrainingPlanBatchExportBundle,
  context: ActiveBatchTrainingPlanProgressContext
): TrainingPlanExportProgressDialogState {
  return {
    overallCurrent: context.completedStepsBeforePlan,
    overallTotal: context.batchOverallTotal,
    currentPhaseLabel: `Plan ${context.planIndex}/${context.planCount} · Preparing export`,
    currentPhaseCurrent: 0,
    currentPhaseTotal: bundle.totalStepCount,
    currentItemName: context.planName,
    message: context.planName,
    phases: createPhaseRows(
      bundle.workouts.length,
      bundle.rxWorkouts.length,
      bundle.notes.length,
      bundle.events.length
    ),
  };
}

function applyBatchTrainingPlanExportProgressUpdate(
  previous: TrainingPlanExportProgressDialogState | null,
  update: TrainingPlanExportProgressPayload,
  context: ActiveBatchTrainingPlanProgressContext
): TrainingPlanExportProgressDialogState | null {
  if (!previous) {
    return previous;
  }

  const nextPhases = previous.phases.map((phase) => {
    if (update.phase === 'complete' || phase.id !== update.phase) {
      return phase;
    }

    return {
      ...phase,
      status: update.status as TrainingPlanExportPhaseUiStatus,
      current: update.current,
      total: update.total,
      itemName: update.itemName,
      message: update.message,
    };
  });

  return {
    ...previous,
    overallCurrent: Math.min(
      context.batchOverallTotal,
      context.completedStepsBeforePlan + update.overallCurrent
    ),
    overallTotal: context.batchOverallTotal,
    currentPhaseLabel: `Plan ${context.planIndex}/${context.planCount} · ${getTrainingPlanExportPhaseLabel(update.phase)}`,
    currentPhaseCurrent: update.current,
    currentPhaseTotal: update.total,
    currentItemName: update.itemName || context.planName,
    message: update.message || context.planName,
    phases: nextPhases,
  };
}

async function fetchPlanWorkoutsForExport(
  planId: number
): Promise<PlanWorkout[]> {
  const response = await chrome.runtime.sendMessage<
    GetPlanWorkoutsMessage,
    ApiResponse<PlanWorkout[]>
  >({
    type: 'GET_PLAN_WORKOUTS',
    planId,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    `[TrainingPlanList] Failed to fetch plan workouts for plan ${planId}:`,
    response.error
  );
  throw new Error(response.error.message || 'Failed to fetch plan workouts');
}

async function fetchRxBuilderWorkoutsForExport(
  planId: number
): Promise<RxBuilderWorkout[]> {
  const response = await chrome.runtime.sendMessage<
    GetRxBuilderWorkoutsMessage,
    ApiResponse<RxBuilderWorkout[]>
  >({
    type: 'GET_RX_BUILDER_WORKOUTS',
    planId,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    `[TrainingPlanList] Failed to fetch RxBuilder workouts for plan ${planId}:`,
    response.error
  );
  throw new Error(
    response.error.message || 'Failed to fetch RxBuilder workouts'
  );
}

async function fetchPlanNotesForExport(
  planId: number
): Promise<CalendarNote[]> {
  const response = await chrome.runtime.sendMessage<
    GetPlanNotesMessage,
    ApiResponse<CalendarNote[]>
  >({
    type: 'GET_PLAN_NOTES',
    planId,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    `[TrainingPlanList] Failed to fetch plan notes for plan ${planId}:`,
    response.error
  );
  throw new Error(response.error.message || 'Failed to fetch plan notes');
}

async function fetchPlanEventsForExport(
  planId: number
): Promise<CalendarEvent[]> {
  const response = await chrome.runtime.sendMessage<
    GetPlanEventsMessage,
    ApiResponse<CalendarEvent[]>
  >({
    type: 'GET_PLAN_EVENTS',
    planId,
  });

  if (response.success) {
    return response.data;
  }

  logApiResponseError(
    `[TrainingPlanList] Failed to fetch plan events for plan ${planId}:`,
    response.error
  );
  throw new Error(response.error.message || 'Failed to fetch plan events');
}

async function fetchTrainingPlanBatchExportBundle(
  trainingPlan: TrainingPlan
): Promise<TrainingPlanBatchExportBundle> {
  const [workouts, rxWorkouts, notes, events] = await Promise.all([
    fetchPlanWorkoutsForExport(trainingPlan.planId),
    fetchRxBuilderWorkoutsForExport(trainingPlan.planId),
    fetchPlanNotesForExport(trainingPlan.planId),
    fetchPlanEventsForExport(trainingPlan.planId),
  ]);

  return {
    trainingPlan,
    workouts,
    rxWorkouts,
    notes,
    events,
    totalStepCount:
      1 + workouts.length + rxWorkouts.length + notes.length + events.length,
  };
}

function downloadJsonFile(fileName: string, data: unknown): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TrainingPlanList({
  onSelectPlan,
}: TrainingPlanListProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(
    new Set()
  );
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResultType | null>(
    null
  );
  const [trainingPlanExportProgress, setTrainingPlanExportProgress] =
    useState<TrainingPlanExportProgressDialogState | null>(null);
  const activeTrainingPlanExportIdRef = useRef<string | null>(null);
  const activeBatchTrainingPlanProgressContextRef =
    useRef<ActiveBatchTrainingPlanProgressContext | null>(null);
  const { data: plans, isLoading, error, refetch } = useTrainingPlans();

  // Filter plans based on search query
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!searchQuery) return plans;

    const query = searchQuery.toLowerCase();
    return plans.filter(
      (plan) =>
        plan.title.toLowerCase().includes(query) ||
        plan.author.toLowerCase().includes(query)
    );
  }, [plans, searchQuery]);

  const selectedPlans = useMemo(() => {
    if (!plans || selectedPlanIds.size === 0) {
      return [] as TrainingPlan[];
    }

    return plans.filter((plan) => selectedPlanIds.has(plan.planId));
  }, [plans, selectedPlanIds]);

  const selectedPlanWorkoutCount = useMemo(
    () =>
      selectedPlans.reduce(
        (total, plan) =>
          total + (Number.isFinite(plan.workoutCount) ? plan.workoutCount : 0),
        0
      ),
    [selectedPlans]
  );

  useEffect(() => {
    const handleRuntimeMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void
    ): void => {
      if (
        !message ||
        typeof message !== 'object' ||
        (message as { type?: unknown }).type !== 'TRAINING_PLAN_EXPORT_PROGRESS'
      ) {
        return;
      }

      const progressMessage = message as TrainingPlanExportProgressMessage;
      if (
        !activeTrainingPlanExportIdRef.current ||
        progressMessage.exportId !== activeTrainingPlanExportIdRef.current
      ) {
        return;
      }

      const context = activeBatchTrainingPlanProgressContextRef.current;
      if (!context) {
        return;
      }

      setTrainingPlanExportProgress((previous) =>
        applyBatchTrainingPlanExportProgressUpdate(
          previous,
          progressMessage.progress,
          context
        )
      );
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  // Selection handlers
  const handleSelectionChange = (planId: number, selected: boolean): void => {
    setSelectedPlanIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(planId);
      } else {
        newSet.delete(planId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (): void => {
    const allIds = new Set(filteredPlans.map((plan) => plan.planId));
    setSelectedPlanIds(allIds);
  };

  const handleClearSelection = (): void => {
    setSelectedPlanIds(new Set());
  };

  const handleExitSelectionMode = (): void => {
    setSelectionMode(false);
    setSelectedPlanIds(new Set());
  };

  const handleEnterSelectionMode = (): void => {
    setSelectionMode(true);
  };

  const handleExportSelected = (): void => {
    if (selectedPlanIds.size === 0) {
      return;
    }

    setIsExportDialogOpen(true);
  };

  const closeExportDialog = (): void => {
    if (isExporting) {
      return;
    }

    activeTrainingPlanExportIdRef.current = null;
    activeBatchTrainingPlanProgressContextRef.current = null;
    setTrainingPlanExportProgress(null);
    setIsExportDialogOpen(false);
  };

  const closeExportResult = (): void => {
    setExportResult(null);
  };

  const preloadSelectedPlanBundles = async (
    plansToExport: TrainingPlan[]
  ): Promise<TrainingPlanBatchExportBundle[]> => {
    const bundles: TrainingPlanBatchExportBundle[] = [];
    setTrainingPlanExportProgress(
      createPreparationProgressState(plansToExport.length, 0)
    );

    for (let i = 0; i < plansToExport.length; i++) {
      const plan = plansToExport[i];
      setTrainingPlanExportProgress(
        createPreparationProgressState(plansToExport.length, i, plan.title)
      );
      const bundle = await fetchTrainingPlanBatchExportBundle(plan);
      bundles.push(bundle);
      setTrainingPlanExportProgress(
        createPreparationProgressState(plansToExport.length, i + 1, plan.title)
      );
    }

    return bundles;
  };

  const exportSelectedPlansToPlanMyPeak = async (
    plansToExport: TrainingPlan[],
    config: PlanMyPeakExportConfig
  ): Promise<void> => {
    const bundles = await preloadSelectedPlanBundles(plansToExport);
    const fileBaseName =
      (config.fileName || 'training_plans_export').trim() ||
      'training_plans_export';

    const exportPayload = {
      exportDate: new Date().toISOString(),
      source: 'trainingPeaks',
      planCount: bundles.length,
      plans: bundles.map((bundle) => ({
        planId: bundle.trainingPlan.planId,
        planName: bundle.trainingPlan.title,
        trainingPlan: bundle.trainingPlan,
        classicWorkouts: bundle.workouts,
        rxBuilderWorkouts: bundle.rxWorkouts,
        notes: bundle.notes,
        events: bundle.events,
        summary: {
          totalClassicWorkouts: bundle.workouts.length,
          totalRxBuilderWorkouts: bundle.rxWorkouts.length,
          totalNotes: bundle.notes.length,
          totalEvents: bundle.events.length,
        },
      })),
      summary: {
        totalPlans: bundles.length,
        totalClassicWorkouts: bundles.reduce(
          (sum, bundle) => sum + bundle.workouts.length,
          0
        ),
        totalRxBuilderWorkouts: bundles.reduce(
          (sum, bundle) => sum + bundle.rxWorkouts.length,
          0
        ),
        totalNotes: bundles.reduce(
          (sum, bundle) => sum + bundle.notes.length,
          0
        ),
        totalEvents: bundles.reduce(
          (sum, bundle) => sum + bundle.events.length,
          0
        ),
      },
    };

    downloadJsonFile(`${fileBaseName}.json`, exportPayload);

    setExportResult({
      success: true,
      fileName: `${fileBaseName}.json`,
      format: 'json',
      itemsExported: bundles.reduce(
        (sum, bundle) => sum + bundle.workouts.length,
        0
      ),
      warnings: [],
    });
  };

  const exportSelectedPlansToIntervals = async (
    plansToExport: TrainingPlan[],
    config: IntervalsIcuExportConfig
  ): Promise<void> => {
    const bundles = await preloadSelectedPlanBundles(plansToExport);
    const batchOverallTotal = bundles.reduce(
      (sum, bundle) => sum + bundle.totalStepCount,
      0
    );

    let completedSteps = 0;
    let exportedWorkoutCount = 0;
    let successCount = 0;
    const warnings: ValidationMessage[] = [];
    const errors: string[] = [];

    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i];
      const exportId = createTrainingPlanExportId();
      const context: ActiveBatchTrainingPlanProgressContext = {
        completedStepsBeforePlan: completedSteps,
        batchOverallTotal,
        planIndex: i + 1,
        planCount: bundles.length,
        planName: bundle.trainingPlan.title,
      };

      activeTrainingPlanExportIdRef.current = exportId;
      activeBatchTrainingPlanProgressContextRef.current = context;
      setTrainingPlanExportProgress(
        createPlanExecutionProgressState(bundle, context)
      );

      try {
        const response = await chrome.runtime.sendMessage<
          ExportTrainingPlanToIntervalsMessage,
          ApiResponse<IntervalsTrainingPlanExportResult>
        >({
          type: 'EXPORT_TRAINING_PLAN_TO_INTERVALS',
          exportId,
          existingPlanAction: config.existingPlanAction,
          trainingPlan: bundle.trainingPlan,
          workouts: bundle.workouts,
          rxWorkouts: bundle.rxWorkouts,
          notes: bundle.notes,
          events: bundle.events,
        });

        if (!response.success) {
          warnings.push({
            field: 'trainingPlans',
            severity: 'warning',
            message: `Failed to export plan "${bundle.trainingPlan.title}": ${response.error.message || 'Unknown error'}`,
          });
          continue;
        }

        successCount += 1;
        exportedWorkoutCount += response.data.workouts.length;
      } catch (err) {
        logErrorWithAuthDowngrade(
          `[TrainingPlanList] Failed to export plan "${bundle.trainingPlan.title}" to Intervals.icu:`,
          err
        );
        warnings.push({
          field: 'trainingPlans',
          severity: 'warning',
          message: `Failed to export plan "${bundle.trainingPlan.title}": ${
            err instanceof Error ? err.message : 'Unknown export error'
          }`,
        });
      } finally {
        completedSteps += bundle.totalStepCount;
      }
    }

    activeTrainingPlanExportIdRef.current = null;
    activeBatchTrainingPlanProgressContextRef.current = null;

    if (successCount === 0) {
      if (warnings.length > 0) {
        errors.push(...warnings.map((warning) => warning.message));
      } else {
        errors.push('No selected training plans were exported');
      }

      setExportResult({
        success: false,
        fileName: 'Intervals.icu training plans',
        format: 'api',
        itemsExported: 0,
        warnings: [],
        errors,
      });
      return;
    }

    if (successCount < bundles.length) {
      warnings.unshift({
        field: 'trainingPlans',
        severity: 'warning',
        message: `Exported ${successCount} of ${bundles.length} training plans`,
      });
    }

    setExportResult({
      success: true,
      fileName: `Intervals.icu (${successCount}/${bundles.length} plans)`,
      format: 'api',
      itemsExported: exportedWorkoutCount,
      warnings,
    });
  };

  const handleExportFromDialog = async (
    config: PlanExportDialogConfig,
    destination: ExportDestination
  ): Promise<void> => {
    if (selectedPlans.length === 0) {
      setIsExportDialogOpen(false);
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      if (destination === 'planmypeak') {
        await exportSelectedPlansToPlanMyPeak(
          selectedPlans,
          config as PlanMyPeakExportConfig
        );
      } else if (destination === 'intervalsicu') {
        await exportSelectedPlansToIntervals(
          selectedPlans,
          config as IntervalsIcuExportConfig
        );
      }
    } catch (exportError) {
      logErrorWithAuthDowngrade(
        '[TrainingPlanList] Multi-plan export failed:',
        exportError
      );
      setExportResult({
        success: false,
        fileName: 'training_plans_export',
        format: destination === 'intervalsicu' ? 'api' : 'json',
        itemsExported: 0,
        warnings: [],
        errors: [
          exportError instanceof Error
            ? exportError.message
            : 'Unknown export error',
        ],
      });
    } finally {
      setIsExporting(false);
      activeTrainingPlanExportIdRef.current = null;
      activeBatchTrainingPlanProgressContextRef.current = null;
      setTrainingPlanExportProgress(null);
      setIsExportDialogOpen(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError = is401Error(error);
    const isPermissionError = is403Error(error);
    const friendlyMessage = getUserFriendlyErrorMessage(error);

    const handleRetry = async (): Promise<void> => {
      if (isAuthError) {
        // For 401 errors, open TrainingPeaks to get a fresh token
        await openTrainingPeaksTab();
      } else {
        // For other errors, just retry the request
        refetch();
      }
    };

    return (
      <div className="p-4">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-800">
            Failed to Load Data
          </p>
          <p className="mt-1 text-xs text-red-600">{friendlyMessage}</p>
          {isAuthError && (
            <p className="mt-2 text-xs text-red-500">
              Opening TrainingPeaks to refresh your authentication...
            </p>
          )}
          {isPermissionError && (
            <p className="mt-2 text-xs text-red-500">
              You don't have permission to access this content
            </p>
          )}
          <button
            onClick={handleRetry}
            className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            {isAuthError ? 'Open TrainingPeaks' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no plans at all)
  if (!plans || plans.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="No Training Plans Found"
          message="You don't have any training plans yet."
        />
      </div>
    );
  }

  // No search results state
  if (filteredPlans.length === 0) {
    return (
      <div className="mt-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="mt-4">
          <EmptyState
            title="No Training Plans Found"
            message={`No plans match "${searchQuery}"`}
          />
        </div>
      </div>
    );
  }

  // Success state with plans
  return (
    <div className="mt-4">
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Selection Mode Toolbar */}
      {selectionMode ? (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-900">
                {selectedPlanIds.size} selected
              </span>
              <div className="h-4 w-px bg-blue-300"></div>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
              >
                Select All ({filteredPlans.length})
              </button>
              {selectedPlanIds.size > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={handleExitSelectionMode}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Exit selection mode"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="p-3 bg-white">
            <button
              onClick={handleExportSelected}
              disabled={selectedPlanIds.size === 0}
              className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export{' '}
              {selectedPlanIds.size > 0 ? `${selectedPlanIds.size} ` : ''}
              {selectedPlanIds.size === 1 ? 'Plan' : 'Plans'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleEnterSelectionMode}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Export Multiple Plans
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {filteredPlans.map((plan) => (
          <TrainingPlanCard
            key={plan.planId}
            plan={plan}
            onClick={onSelectPlan}
            selectionMode={selectionMode}
            isSelected={selectedPlanIds.has(plan.planId)}
            onSelectionChange={handleSelectionChange}
          />
        ))}
      </div>

      <ExportDialog
        key={`multi-plan-export-${isExportDialogOpen ? 'open' : 'closed'}`}
        isOpen={isExportDialogOpen}
        onClose={closeExportDialog}
        onExport={handleExportFromDialog}
        itemCount={selectedPlanWorkoutCount}
        isExporting={isExporting}
        exportScope="trainingPlans"
        sourceTrainingPlanNames={selectedPlans.map((plan) => plan.title)}
        trainingPlanCount={selectedPlans.length}
        trainingPlanExportProgress={trainingPlanExportProgress || undefined}
      />

      {exportResult && (
        <ExportResult result={exportResult} onClose={closeExportResult} />
      )}
    </div>
  );
}

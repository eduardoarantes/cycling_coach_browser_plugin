/**
 * Export Dialog Component
 *
 * Modal dialog for configuring and executing workout export to multiple destinations
 */
import type { ReactElement } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import type {
  IntervalsFolderResponse,
  IntervalsIcuExportConfig,
  IntervalsPlanConflictAction,
} from '@/types/intervalsicu.types';
import {
  EXPORT_DESTINATIONS,
  type ExportDestination,
} from '@/types/export.types';
import type {
  FindIntervalsLibraryFolderByNameMessage,
  FindIntervalsPlanFolderByNameMessage,
  GetIntervalsApiKeyMessage,
  HasIntervalsApiKeyMessage,
} from '@/types';
import type { ApiResponse } from '@/types/api.types';
import { logger } from '@/utils/logger';

type ExportConfig = PlanMyPeakExportConfig | IntervalsIcuExportConfig;
export type ExportScope =
  | 'library'
  | 'libraries'
  | 'trainingPlan'
  | 'trainingPlans';
export type LibraryBatchExportStrategy = 'separate' | 'combined';

export interface TrainingPlanExportProgressDialogState {
  overallCurrent: number;
  overallTotal: number;
  currentPhaseLabel: string;
  currentPhaseCurrent: number;
  currentPhaseTotal: number;
  currentItemName?: string;
  message?: string;
  phases: Array<{
    id: string;
    label: string;
    status: 'pending' | 'started' | 'progress' | 'completed' | 'failed';
    current: number;
    total: number;
    itemName?: string;
    message?: string;
  }>;
}

interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when export is confirmed */
  onExport: (
    config: ExportConfig,
    destination: ExportDestination
  ) => void | Promise<void>;
  /** Number of items to be exported */
  itemCount: number;
  /** Whether export is in progress */
  isExporting?: boolean;
  /** Generic export progress percentage (used by library exports) */
  exportProgressPercent?: number;
  /** Generic export status message (used by library exports) */
  exportStatusMessage?: string;
  /** Source TrainingPeaks library name (used for provider folder naming) */
  sourceLibraryName?: string;
  /** Selected TrainingPeaks library names (used for multi-library conflict validation) */
  sourceLibraryNames?: string[];
  /** Selected TrainingPeaks training plan names (used for multi-plan conflict validation) */
  sourceTrainingPlanNames?: string[];
  /** Selected training plan count (used for UI copy in multi-plan mode) */
  trainingPlanCount?: number;
  /** Selected library count (used for multi-library UI copy) */
  libraryCount?: number;
  /** Multi-library export strategy (PlanMyPeak only) */
  libraryBatchStrategy?: LibraryBatchExportStrategy;
  /** Updates multi-library export strategy selection (PlanMyPeak only) */
  onLibraryBatchStrategyChange?: (strategy: LibraryBatchExportStrategy) => void;
  /** UI copy/behavior mode */
  exportScope?: ExportScope;
  /** Live progress state for training plan exports */
  trainingPlanExportProgress?: TrainingPlanExportProgressDialogState;
}

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  itemCount,
  isExporting = false,
  exportProgressPercent,
  exportStatusMessage,
  sourceLibraryName,
  sourceLibraryNames,
  sourceTrainingPlanNames,
  trainingPlanCount,
  libraryCount,
  libraryBatchStrategy = 'separate',
  onLibraryBatchStrategyChange,
  exportScope = 'library',
  trainingPlanExportProgress,
}: ExportDialogProps): ReactElement | null {
  const dialogScrollRef = useRef<HTMLDivElement | null>(null);
  const [fileName, setFileName] = useState('planmypeak_export');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [destination, setDestination] =
    useState<ExportDestination>('planmypeak');
  const [createFolder, setCreateFolder] = useState(true);
  const [hasIntervalsApiKey, setHasIntervalsApiKey] = useState(false);
  const [isCheckingExistingPlan, setIsCheckingExistingPlan] = useState(false);
  const [existingPlanConflict, setExistingPlanConflict] =
    useState<IntervalsFolderResponse | null>(null);
  const [existingPlanBatchConflicts, setExistingPlanBatchConflicts] = useState<
    IntervalsFolderResponse[]
  >([]);
  const [pendingIntervalsPlanConfig, setPendingIntervalsPlanConfig] =
    useState<IntervalsIcuExportConfig | null>(null);
  const [existingPlanConflictError, setExistingPlanConflictError] = useState<
    string | null
  >(null);

  // Check for Intervals.icu API key when dialog opens
  useEffect(() => {
    if (isOpen && destination === 'intervalsicu') {
      chrome.runtime
        .sendMessage<HasIntervalsApiKeyMessage, { hasKey: boolean }>({
          type: 'HAS_INTERVALS_API_KEY',
        })
        .then((response) => setHasIntervalsApiKey(response.hasKey))
        .catch((error) => {
          logger.error('Failed to check Intervals.icu API key:', error);
          setHasIntervalsApiKey(false);
        });
    }
  }, [isOpen, destination]);

  useEffect(() => {
    setExistingPlanConflict(null);
    setExistingPlanBatchConflicts([]);
    setPendingIntervalsPlanConfig(null);
    setExistingPlanConflictError(null);
    setIsCheckingExistingPlan(false);
  }, [destination, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (
      !existingPlanConflict &&
      existingPlanBatchConflicts.length === 0 &&
      !existingPlanConflictError
    ) {
      return;
    }

    dialogScrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [
    isOpen,
    existingPlanConflict,
    existingPlanBatchConflicts,
    existingPlanConflictError,
  ]);

  // Note: Dialog state is reset via key prop in parent component
  // This approach is more React-idiomatic than setState in useEffect

  if (!isOpen) return null;

  const selectedDestination = EXPORT_DESTINATIONS.find(
    (d) => d.id === destination
  );
  const isTrainingPlanScope = exportScope === 'trainingPlan';
  const isTrainingPlansBatchScope = exportScope === 'trainingPlans';
  const isSingleLibraryScope = exportScope === 'library';
  const isLibraryBatchScope = exportScope === 'libraries';
  const isLibraryLikeScope = isSingleLibraryScope || isLibraryBatchScope;
  const isTrainingPlanLikeScope =
    isTrainingPlanScope || isTrainingPlansBatchScope;
  const showDetailedExportProgress =
    isExporting && !!trainingPlanExportProgress;
  const showGenericExportProgress = !showDetailedExportProgress && isExporting;
  const isWaitingForConflictDecision =
    (isTrainingPlanLikeScope || (isLibraryLikeScope && createFolder)) &&
    destination === 'intervalsicu' &&
    !isExporting &&
    (!!existingPlanConflict || existingPlanBatchConflicts.length > 0) &&
    !!pendingIntervalsPlanConfig;

  const proceedWithIntervalsExport = async (
    config: IntervalsIcuExportConfig
  ): Promise<void> => {
    setExistingPlanConflict(null);
    setExistingPlanBatchConflicts([]);
    setPendingIntervalsPlanConfig(null);
    setExistingPlanConflictError(null);
    await onExport(config, 'intervalsicu');
  };

  const handleExistingPlanConflictAction = async (
    action: IntervalsPlanConflictAction | 'ignore'
  ): Promise<void> => {
    if (action === 'ignore') {
      setExistingPlanConflict(null);
      setExistingPlanBatchConflicts([]);
      setPendingIntervalsPlanConfig(null);
      setExistingPlanConflictError(null);
      onClose();
      return;
    }

    if (!pendingIntervalsPlanConfig) {
      return;
    }

    const nextConfig: IntervalsIcuExportConfig = isLibraryLikeScope
      ? {
          ...pendingIntervalsPlanConfig,
          existingLibraryAction: action,
        }
      : {
          ...pendingIntervalsPlanConfig,
          existingPlanAction: action,
        };

    await proceedWithIntervalsExport({
      ...nextConfig,
    });
  };

  const handleExport = async (): Promise<void> => {
    if (destination === 'planmypeak') {
      const config: PlanMyPeakExportConfig = {
        fileName,
        includeMetadata: true,
      };
      await onExport(config, destination);
    } else if (destination === 'intervalsicu') {
      // Get API key for Intervals.icu export
      try {
        setExistingPlanConflict(null);
        setExistingPlanBatchConflicts([]);
        setPendingIntervalsPlanConfig(null);
        setExistingPlanConflictError(null);

        const response = await chrome.runtime.sendMessage<
          GetIntervalsApiKeyMessage,
          { apiKey: string | null }
        >({
          type: 'GET_INTERVALS_API_KEY',
        });

        const config: IntervalsIcuExportConfig = {
          apiKey: response.apiKey || undefined,
          libraryName: sourceLibraryName?.trim() || 'TrainingPeaks Library',
          createFolder: isTrainingPlanScope ? true : createFolder,
        };

        if (isTrainingPlanScope) {
          const planName = (sourceLibraryName || '').trim();
          if (planName.length > 0) {
            setIsCheckingExistingPlan(true);
            try {
              const existingFolderResponse = await chrome.runtime.sendMessage<
                FindIntervalsPlanFolderByNameMessage,
                ApiResponse<IntervalsFolderResponse | null>
              >({
                type: 'FIND_INTERVALS_PLAN_FOLDER_BY_NAME',
                planName,
              });

              if (!existingFolderResponse.success) {
                setExistingPlanConflictError(
                  existingFolderResponse.error.message ||
                    'Failed to check existing Intervals plans'
                );
                return;
              }

              if (existingFolderResponse.data) {
                setExistingPlanConflict(existingFolderResponse.data);
                setPendingIntervalsPlanConfig(config);
                return;
              }
            } finally {
              setIsCheckingExistingPlan(false);
            }
          }
        } else if (isTrainingPlansBatchScope) {
          const uniquePlanNames = Array.from(
            new Set(
              (sourceTrainingPlanNames || [])
                .map((name) => name.trim())
                .filter((name) => name.length > 0)
            )
          );

          if (uniquePlanNames.length > 0) {
            setIsCheckingExistingPlan(true);
            try {
              const conflicts: IntervalsFolderResponse[] = [];
              for (const planName of uniquePlanNames) {
                const existingFolderResponse = await chrome.runtime.sendMessage<
                  FindIntervalsPlanFolderByNameMessage,
                  ApiResponse<IntervalsFolderResponse | null>
                >({
                  type: 'FIND_INTERVALS_PLAN_FOLDER_BY_NAME',
                  planName,
                });

                if (!existingFolderResponse.success) {
                  setExistingPlanConflictError(
                    existingFolderResponse.error.message ||
                      'Failed to check existing Intervals plans'
                  );
                  return;
                }

                if (existingFolderResponse.data) {
                  conflicts.push(existingFolderResponse.data);
                }
              }

              if (conflicts.length > 0) {
                setExistingPlanBatchConflicts(conflicts);
                setPendingIntervalsPlanConfig(config);
                return;
              }
            } finally {
              setIsCheckingExistingPlan(false);
            }
          }
        } else if (isLibraryLikeScope && config.createFolder) {
          const uniqueLibraryNames = Array.from(
            new Set(
              (isLibraryBatchScope
                ? sourceLibraryNames || []
                : sourceLibraryName
                  ? [sourceLibraryName]
                  : []
              )
                .map((name) => name.trim())
                .filter((name) => name.length > 0)
            )
          );

          if (uniqueLibraryNames.length > 0) {
            setIsCheckingExistingPlan(true);
            try {
              const conflicts: IntervalsFolderResponse[] = [];
              for (const folderName of uniqueLibraryNames) {
                const existingFolderResponse = await chrome.runtime.sendMessage<
                  FindIntervalsLibraryFolderByNameMessage,
                  ApiResponse<IntervalsFolderResponse | null>
                >({
                  type: 'FIND_INTERVALS_LIBRARY_FOLDER_BY_NAME',
                  folderName,
                });

                if (!existingFolderResponse.success) {
                  setExistingPlanConflictError(
                    existingFolderResponse.error.message ||
                      'Failed to check existing Intervals library folders'
                  );
                  return;
                }

                if (existingFolderResponse.data) {
                  conflicts.push(existingFolderResponse.data);
                }
              }

              if (conflicts.length > 0) {
                setExistingPlanBatchConflicts(
                  isLibraryBatchScope ? conflicts : []
                );
                setExistingPlanConflict(
                  isLibraryBatchScope ? null : (conflicts[0] ?? null)
                );
                setPendingIntervalsPlanConfig(config);
                return;
              }
            } finally {
              setIsCheckingExistingPlan(false);
            }
          }
        }

        await proceedWithIntervalsExport(config);
      } catch (error) {
        logger.error('Failed to get Intervals.icu API key:', error);
      } finally {
        setIsCheckingExistingPlan(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={isExporting || isCheckingExistingPlan ? undefined : onClose}
    >
      <div
        ref={dialogScrollRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isTrainingPlansBatchScope
                ? 'Export Training Plans'
                : isLibraryBatchScope
                  ? 'Export Libraries'
                  : isTrainingPlanScope
                    ? 'Export Training Plan'
                    : 'Export Workouts'}
            </h2>
            <button
              onClick={onClose}
              disabled={isExporting || isCheckingExistingPlan}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-6 h-6"
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
          <p className="mt-1 text-sm text-gray-600">
            {isLibraryBatchScope ? (
              <>
                Exporting {libraryCount || 0} selected librar
                {(libraryCount || 0) === 1 ? 'y' : 'ies'}
              </>
            ) : (
              <>
                Exporting {itemCount} workout{itemCount !== 1 ? 's' : ''}{' '}
              </>
            )}
            {isTrainingPlansBatchScope
              ? `from ${trainingPlanCount || 0} selected plan${trainingPlanCount === 1 ? '' : 's'}`
              : isTrainingPlanScope
                ? 'from this plan'
                : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {showDetailedExportProgress && trainingPlanExportProgress && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {trainingPlanExportProgress.currentPhaseLabel}
                    </p>
                    {trainingPlanExportProgress.message && (
                      <p className="text-xs text-blue-800 mt-1">
                        {trainingPlanExportProgress.message}
                      </p>
                    )}
                    {trainingPlanExportProgress.currentItemName && (
                      <p className="text-xs text-blue-700 mt-1 truncate">
                        {trainingPlanExportProgress.currentItemName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-900">
                      {trainingPlanExportProgress.overallCurrent}/
                      {trainingPlanExportProgress.overallTotal}
                    </p>
                    <p className="text-xs text-blue-700">overall</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{
                        width: `${
                          trainingPlanExportProgress.overallTotal > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (trainingPlanExportProgress.overallCurrent /
                                    trainingPlanExportProgress.overallTotal) *
                                    100
                                )
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-blue-800">
                    Current phase:{' '}
                    {trainingPlanExportProgress.currentPhaseCurrent}/
                    {trainingPlanExportProgress.currentPhaseTotal}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Export Progress
                </h3>
                <div className="space-y-2">
                  {trainingPlanExportProgress.phases.map((phase) => (
                    <div
                      key={phase.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            phase.status === 'completed'
                              ? 'bg-green-500'
                              : phase.status === 'failed'
                                ? 'bg-red-500'
                                : phase.status === 'started' ||
                                    phase.status === 'progress'
                                  ? 'bg-blue-500'
                                  : 'bg-gray-300'
                          }`}
                        />
                        <span className="text-gray-700 truncate">
                          {phase.label}
                        </span>
                        {phase.itemName && (
                          <span className="text-gray-400 truncate">
                            {phase.itemName}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-600 tabular-nums">
                        {phase.current}/{phase.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {showGenericExportProgress && (
            <div className="py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-center w-full max-w-xs">
                  <p className="text-sm font-medium text-gray-900">
                    {exportStatusMessage || 'Exporting...'}
                  </p>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, exportProgressPercent ?? 0)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {Math.max(
                      0,
                      Math.min(100, Math.round(exportProgressPercent ?? 0))
                    )}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}

          {!showDetailedExportProgress && !showGenericExportProgress && (
            <>
              {existingPlanConflictError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm font-medium text-red-900">
                    Unable to validate existing Intervals plan
                  </p>
                  <p className="text-xs text-red-800 mt-1">
                    {existingPlanConflictError}
                  </p>
                </div>
              )}

              {isWaitingForConflictDecision && existingPlanConflict && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm font-medium text-amber-900">
                    {isLibraryLikeScope
                      ? 'Library folder already exists in Intervals.icu'
                      : 'Training plan already exists in Intervals.icu'}
                  </p>
                  <p className="text-xs text-amber-900 mt-1">
                    Found existing{' '}
                    {isLibraryLikeScope ? 'library folder' : 'plan folder'} "{' '}
                    {existingPlanConflict.name}" (ID: {existingPlanConflict.id}
                    ).
                  </p>
                  <p className="text-xs text-amber-800 mt-2">
                    Choose how to continue:
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleExistingPlanConflictAction('replace')
                      }
                      className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                    >
                      {isLibraryLikeScope
                        ? 'Replace Existing Folder'
                        : 'Replace Existing Plan'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleExistingPlanConflictAction('append')
                      }
                      className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                      {isLibraryLikeScope
                        ? 'Append to Existing Folder (may duplicate workouts)'
                        : 'Append to Existing Plan (may duplicate workouts)'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleExistingPlanConflictAction('ignore')
                      }
                      className="px-3 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300"
                    >
                      Ignore Upload
                    </button>
                  </div>
                </div>
              )}

              {isWaitingForConflictDecision &&
                existingPlanBatchConflicts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-sm font-medium text-amber-900">
                      {isLibraryBatchScope
                        ? 'Some selected libraries already exist in Intervals.icu'
                        : 'Some selected training plans already exist in Intervals.icu'}
                    </p>
                    <p className="text-xs text-amber-900 mt-1">
                      Found {existingPlanBatchConflicts.length} existing{' '}
                      {isLibraryBatchScope ? 'library folder' : 'plan folder'}
                      {existingPlanBatchConflicts.length === 1 ? '' : 's'} with
                      the same name as selected TrainingPeaks{' '}
                      {isLibraryBatchScope ? 'libraries' : 'plans'}.
                    </p>
                    <div className="mt-2 bg-white/70 border border-amber-200 rounded p-2 max-h-32 overflow-y-auto">
                      <ul className="text-xs text-amber-900 space-y-1">
                        {existingPlanBatchConflicts
                          .slice(0, 8)
                          .map((folder) => (
                            <li key={folder.id}>
                              • {folder.name} (ID: {folder.id})
                            </li>
                          ))}
                        {existingPlanBatchConflicts.length > 8 && (
                          <li>
                            • ... and {existingPlanBatchConflicts.length - 8}{' '}
                            more
                          </li>
                        )}
                      </ul>
                    </div>
                    <p className="text-xs text-amber-800 mt-2">
                      Choose how to handle all duplicates in this batch:
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleExistingPlanConflictAction('replace')
                        }
                        className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                      >
                        {isLibraryBatchScope
                          ? 'Replace Existing Folders'
                          : 'Replace Existing Plans'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleExistingPlanConflictAction('append')
                        }
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                      >
                        {isLibraryBatchScope
                          ? 'Append to Existing Folders (may duplicate workouts)'
                          : 'Append to Existing Plans (may duplicate workouts)'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleExistingPlanConflictAction('ignore')
                        }
                        className="px-3 py-2 rounded-md bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300"
                      >
                        Ignore Upload
                      </button>
                    </div>
                  </div>
                )}

              {/* Destination Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Destination
                </label>
                <div className="space-y-2">
                  {EXPORT_DESTINATIONS.map((dest) => (
                    <label
                      key={dest.id}
                      className={`flex items-start gap-3 p-3 border rounded-md transition-colors ${
                        dest.available
                          ? 'cursor-pointer hover:bg-gray-50'
                          : 'cursor-not-allowed bg-gray-50 opacity-60'
                      } ${
                        destination === dest.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="destination"
                        value={dest.id}
                        checked={destination === dest.id}
                        onChange={(e) =>
                          setDestination(e.target.value as ExportDestination)
                        }
                        disabled={!dest.available}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {dest.name}
                          </p>
                          {!dest.available && (
                            <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {dest.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* File Name (PlanMyPeak only) */}
              {destination === 'planmypeak' && (
                <div>
                  {isLibraryBatchScope && (
                    <div className="mb-3 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Export Strategy
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                          <input
                            type="radio"
                            name="libraryBatchStrategy"
                            value="separate"
                            checked={libraryBatchStrategy === 'separate'}
                            onChange={() =>
                              onLibraryBatchStrategyChange?.('separate')
                            }
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Separate Files
                            </p>
                            <p className="text-xs text-gray-600">
                              One JSON file per selected library
                            </p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                          <input
                            type="radio"
                            name="libraryBatchStrategy"
                            value="combined"
                            checked={libraryBatchStrategy === 'combined'}
                            onChange={() =>
                              onLibraryBatchStrategyChange?.('combined')
                            }
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Combined File
                            </p>
                            <p className="text-xs text-gray-600">
                              Merge all selected library workouts into one JSON
                              file
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  <label
                    htmlFor="fileName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {isLibraryBatchScope && libraryBatchStrategy === 'separate'
                      ? 'File Name Prefix'
                      : 'File Name'}
                  </label>
                  <input
                    id="fileName"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="planmypeak_export"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {isLibraryBatchScope && libraryBatchStrategy === 'separate'
                      ? 'Each library file will use the library name (prefix is optional)'
                      : `File will be saved as ${fileName}.json`}
                  </p>
                </div>
              )}

              {/* Library folder option (Intervals.icu library export only) */}
              {destination === 'intervalsicu' && !isTrainingPlanLikeScope && (
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={createFolder}
                      onChange={(e) => setCreateFolder(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Create folder in Intervals.icu library
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {isLibraryBatchScope
                      ? 'Each selected TrainingPeaks library will be uploaded as workout templates and organized in a matching Intervals.icu folder (no dates assigned).'
                      : 'Workouts will be organized in a folder named "TrainingPeaks Library" and saved as templates (no dates assigned)'}
                  </p>
                </div>
              )}
              {destination === 'intervalsicu' && isTrainingPlanLikeScope && (
                <div>
                  <p className="text-xs text-gray-500">
                    {isTrainingPlansBatchScope
                      ? 'Creates reusable Intervals.icu training plans (`PLAN` folders) using each TrainingPeaks plan name and plan-day offsets.'
                      : 'Creates a reusable Intervals.icu training plan (`PLAN` folder) using the TrainingPeaks plan name and day offsets.'}
                  </p>
                </div>
              )}

              {/* API Key Warning (Intervals.icu only) */}
              {destination === 'intervalsicu' && !hasIntervalsApiKey && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">API Key Required</p>
                      <p className="text-xs">
                        You need to configure your Intervals.icu API key before
                        exporting. Please set it up in the banner above.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info Box - Destination specific */}
              {destination === 'planmypeak' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">
                        Automatic Classification
                      </p>
                      <p className="text-xs">
                        {isTrainingPlanScope
                          ? 'Downloads a JSON snapshot of the current TrainingPeaks plan data shown in the calendar view (classic workouts, RxBuilder workouts, notes, and events).'
                          : isTrainingPlansBatchScope
                            ? 'Downloads a JSON snapshot for each selected TrainingPeaks plan (classic workouts, RxBuilder workouts, notes, and events) in a single export file.'
                            : isLibraryBatchScope
                              ? libraryBatchStrategy === 'combined'
                                ? 'Downloads one combined PlanMyPeak JSON file containing workouts from all selected TrainingPeaks libraries.'
                                : 'Downloads one PlanMyPeak JSON file per selected TrainingPeaks library.'
                              : 'Each workout will be automatically classified based on its Intensity Factor (IF) and TSS values. Workout type, intensity level, and suitable training phases are determined individually for each workout.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {destination === 'intervalsicu' && hasIntervalsApiKey && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">
                        Direct Upload to Library
                      </p>
                      <p className="text-xs">
                        {isTrainingPlanScope
                          ? 'Classic workouts from this TrainingPeaks plan will be uploaded into a reusable Intervals.icu training plan (PLAN folder) with plan-day scheduling preserved.'
                          : isTrainingPlansBatchScope
                            ? 'Selected TrainingPeaks plans will be uploaded into reusable Intervals.icu training plans (PLAN folders) with plan-day scheduling preserved for each plan.'
                            : isLibraryBatchScope
                              ? 'Selected TrainingPeaks libraries will be uploaded to Intervals.icu as workout templates, preserving library-specific folder organization if enabled.'
                              : 'Workouts will be uploaded directly to your Intervals.icu workout library as templates. All metadata (TSS, duration, description, coach notes) will be preserved. You can schedule workouts from your library later.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  What will be exported?
                </h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>
                      {isLibraryBatchScope ? (
                        <>
                          All workouts from {libraryCount || 0} selected librar
                          {(libraryCount || 0) === 1 ? 'y' : 'ies'}
                        </>
                      ) : (
                        <>
                          All {itemCount} workout{itemCount !== 1 ? 's' : ''}{' '}
                          from this{' '}
                        </>
                      )}
                      {!isLibraryBatchScope &&
                        (isTrainingPlansBatchScope
                          ? `set of ${trainingPlanCount || 0} selected plans`
                          : isTrainingPlanScope
                            ? 'plan'
                            : 'library')}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>
                      Workout structure and intervals
                      {isTrainingPlanLikeScope
                        ? ' (classic workouts only)'
                        : ''}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Training metrics (TSS, IF, duration)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Descriptions and coach comments</span>
                  </li>
                </ul>
              </div>

              {/* Authorization Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 mb-2">
                      Authorization Required
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAcknowledged}
                        onChange={(e) => setHasAcknowledged(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-amber-900">
                        I confirm that I am the owner of this content or have
                        been authorized by the owner to export it
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExporting || isCheckingExistingPlan}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={
              isExporting ||
              isCheckingExistingPlan ||
              isWaitingForConflictDecision ||
              (destination === 'planmypeak' && !fileName.trim()) ||
              (destination === 'intervalsicu' && !hasIntervalsApiKey) ||
              !hasAcknowledged ||
              !selectedDestination?.available
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting || isCheckingExistingPlan ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>
                  {isCheckingExistingPlan ? 'Checking...' : 'Exporting...'}
                </span>
              </>
            ) : (
              <span>Export</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

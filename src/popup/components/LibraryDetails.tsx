import type { ReactElement } from 'react';
import { useState } from 'react';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { useExport } from '@/hooks/useExport';
import type { LibraryItem } from '@/types/api.types';
import { LibraryHeader } from './LibraryHeader';
import { WorkoutCard } from './WorkoutCard';
import { WorkoutGrid } from './WorkoutGrid';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import {
  ExportButton,
  ExportDialog,
  ExportResult,
  getExportResultKey,
} from './export';
import { logger } from '@/utils/logger';
import { downloadJsonFile } from '@/utils/downloadJson';

export interface LibraryDetailsProps {
  libraryId: number;
  libraryName: string;
  onBack: () => void;
}

function formatDuration(hours: number | null): string {
  if (hours === null) return 'N/A';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  return `${wholeHours}h ${minutes}m`;
}

function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A';
  return `${(meters / 1000).toFixed(1)} km`;
}

interface WorkoutDetailsModalProps {
  workout: LibraryItem;
  onClose: () => void;
}

function WorkoutDetailsModal({
  workout,
  onClose,
}: WorkoutDetailsModalProps): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {workout.itemName}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Workout details from TrainingPeaks library
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close workout details"
          >
            <svg
              className="h-5 w-5"
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

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Duration
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {formatDuration(workout.totalTimePlanned)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Distance
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {formatDistance(workout.distancePlanned)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                TSS
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {workout.tssPlanned ?? 'N/A'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                IF
              </p>
              <p className="mt-1 font-semibold text-gray-900">
                {workout.ifPlanned !== null
                  ? workout.ifPlanned.toFixed(2)
                  : 'N/A'}
              </p>
            </div>
          </div>

          {workout.description && workout.description.trim() && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Description
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {workout.description}
              </p>
            </div>
          )}

          {workout.coachComments && workout.coachComments.trim() && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Coach Comments
              </h3>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                {workout.coachComments}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Elevation
              </p>
              <p className="mt-1 text-gray-800">
                {workout.elevationGainPlanned !== null
                  ? `${workout.elevationGainPlanned} m`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Calories
              </p>
              <p className="mt-1 text-gray-800">
                {workout.caloriesPlanned ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LibraryDetails component displays the workouts within a selected library
 *
 * Features:
 * - Library header with back navigation and workout count
 * - Grid of workout cards
 * - Loading state with spinner
 * - Error state with retry functionality
 * - Empty state when no workouts exist
 *
 * @param props.libraryId - ID of the library to display
 * @param props.libraryName - Name of the library (passed from parent)
 * @param props.onBack - Callback to return to library list
 *
 * @example
 * ```tsx
 * {selectedLibraryId && (
 *   <LibraryDetails
 *     libraryId={selectedLibraryId}
 *     libraryName={selectedLibraryName}
 *     onBack={() => setSelectedLibraryId(null)}
 *   />
 * )}
 * ```
 */
export function LibraryDetails({
  libraryId,
  libraryName,
  onBack,
}: LibraryDetailsProps): ReactElement {
  const [selectedWorkout, setSelectedWorkout] = useState<LibraryItem | null>(
    null
  );
  const {
    data: workouts = [],
    isLoading,
    error,
    refetch,
  } = useLibraryItems(libraryId);
  const {
    isDialogOpen,
    isExporting,
    exportResult,
    progress,
    statusMessage,
    detailedProgress,
    openDialog,
    closeDialog,
    executeExport,
    closeResult,
  } = useExport(workouts);

  // Get workout count (0 if loading or error)
  const workoutCount = workouts.length;
  const hasWorkouts = !isLoading && !error && workoutCount > 0;

  const handleWorkoutClick = (workoutId: number): void => {
    const workout = workouts.find(
      (candidate) => candidate.exerciseLibraryItemId === workoutId
    );

    if (workout) {
      setSelectedWorkout(workout);
    }
  };

  const handleDownload = (): void => {
    const exportDate = new Date();
    const exportDateIso = exportDate.toISOString();
    const fileName = `training-library-${libraryId}-${
      exportDateIso.split('T')[0]
    }.json`;
    const libraryData = {
      libraryId,
      libraryName,
      exportDate: exportDateIso,
      workouts,
      summary: {
        totalWorkouts: workoutCount,
      },
    };

    downloadJsonFile(libraryData, fileName);
    logger.info('📥 Library downloaded:', fileName);
  };

  return (
    <div className="mt-4">
      {/* Header always visible */}
      <LibraryHeader
        libraryName={libraryName}
        workoutCount={workoutCount}
        onBack={onBack}
        actions={
          hasWorkouts ? (
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 text-gray-600 hover:text-gray-800"
              title="Download library as JSON"
              aria-label="Download library as JSON"
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
            </button>
          ) : undefined
        }
      />

      {/* Export Button - shown when workouts are available */}
      {hasWorkouts && (
        <div className="px-4 mb-4">
          <ExportButton
            onClick={openDialog}
            disabled={isExporting}
            itemCount={workoutCount}
            variant="secondary"
            fullWidth
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-800">
              Failed to Load Workouts
            </p>
            <p className="mt-1 text-xs text-red-600">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && workoutCount === 0 && (
        <EmptyState
          title="No Workouts Found"
          message="This library is empty."
        />
      )}

      {/* Success State - Workout Grid */}
      {hasWorkouts && (
        <WorkoutGrid>
          {workouts.map((workout) => (
            <WorkoutCard
              key={workout.exerciseLibraryItemId}
              workout={workout}
              onClick={handleWorkoutClick}
            />
          ))}
        </WorkoutGrid>
      )}

      {/* Export Dialog */}
      <ExportDialog
        key={isDialogOpen ? 'open' : 'closed'}
        isOpen={isDialogOpen}
        onClose={closeDialog}
        onExport={executeExport}
        itemCount={workoutCount}
        isExporting={isExporting}
        exportProgressPercent={progress}
        exportStatusMessage={statusMessage}
        trainingPlanExportProgress={detailedProgress || undefined}
        sourceLibraryName={libraryName}
      />

      {/* Export Result */}
      {exportResult && (
        <ExportResult
          key={getExportResultKey(exportResult)}
          result={exportResult}
          onClose={closeResult}
        />
      )}

      {selectedWorkout && (
        <WorkoutDetailsModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  );
}

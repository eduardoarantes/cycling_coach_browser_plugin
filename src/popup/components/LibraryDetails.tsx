import type { ReactElement } from 'react';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { useExport } from '@/hooks/useExport';
import { LibraryHeader } from './LibraryHeader';
import { WorkoutCard } from './WorkoutCard';
import { WorkoutGrid } from './WorkoutGrid';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { ExportButton, ExportDialog, ExportResult } from './export';
import { logger } from '@/utils/logger';
import { downloadJsonFile } from '@/utils/downloadJson';

export interface LibraryDetailsProps {
  libraryId: number;
  libraryName: string;
  onBack: () => void;
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

  // Workout click handler (placeholder for future implementation)
  const handleWorkoutClick = (workoutId: number): void => {
    // TODO: Navigate to workout details (Phase 4.4 or later)
    console.log('Workout clicked:', workoutId);
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
        <ExportResult result={exportResult} onClose={closeResult} />
      )}
    </div>
  );
}

import { useState, useMemo, type ReactElement } from 'react';
import { useLibraries } from '@/hooks/useLibraries';
import { useMultiLibraryExport } from '@/hooks/useMultiLibraryExport';
import { LibraryCard } from './LibraryCard';
import { LibraryGrid } from './LibraryGrid';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { MultiLibraryExportDialog, ExportResult } from './export';
import type { MultiLibraryExportConfig } from '@/hooks/useMultiLibraryExport';
import {
  is401Error,
  is403Error,
  getUserFriendlyErrorMessage,
  openTrainingPeaksTab,
} from '@/utils/trainingPeaksTab';

export interface LibraryListProps {
  onSelectLibrary: (libraryId: number) => void;
}

export function LibraryList({
  onSelectLibrary,
}: LibraryListProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<number>>(
    new Set()
  );
  const { data: libraries, isLoading, error, refetch } = useLibraries();

  const {
    isDialogOpen,
    isExporting,
    exportResults,
    progress,
    statusMessage,
    openDialog,
    closeDialog,
    executeExport,
    closeResults,
  } = useMultiLibraryExport();

  // Filter libraries based on search query
  const filteredLibraries = useMemo(() => {
    if (!libraries) return [];
    if (!searchQuery) return libraries;

    const query = searchQuery.toLowerCase();
    return libraries.filter(
      (lib) =>
        lib.libraryName.toLowerCase().includes(query) ||
        lib.ownerName.toLowerCase().includes(query)
    );
  }, [libraries, searchQuery]);

  // Selection handlers
  const handleSelectionChange = (
    libraryId: number,
    selected: boolean
  ): void => {
    setSelectedLibraryIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(libraryId);
      } else {
        newSet.delete(libraryId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (): void => {
    const allIds = new Set(
      filteredLibraries.map((lib) => lib.exerciseLibraryId)
    );
    setSelectedLibraryIds(allIds);
  };

  const handleClearSelection = (): void => {
    setSelectedLibraryIds(new Set());
  };

  const handleExitSelectionMode = (): void => {
    setSelectionMode(false);
    setSelectedLibraryIds(new Set());
  };

  const handleEnterSelectionMode = (): void => {
    setSelectionMode(true);
  };

  const handleExportSelected = (): void => {
    openDialog();
  };

  const handleExecuteExport = (config: MultiLibraryExportConfig): void => {
    if (!libraries) return;

    const selectedLibraries = libraries.filter((lib) =>
      selectedLibraryIds.has(lib.exerciseLibraryId)
    );

    executeExport(Array.from(selectedLibraryIds), selectedLibraries, config);
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

  // Empty state (no libraries at all)
  if (!libraries || libraries.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="No Libraries Found"
          message="You don't have any workout libraries yet."
        />
      </div>
    );
  }

  // No search results state
  if (filteredLibraries.length === 0) {
    return (
      <div className="mt-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="mt-4">
          <EmptyState
            title="No Libraries Found"
            message={`No libraries match "${searchQuery}"`}
          />
        </div>
      </div>
    );
  }

  // Success state with libraries
  return (
    <div className="mt-4">
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Selection Mode Toolbar */}
      {selectionMode ? (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-900">
                {selectedLibraryIds.size} selected
              </span>
              <div className="h-4 w-px bg-blue-300"></div>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
              >
                Select All ({filteredLibraries.length})
              </button>
              {selectedLibraryIds.size > 0 && (
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
              disabled={selectedLibraryIds.size === 0}
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
              {selectedLibraryIds.size > 0 ? `${selectedLibraryIds.size} ` : ''}
              {selectedLibraryIds.size === 1 ? 'Library' : 'Libraries'}
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
            Export Multiple Libraries
          </button>
        </div>
      )}

      <div className="mt-4">
        <LibraryGrid>
          {filteredLibraries.map((lib) => (
            <LibraryCard
              key={lib.exerciseLibraryId}
              library={lib}
              onClick={onSelectLibrary}
              selectionMode={selectionMode}
              isSelected={selectedLibraryIds.has(lib.exerciseLibraryId)}
              onSelectionChange={handleSelectionChange}
            />
          ))}
        </LibraryGrid>
      </div>

      {/* Multi-Library Export Dialog */}
      {libraries && (
        <MultiLibraryExportDialog
          key={isDialogOpen ? 'open' : 'closed'}
          isOpen={isDialogOpen}
          onClose={closeDialog}
          onExport={handleExecuteExport}
          libraries={libraries.filter((lib) =>
            selectedLibraryIds.has(lib.exerciseLibraryId)
          )}
          isExporting={isExporting}
          progress={progress}
          statusMessage={statusMessage}
        />
      )}

      {/* Export Results */}
      {exportResults.map((result, index) => (
        <ExportResult
          key={index}
          result={result}
          onClose={index === exportResults.length - 1 ? closeResults : () => {}}
        />
      ))}
    </div>
  );
}

import { useState, useMemo, type ReactElement } from 'react';
import { useLibraries } from '@/hooks/useLibraries';
import { LibraryCard } from './LibraryCard';
import { LibraryGrid } from './LibraryGrid';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { is401Error, openTrainingPeaksTab } from '@/utils/trainingPeaksTab';

export interface LibraryListProps {
  onSelectLibrary: (libraryId: number) => void;
}

export function LibraryList({
  onSelectLibrary,
}: LibraryListProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: libraries, isLoading, error, refetch } = useLibraries();

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
          <p className="mt-1 text-xs text-red-600">{error.message}</p>
          {isAuthError && (
            <p className="mt-2 text-xs text-red-500">
              Opening TrainingPeaks to refresh your authentication...
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
      <div className="mt-4">
        <LibraryGrid>
          {filteredLibraries.map((lib) => (
            <LibraryCard
              key={lib.exerciseLibraryId}
              library={lib}
              onClick={onSelectLibrary}
            />
          ))}
        </LibraryGrid>
      </div>
    </div>
  );
}

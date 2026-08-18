/**
 * Browse and select TrainingPeaks workout libraries and the workouts inside
 * them. Workouts for a library are fetched only when the coach opens it.
 */

import { useEffect, useRef, type ReactElement } from 'react';
import { useLibraries } from '@/hooks/useLibraries';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import type { Library } from '@/types/api.types';
import type { LibraryItem } from '@/schemas/library.schema';
import { isSupportedTpWorkoutTypeForPlanMyPeak } from '@/export/adapters/planMyPeak/workoutMapping';
import {
  isLibrarySelected,
  isWorkoutSelected,
  type OverlaySelection,
} from '../selection';
import { EmptyState, ErrorState, LoadingState } from './StateMessages';

export interface LibraryBrowserProps {
  enabled: boolean;
  /** Library the page asked to pre-select when opening the overlay */
  preselectedLibraryId: number | null;
  selection: OverlaySelection;
  expandedLibraryId: number | null;
  onExpand: (libraryId: number | null) => void;
  onToggleLibrary: (library: Library) => void;
  onToggleWorkout: (
    library: Library,
    workoutId: number,
    loadedItems: LibraryItem[]
  ) => void;
  onItemsLoaded: (libraryId: number, items: LibraryItem[]) => void;
}

function LibraryWorkouts({
  library,
  selection,
  onToggleWorkout,
  onItemsLoaded,
}: {
  library: Library;
  selection: OverlaySelection;
  onToggleWorkout: LibraryBrowserProps['onToggleWorkout'];
  onItemsLoaded: LibraryBrowserProps['onItemsLoaded'];
}): ReactElement {
  const {
    data: items,
    isLoading,
    error,
    refetch,
  } = useLibraryItems(library.exerciseLibraryId);

  // Report loaded items upward so selection can be narrowed from "whole
  // library" to an explicit set, and so the import knows what it covers.
  useEffect(() => {
    if (items) {
      onItemsLoaded(library.exerciseLibraryId, items);
    }
  }, [items, library.exerciseLibraryId, onItemsLoaded]);

  if (isLoading) {
    return <LoadingState label="Loading workouts…" />;
  }

  if (error) {
    return (
      <ErrorState
        message={`Could not load workouts: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!items || items.length === 0) {
    return <EmptyState label="This library has no workouts." />;
  }

  return (
    <div className="border-t border-gray-200">
      <p className="px-3 pt-2 text-xs text-gray-500">
        {items.length} workout{items.length === 1 ? '' : 's'}
      </p>
      <ul className="max-h-56 overflow-y-auto px-1 py-1">
        {items.map((item) => {
          const supported = isSupportedTpWorkoutTypeForPlanMyPeak(
            item.workoutTypeId
          );
          return (
            <li key={item.exerciseLibraryItemId}>
              <label className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={isWorkoutSelected(
                    selection,
                    library.exerciseLibraryId,
                    item.exerciseLibraryItemId
                  )}
                  onChange={() =>
                    onToggleWorkout(library, item.exerciseLibraryItemId, items)
                  }
                  aria-label={`Select workout ${item.itemName}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-gray-800">
                    {item.itemName}
                  </span>
                  {!supported ? (
                    <span className="block text-xs text-amber-700">
                      Not supported by PlanMyPeak — will be skipped
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LibraryBrowser({
  enabled,
  preselectedLibraryId,
  selection,
  expandedLibraryId,
  onExpand,
  onToggleLibrary,
  onToggleWorkout,
  onItemsLoaded,
}: LibraryBrowserProps): ReactElement {
  const {
    data: libraries,
    isLoading,
    error,
    refetch,
  } = useLibraries({ enabled });

  // Apply the page's pre-selection once, as soon as the named library is known.
  const preselectApplied = useRef(false);
  useEffect(() => {
    if (preselectApplied.current) return;
    if (preselectedLibraryId === null || !libraries) return;

    const match = libraries.find(
      (library) => library.exerciseLibraryId === preselectedLibraryId
    );
    if (!match) return;

    preselectApplied.current = true;
    if (!isLibrarySelected(selection, preselectedLibraryId)) {
      onToggleLibrary(match);
    }
  }, [libraries, preselectedLibraryId, selection, onToggleLibrary]);

  if (isLoading) {
    return <LoadingState label="Loading libraries…" />;
  }

  if (error) {
    return (
      <ErrorState
        message={`Could not load libraries: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!libraries || libraries.length === 0) {
    return <EmptyState label="No TrainingPeaks workout libraries found." />;
  }

  return (
    <ul className="space-y-2">
      {libraries.map((library) => {
        const isExpanded = expandedLibraryId === library.exerciseLibraryId;

        return (
          <li
            key={library.exerciseLibraryId}
            className="rounded-lg border border-gray-200 bg-white"
          >
            <div className="flex items-center gap-2 p-3">
              <input
                type="checkbox"
                checked={isLibrarySelected(
                  selection,
                  library.exerciseLibraryId
                )}
                onChange={() => onToggleLibrary(library)}
                aria-label={`Select library ${library.libraryName}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">
                  {library.libraryName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  by {library.ownerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onExpand(isExpanded ? null : library.exerciseLibraryId)
                }
                aria-expanded={isExpanded}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {isExpanded ? 'Hide workouts' : 'View workouts'}
              </button>
            </div>

            {isExpanded ? (
              <LibraryWorkouts
                library={library}
                selection={selection}
                onToggleWorkout={onToggleWorkout}
                onItemsLoaded={onItemsLoaded}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

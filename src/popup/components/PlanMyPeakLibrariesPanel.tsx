import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  useCreatePlanMyPeakLibrary,
  usePlanMyPeakLibraries,
} from '@/hooks/usePlanMyPeakLibraries';

interface PlanMyPeakLibrariesPanelProps {
  defaultExpanded?: boolean;
}

export function PlanMyPeakLibrariesPanel({
  defaultExpanded = false,
}: PlanMyPeakLibrariesPanelProps = {}): ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const {
    data: libraries,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePlanMyPeakLibraries({ enabled: expanded });

  const createLibraryMutation = useCreatePlanMyPeakLibrary();

  const handleCreateLibrary = async (): Promise<void> => {
    const trimmed = newLibraryName.trim();
    if (!trimmed) {
      setLocalMessage('Library name is required');
      return;
    }

    setLocalMessage(null);

    try {
      const created = await createLibraryMutation.mutateAsync(trimmed);
      setNewLibraryName('');
      setLocalMessage(`Created "${created.name}"`);
    } catch (err) {
      setLocalMessage(
        err instanceof Error ? err.message : 'Failed to create library'
      );
    }
  };

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => {
          setExpanded((prev) => !prev);
          setLocalMessage(null);
        }}
        className="w-full p-3 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-100 hover:from-emerald-100 hover:to-teal-200 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">📚</span>
          <span className="text-sm font-semibold text-gray-800 truncate">
            PlanMyPeak Workout Libraries
          </span>
          {libraries ? (
            <span className="px-2 py-0.5 text-xs bg-white/80 text-gray-700 rounded-full font-medium">
              {libraries.length}
            </span>
          ) : null}
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newLibraryName}
              onChange={(e) => {
                setNewLibraryName(e.target.value);
                if (localMessage) setLocalMessage(null);
              }}
              placeholder="New library name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              disabled={createLibraryMutation.isPending}
              maxLength={100}
            />
            <button
              onClick={() => {
                void handleCreateLibrary();
              }}
              disabled={
                createLibraryMutation.isPending || !newLibraryName.trim()
              }
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              type="button"
            >
              {createLibraryMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">
              Available Libraries
            </p>
            <button
              onClick={() => {
                void refetch();
              }}
              disabled={isFetching}
              className="text-xs text-emerald-700 hover:text-emerald-900 disabled:text-gray-400"
              type="button"
            >
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
            {isLoading ? (
              <div className="p-3 text-sm text-gray-500">
                Loading libraries...
              </div>
            ) : isError ? (
              <div className="p-3 text-sm text-red-700">
                {error?.message || 'Failed to load libraries'}
              </div>
            ) : !libraries || libraries.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                No libraries found
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {libraries.map((library) => (
                  <li
                    key={library.id}
                    className="px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {library.name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {library.id}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {library.is_system ? (
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full">
                          System
                        </span>
                      ) : null}
                      {library.is_default ? (
                        <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full">
                          Default
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {localMessage ? (
            <div
              className={`mt-3 p-2 rounded-lg border text-sm ${
                localMessage.startsWith('Created')
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {localMessage}
            </div>
          ) : null}

          {!isError ? (
            <p className="mt-2 text-[11px] text-gray-500">
              Creates libraries in PlanMyPeak (`/workouts/libraries/`). Workout
              upload comes next.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

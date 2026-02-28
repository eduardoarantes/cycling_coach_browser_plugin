import type { ReactElement } from 'react';

export interface LibraryHeaderProps {
  libraryName: string;
  workoutCount: number;
  onBack: () => void;
  actions?: ReactElement;
}

/**
 * LibraryHeader component displays library name, workout count, and back navigation
 *
 * Features:
 * - Back button to return to library list
 * - Library name (truncated if too long)
 * - Workout count with proper pluralization
 *
 * @param props.libraryName - Name of the library being displayed
 * @param props.workoutCount - Number of workouts in the library
 * @param props.onBack - Callback when back button is clicked
 *
 * @example
 * ```tsx
 * <LibraryHeader
 *   libraryName="My Training Library"
 *   workoutCount={15}
 *   onBack={() => setSelectedLibrary(null)}
 * />
 * ```
 */
export function LibraryHeader({
  libraryName,
  workoutCount,
  onBack,
  actions,
}: LibraryHeaderProps): ReactElement {
  const workoutLabel = workoutCount === 1 ? 'workout' : 'workouts';

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        aria-label="Back to library list"
      >
        <span className="text-xl">←</span>
      </button>

      {/* Library Info */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-gray-800 truncate">
          {libraryName}
        </h2>
        <p className="text-sm text-gray-600">
          {workoutCount} {workoutLabel}
        </p>
      </div>

      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

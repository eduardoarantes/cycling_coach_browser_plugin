import type { ReactElement } from 'react';
import type { LibraryItem } from '@/types/api.types';

export interface WorkoutCardProps {
  workout: LibraryItem;
  onClick: (workoutId: number) => void;
}

/**
 * Format duration from hours (decimal) to "Xh Ym" format
 * Returns "N/A" if duration is null (e.g., for swim workouts)
 * Note: TrainingPeaks API returns duration as decimal hours, not seconds
 */
function formatDuration(hours: number | null): string {
  if (hours === null) return 'N/A';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes}m`;
  }
  return `${wholeHours}h ${minutes}m`;
}

/**
 * Format distance from meters to kilometers
 * Returns "N/A" if distance is null
 */
function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A';
  const km = meters / 1000;
  return `${km.toFixed(0)} km`;
}

/**
 * WorkoutCard component displays a single workout from a library
 *
 * Shows workout metadata including:
 * - Name and duration
 * - Training metrics (TSS, IF, distance, elevation)
 * - Description (truncated to 2 lines)
 * - Coach comments (if available)
 *
 * @param props.workout - The workout item to display
 * @param props.onClick - Callback when card is clicked, receives workoutId
 */
export function WorkoutCard({
  workout,
  onClick,
}: WorkoutCardProps): ReactElement {
  const duration = formatDuration(workout.totalTimePlanned);
  const ariaLabel = workout.tssPlanned
    ? `${workout.itemName}, ${duration}, TSS ${Math.round(workout.tssPlanned)}`
    : `${workout.itemName}, ${duration}`;

  return (
    <button
      onClick={() => onClick(workout.exerciseLibraryItemId)}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {/* Header: Name and Duration */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-800 flex-1">
          {workout.itemName}
        </h3>
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
          {duration}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {workout.tssPlanned !== null && (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            TSS {Math.round(workout.tssPlanned)}
          </span>
        )}
        {workout.ifPlanned !== null && (
          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
            IF {workout.ifPlanned.toFixed(2)}
          </span>
        )}
        {workout.distancePlanned !== null && (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
            {formatDistance(workout.distancePlanned)}
          </span>
        )}
        {workout.elevationGainPlanned !== null && (
          <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
            {workout.elevationGainPlanned} m
          </span>
        )}
      </div>

      {/* Description */}
      {workout.description && workout.description.trim() && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
          {workout.description}
        </p>
      )}

      {/* Coach Comments */}
      {workout.coachComments && workout.coachComments.trim() && (
        <div className="mt-3 p-2 bg-gray-50 rounded border-l-2 border-blue-400">
          <p className="text-xs font-medium text-gray-700 mb-1">Coach:</p>
          <p className="text-xs text-gray-600">{workout.coachComments}</p>
        </div>
      )}
    </button>
  );
}

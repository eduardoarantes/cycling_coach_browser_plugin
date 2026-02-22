/**
 * CalendarDayCell component
 *
 * Displays a single day cell with compact activity icons and hover tooltips
 */

import type { ReactElement } from 'react';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

export interface CalendarDayCellProps {
  dayOfWeek: number; // 0=Monday, 6=Sunday
  workouts: PlanWorkout[];
  notes: CalendarNote[];
  events: CalendarEvent[];
}

/**
 * Get activity icon emoji based on workout type
 */
function getWorkoutIcon(workoutTypeId: number): string {
  // Map workout type IDs to emojis
  const iconMap: Record<number, string> = {
    1: '🏊', // Swim
    2: '🚴', // Bike
    3: '🏃', // Run
    4: '🔀', // Brick
    5: '🏋️', // Crosstrain
    6: '🏁', // Race
    7: '😴', // Day Off
    8: '🚵', // Mountain Bike
    9: '💪', // Strength
    10: '⚙️', // Custom
    11: '⛷️', // XC-Ski
    12: '🚣', // Rowing
    13: '🚶', // Walk
    29: '💪', // Strength (duplicate)
    100: '🎯', // Other
  };

  return iconMap[workoutTypeId] || '🏃';
}

/**
 * Format duration from hours (decimal) to "Xh Ym" format
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
 */
function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * CalendarDayCell component displays workouts, notes, and events as compact icons
 */
export function CalendarDayCell({
  workouts,
  notes,
  events,
}: CalendarDayCellProps): ReactElement {
  const hasContent =
    workouts.length > 0 || notes.length > 0 || events.length > 0;

  return (
    <div className="border-r border-gray-300 last:border-r-0 p-1 min-h-24 bg-white">
      {!hasContent ? (
        <div className="text-xs text-gray-400 text-center py-2">-</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {/* Workouts */}
          {workouts.map((workout) => {
            const icon = getWorkoutIcon(workout.workoutTypeValueId);
            const tooltip = `${workout.title}
${formatDuration(workout.totalTimePlanned)} • ${formatDistance(workout.distancePlanned)}${workout.tssPlanned ? `\nTSS: ${workout.tssPlanned}` : ''}${workout.ifPlanned ? ` • IF: ${workout.ifPlanned.toFixed(2)}` : ''}`;

            return (
              <div
                key={workout.workoutId}
                className="flex items-center justify-center w-8 h-8 rounded bg-blue-100 hover:bg-blue-200 cursor-default text-lg"
                title={tooltip}
              >
                {icon}
              </div>
            );
          })}

          {/* Notes */}
          {notes.map((note) => {
            const tooltip = `📝 ${note.title}${note.description ? `\n${note.description}` : ''}`;

            return (
              <div
                key={note.id}
                className="flex items-center justify-center w-8 h-8 rounded bg-yellow-100 hover:bg-yellow-200 cursor-default text-lg"
                title={tooltip}
              >
                📝
              </div>
            );
          })}

          {/* Events */}
          {events.map((event) => {
            const tooltip = `🏁 ${event.name}
${event.eventType}${event.distance ? `\n${event.distance} ${event.distanceUnits || ''}` : ''}`;

            return (
              <div
                key={event.id}
                className="flex items-center justify-center w-8 h-8 rounded bg-green-100 hover:bg-green-200 cursor-default text-lg"
                title={tooltip}
              >
                🏁
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

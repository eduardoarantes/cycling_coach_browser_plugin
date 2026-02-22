/**
 * CalendarDayCell component
 *
 * Displays a single day cell in the training plan calendar with workouts, notes, and events
 */

import type { ReactElement } from 'react';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';
import { WorkoutCard } from './WorkoutCard';
import { NoteCard } from './NoteCard';
import { EventCard } from './EventCard';

export interface CalendarDayCellProps {
  dayOfWeek: number; // 0=Monday, 6=Sunday
  workouts: PlanWorkout[];
  notes: CalendarNote[];
  events: CalendarEvent[];
}

/**
 * Get day label from day of week number
 */
function getDayLabel(dayOfWeek: number): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return 'Invalid';
  }

  return days[dayOfWeek];
}

/**
 * Get full day name for accessibility
 */
function getFullDayName(dayOfWeek: number): string {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return 'Invalid day';
  }

  return days[dayOfWeek];
}

/**
 * CalendarDayCell component displays workouts, notes, and events for a single day
 *
 * @param props.dayOfWeek - Day of week (0=Monday, 6=Sunday)
 * @param props.workouts - Array of workouts for this day
 * @param props.notes - Array of notes for this day
 * @param props.events - Array of events for this day
 */
export function CalendarDayCell({
  dayOfWeek,
  workouts,
  notes,
  events,
}: CalendarDayCellProps): ReactElement {
  const dayLabel = getDayLabel(dayOfWeek);
  const fullDayName = getFullDayName(dayOfWeek);
  const totalItems = workouts.length + notes.length + events.length;

  const ariaLabel = `${fullDayName} - ${totalItems} item${totalItems !== 1 ? 's' : ''}`;

  return (
    <div
      className="border border-gray-300 p-2 min-h-32 flex flex-col overflow-y-auto"
      aria-label={ariaLabel}
    >
      {/* Day Label */}
      <h3 className="text-sm font-semibold text-gray-700 mb-2 sticky top-0 bg-white">
        {dayLabel}
      </h3>

      {/* Content Area - Scrollable */}
      <div className="flex-1 space-y-2">
        {/* Workouts */}
        {workouts.map((workout) => (
          <div key={workout.workoutId} className="text-xs">
            <WorkoutCard
              workout={{
                exerciseLibraryItemId: workout.workoutId,
                exerciseLibraryId: 0, // Not applicable for plan workouts
                exerciseLibraryItemType: 'WorkoutTemplate',
                itemName: workout.title,
                workoutTypeId: workout.workoutTypeValueId,
                distancePlanned: workout.distancePlanned,
                totalTimePlanned: workout.totalTimePlanned,
                caloriesPlanned: workout.caloriesPlanned,
                tssPlanned: workout.tssPlanned,
                ifPlanned: workout.ifPlanned,
                velocityPlanned: workout.velocityPlanned,
                energyPlanned: workout.energyPlanned,
                elevationGainPlanned: workout.elevationGainPlanned,
                description: workout.description,
                coachComments: workout.coachComments,
                fileAttachments: '',
                structure: workout.structure,
              }}
              onClick={() => {
                // No-op for calendar view (not clickable in calendar)
              }}
            />
          </div>
        ))}

        {/* Notes */}
        {notes.map((note) => (
          <div key={note.id} className="text-xs">
            <NoteCard note={note} />
          </div>
        ))}

        {/* Events */}
        {events.map((event) => (
          <div key={event.id} className="text-xs">
            <EventCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CalendarWeekRow component
 *
 * Displays a single week row with week number and 7 day cells
 */

import type { ReactElement } from 'react';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';
import { CalendarDayCell } from './CalendarDayCell';

export interface CalendarWeekRowProps {
  weekNumber: number;
  weekData: Map<
    number,
    {
      workouts: PlanWorkout[];
      notes: CalendarNote[];
      events: CalendarEvent[];
    }
  >;
}

/**
 * Get data for a specific day of week, or empty arrays if no data
 */
function getDayData(
  weekData: Map<
    number,
    { workouts: PlanWorkout[]; notes: CalendarNote[]; events: CalendarEvent[] }
  >,
  dayOfWeek: number
): { workouts: PlanWorkout[]; notes: CalendarNote[]; events: CalendarEvent[] } {
  return weekData.get(dayOfWeek) || { workouts: [], notes: [], events: [] };
}

/**
 * CalendarWeekRow component displays a week with 7 day cells
 *
 * @param props.weekNumber - Week number (1-indexed)
 * @param props.weekData - Map of dayOfWeek (0-6) to day data
 */
export function CalendarWeekRow({
  weekNumber,
  weekData,
}: CalendarWeekRowProps): ReactElement {
  const ariaLabel = `Week ${weekNumber}`;

  return (
    <div
      className="grid grid-cols-8 gap-0 border border-gray-300"
      aria-label={ariaLabel}
    >
      {/* Week Number Column */}
      <div className="bg-gray-100 border-r border-gray-300 p-2 flex items-center justify-center">
        <h3 className="text-xs font-bold text-gray-700">Week {weekNumber}</h3>
      </div>

      {/* Monday (dayOfWeek=0) */}
      <CalendarDayCell
        dayOfWeek={0}
        workouts={getDayData(weekData, 0).workouts}
        notes={getDayData(weekData, 0).notes}
        events={getDayData(weekData, 0).events}
      />

      {/* Tuesday (dayOfWeek=1) */}
      <CalendarDayCell
        dayOfWeek={1}
        workouts={getDayData(weekData, 1).workouts}
        notes={getDayData(weekData, 1).notes}
        events={getDayData(weekData, 1).events}
      />

      {/* Wednesday (dayOfWeek=2) */}
      <CalendarDayCell
        dayOfWeek={2}
        workouts={getDayData(weekData, 2).workouts}
        notes={getDayData(weekData, 2).notes}
        events={getDayData(weekData, 2).events}
      />

      {/* Thursday (dayOfWeek=3) */}
      <CalendarDayCell
        dayOfWeek={3}
        workouts={getDayData(weekData, 3).workouts}
        notes={getDayData(weekData, 3).notes}
        events={getDayData(weekData, 3).events}
      />

      {/* Friday (dayOfWeek=4) */}
      <CalendarDayCell
        dayOfWeek={4}
        workouts={getDayData(weekData, 4).workouts}
        notes={getDayData(weekData, 4).notes}
        events={getDayData(weekData, 4).events}
      />

      {/* Saturday (dayOfWeek=5) */}
      <CalendarDayCell
        dayOfWeek={5}
        workouts={getDayData(weekData, 5).workouts}
        notes={getDayData(weekData, 5).notes}
        events={getDayData(weekData, 5).events}
      />

      {/* Sunday (dayOfWeek=6) */}
      <CalendarDayCell
        dayOfWeek={6}
        workouts={getDayData(weekData, 6).workouts}
        notes={getDayData(weekData, 6).notes}
        events={getDayData(weekData, 6).events}
      />
    </div>
  );
}

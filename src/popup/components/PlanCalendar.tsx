/**
 * PlanCalendar component
 *
 * Main calendar container that fetches and displays training plan data
 * organized in a week-based calendar format
 */

import type { ReactElement } from 'react';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { usePlanNotes } from '@/hooks/usePlanNotes';
import { usePlanEvents } from '@/hooks/usePlanEvents';
import { LoadingSpinner } from './LoadingSpinner';
import { CalendarWeekRow } from './CalendarWeekRow';
import {
  findEarliestDate,
  normalizeToMonday,
  organizeByWeek,
  type WeekMap,
} from '@/utils/dateUtils';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

export interface PlanCalendarProps {
  planId: number;
  planName?: string;
  onBack?: () => void;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr);
}

/**
 * PlanCalendar component displays training plan in week-based calendar format
 *
 * @param props.planId - ID of the training plan
 * @param props.planName - Optional name of the plan to display
 * @param props.onBack - Optional callback when back button is clicked
 */
export function PlanCalendar({
  planId,
  planName,
  onBack,
}: PlanCalendarProps): ReactElement {
  // Fetch all data in parallel
  const {
    data: workouts,
    isLoading: workoutsLoading,
    error: workoutsError,
    refetch: refetchWorkouts,
  } = usePlanWorkouts(planId);

  const {
    data: notes,
    isLoading: notesLoading,
    error: notesError,
    refetch: refetchNotes,
  } = usePlanNotes(planId);

  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = usePlanEvents(planId);

  // Loading state
  const isLoading = workoutsLoading || notesLoading || eventsLoading;
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Loading training plan...</p>
      </div>
    );
  }

  // Error state
  const error = workoutsError || notesError || eventsError;
  if (error) {
    const errorMessage = workoutsError
      ? 'Failed to load workouts'
      : notesError
        ? 'Failed to load notes'
        : 'Failed to load events';

    const retryFn = workoutsError
      ? refetchWorkouts
      : notesError
        ? refetchNotes
        : refetchEvents;

    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-red-600 font-semibold">{errorMessage}</p>
        <p className="text-gray-600 mt-2">{error.message}</p>
        <button
          onClick={() => retryFn()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Plans
          </button>
        )}
      </div>
    );
  }

  // Empty state
  const hasData =
    (workouts && workouts.length > 0) ||
    (notes && notes.length > 0) ||
    (events && events.length > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-gray-600">
          No workouts, notes, or events in this plan.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Plans
          </button>
        )}
      </div>
    );
  }

  // Organize data by week
  // 1. Find earliest date
  const workoutsWithDates = (workouts || []).map((w) => ({
    ...w,
    date: parseDate(w.workoutDay),
  }));
  const notesWithDates = (notes || []).map((n) => ({
    ...n,
    date: parseDate(n.noteDate),
  }));
  const eventsWithDates = (events || []).map((e) => ({
    ...e,
    date: parseDate(e.eventDate),
  }));

  const allItems = [
    ...workoutsWithDates,
    ...notesWithDates,
    ...eventsWithDates,
  ];
  const earliestDate = findEarliestDate(allItems);

  if (!earliestDate) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-gray-600">No valid dates found in plan data.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Plans
          </button>
        )}
      </div>
    );
  }

  // 2. Normalize to Monday
  const startDate = normalizeToMonday(earliestDate);

  // 3. Organize by week
  const workoutsByWeek = organizeByWeek(
    workouts || [],
    (w) => parseDate(w.workoutDay),
    startDate
  );
  const notesByWeek = organizeByWeek(
    notes || [],
    (n) => parseDate(n.noteDate),
    startDate
  );
  const eventsByWeek = organizeByWeek(
    events || [],
    (e) => parseDate(e.eventDate),
    startDate
  );

  // 4. Merge all weeks
  const allWeeks = new Set([
    ...Array.from(workoutsByWeek.keys()),
    ...Array.from(notesByWeek.keys()),
    ...Array.from(eventsByWeek.keys()),
  ]);

  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);

  // 5. Create combined week data
  const combinedWeekData = new Map<
    number,
    Map<
      number,
      {
        workouts: PlanWorkout[];
        notes: CalendarNote[];
        events: CalendarEvent[];
      }
    >
  >();

  for (const weekNumber of sortedWeeks) {
    const weekMap = new Map<
      number,
      {
        workouts: PlanWorkout[];
        notes: CalendarNote[];
        events: CalendarEvent[];
      }
    >();

    // For each day of week (0-6)
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayWorkouts = workoutsByWeek.get(weekNumber)?.get(dayOfWeek) || [];
      const dayNotes = notesByWeek.get(weekNumber)?.get(dayOfWeek) || [];
      const dayEvents = eventsByWeek.get(weekNumber)?.get(dayOfWeek) || [];

      if (
        dayWorkouts.length > 0 ||
        dayNotes.length > 0 ||
        dayEvents.length > 0
      ) {
        weekMap.set(dayOfWeek, {
          workouts: dayWorkouts,
          notes: dayNotes,
          events: dayEvents,
        });
      }
    }

    combinedWeekData.set(weekNumber, weekMap);
  }

  // Render calendar
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-300">
        <h2 className="text-xl font-bold text-gray-800">
          {planName || 'Training Plan'}
        </h2>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Plans
          </button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        {/* Calendar Header */}
        <div className="grid grid-cols-8 gap-0 border border-gray-300 mb-0 sticky top-0 bg-white z-10">
          <div className="bg-gray-100 border-r border-gray-300 p-2 font-bold text-center text-sm">
            Week
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Mon
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Tue
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Wed
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Thu
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Fri
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-2 font-semibold text-center text-sm">
            Sat
          </div>
          <div className="bg-gray-50 p-2 font-semibold text-center text-sm">
            Sun
          </div>
        </div>

        {/* Week Rows */}
        {sortedWeeks.map((weekNumber) => (
          <CalendarWeekRow
            key={weekNumber}
            weekNumber={weekNumber}
            weekData={combinedWeekData.get(weekNumber) || new Map()}
          />
        ))}
      </div>
    </div>
  );
}

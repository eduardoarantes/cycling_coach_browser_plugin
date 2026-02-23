/**
 * PlanCalendar component
 *
 * Main calendar container that fetches and displays training plan data
 * organized in a week-based calendar format
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePlanWorkouts } from '@/hooks/usePlanWorkouts';
import { usePlanNotes } from '@/hooks/usePlanNotes';
import { usePlanEvents } from '@/hooks/usePlanEvents';
import { useRxBuilderWorkouts } from '@/hooks/useRxBuilderWorkouts';
import { LoadingSpinner } from './LoadingSpinner';
import { CalendarWeekRow } from './CalendarWeekRow';
import {
  findEarliestDate,
  normalizeToMonday,
  organizeByWeek,
} from '@/utils/dateUtils';
import { logger } from '@/utils/logger';
import {
  is401Error,
  is403Error,
  getUserFriendlyErrorMessage,
  openTrainingPeaksTab,
} from '@/utils/trainingPeaksTab';
import type {
  PlanWorkout,
  RxBuilderWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

/**
 * Unified workout type that includes both classic and RxBuilder workouts
 * with a discriminator field to distinguish between them
 */
export type UnifiedWorkout =
  | (PlanWorkout & { workoutSource: 'classic' })
  | (RxBuilderWorkout & { workoutSource: 'rxBuilder' });

export interface PlanCalendarProps {
  planId: number;
  planName?: string;
  onBack?: () => void;
}

/**
 * Parse date string to Date object
 *
 * IMPORTANT: All dates are created at UTC midnight to match dateUtils.ts
 * which uses UTC methods (getUTCDay, setUTCDate, etc.)
 *
 * Extracts only the date part (YYYY-MM-DD) from any format:
 * - "2026-02-25" (RxBuilder date-only)
 * - "2026-02-24T00:00:00" (classic datetime)
 * - Future: "2026-02-24T00:00:00Z" (with timezone)
 *
 * This ensures consistent behavior regardless of:
 * - User's local timezone
 * - Whether API includes time/timezone info
 * - Browser's date parsing quirks
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  // Extract YYYY-MM-DD from any ISO 8601 format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    logger.warn('Invalid date format:', dateStr);
    return null;
  }

  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day)); // Always UTC midnight
}

/**
 * Extract date from unified workout (handles both classic and RxBuilder)
 */
function getWorkoutDate(workout: UnifiedWorkout): Date | null {
  if (workout.workoutSource === 'classic') {
    return parseDate(workout.workoutDay);
  } else {
    return parseDate(workout.prescribedDate);
  }
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
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all data in parallel
  const {
    data: classicWorkouts,
    isLoading: workoutsLoading,
    error: workoutsError,
    refetch: refetchWorkouts,
  } = usePlanWorkouts(planId);

  const {
    data: rxWorkouts,
    isLoading: rxWorkoutsLoading,
    error: rxWorkoutsError,
    refetch: refetchRxWorkouts,
  } = useRxBuilderWorkouts(planId);

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

  // Merge classic and RxBuilder workouts into unified array with deduplication
  const workouts = useMemo((): UnifiedWorkout[] => {
    const seen = new Set<string>();

    // Process classic workouts first
    const classic: UnifiedWorkout[] = (classicWorkouts || [])
      .map((w) => ({
        ...w,
        workoutSource: 'classic' as const,
      }))
      .filter((w) => {
        const key = `classic-${w.workoutId}`;
        if (seen.has(key)) {
          logger.warn('Duplicate classic workout detected:', w.workoutId);
          return false;
        }
        seen.add(key);
        return true;
      });

    // Process RxBuilder workouts with separate namespace
    const rx: UnifiedWorkout[] = (rxWorkouts || [])
      .map((w) => ({
        ...w,
        workoutSource: 'rxBuilder' as const,
      }))
      .filter((w) => {
        const key = `rx-${w.id}`;
        if (seen.has(key)) {
          logger.warn('Duplicate RxBuilder workout detected:', w.id);
          return false;
        }
        seen.add(key);
        return true;
      });

    return [...classic, ...rx];
  }, [classicWorkouts, rxWorkouts]);

  // Refresh all plan data
  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      logger.info('🔄 Refreshing plan data for planId:', planId);

      // Remove all cached data for this plan and force network refetch
      await queryClient.resetQueries({ queryKey: ['plans', planId] });

      // Wait for all refetches to complete with fresh data
      const results = await Promise.all([
        refetchWorkouts(),
        refetchRxWorkouts(),
        refetchNotes(),
        refetchEvents(),
      ]);

      logger.info('✅ Refresh complete:', {
        classicWorkouts: results[0].data?.length || 0,
        rxWorkouts: results[1].data?.length || 0,
        notes: results[2].data?.length || 0,
        events: results[3].data?.length || 0,
      });

      // Log all workout dates for debugging
      if (results[0].data) {
        logger.info('Classic workout dates:');
        results[0].data.forEach((w) => {
          logger.info(
            `  - ${w.workoutDay}: ${w.title || '(no title)'} (Type: ${w.workoutTypeValueId})`
          );
        });
      }
      if (results[1].data) {
        logger.info('RxBuilder workout dates:');
        results[1].data.forEach((w) => {
          logger.info(`  - ${w.prescribedDate}: ${w.title} (${w.workoutType})`);
        });
      }
    } catch (error) {
      logger.error('❌ Refresh failed:', error);
    } finally {
      // Keep spinner visible for at least 500ms for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Debug logging to see workout data
  useEffect(() => {
    if (workouts.length > 0) {
      logger.info('Total workouts loaded:', workouts.length);
      const classicCount = workouts.filter(
        (w) => w.workoutSource === 'classic'
      ).length;
      const rxCount = workouts.filter(
        (w) => w.workoutSource === 'rxBuilder'
      ).length;
      logger.info(`  - Classic: ${classicCount}, RxBuilder: ${rxCount}`);
    }
  }, [workouts]);

  // Download training plan as JSON
  const handleDownload = (): void => {
    const planData = {
      planId,
      planName: planName || 'Training Plan',
      exportDate: new Date().toISOString(),
      classicWorkouts: classicWorkouts || [],
      rxBuilderWorkouts: rxWorkouts || [],
      notes: notes || [],
      events: events || [],
      summary: {
        totalClassicWorkouts: classicWorkouts?.length || 0,
        totalRxBuilderWorkouts: rxWorkouts?.length || 0,
        totalNotes: notes?.length || 0,
        totalEvents: events?.length || 0,
      },
    };

    const jsonString = JSON.stringify(planData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `training-plan-${planId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('📥 Training plan downloaded:', link.download);
  };

  // Loading state
  const isLoading =
    workoutsLoading || rxWorkoutsLoading || notesLoading || eventsLoading;
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Loading training plan...</p>
      </div>
    );
  }

  // Error state
  const error = workoutsError || rxWorkoutsError || notesError || eventsError;
  if (error) {
    // Determine which data source failed and create detailed error message
    const errorContext = workoutsError
      ? {
          type: 'classic workouts',
          error: workoutsError,
          retry: refetchWorkouts,
        }
      : rxWorkoutsError
        ? {
            type: 'strength workouts',
            error: rxWorkoutsError,
            retry: refetchRxWorkouts,
          }
        : notesError
          ? { type: 'notes', error: notesError, retry: refetchNotes }
          : { type: 'events', error: eventsError!, retry: refetchEvents };

    const friendlyMessage = getUserFriendlyErrorMessage(errorContext.error);
    const errorMessage = `Failed to load ${errorContext.type}: ${friendlyMessage}`;
    const isAuthError = is401Error(errorContext.error);
    const isPermissionError = is403Error(errorContext.error);

    const handleRetry = async (): Promise<void> => {
      if (isAuthError) {
        // For 401 errors, open TrainingPeaks to get a fresh token
        await openTrainingPeaksTab();
      } else {
        // For other errors, just retry the request
        errorContext.retry();
      }
    };

    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-red-600 font-semibold text-center">{errorMessage}</p>
        {isAuthError && (
          <p className="text-gray-500 text-xs mt-1 text-center">
            Opening TrainingPeaks to refresh your authentication...
          </p>
        )}
        {isPermissionError && (
          <p className="text-gray-500 text-xs mt-1 text-center">
            This training plan is not shared with you
          </p>
        )}
        <button
          onClick={handleRetry}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isAuthError ? 'Open TrainingPeaks' : 'Retry'}
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
  const workoutsWithDates = workouts.map((w) => ({
    ...w,
    date: getWorkoutDate(w),
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
  const workoutsByWeek = organizeByWeek(workouts, getWorkoutDate, startDate);
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
        workouts: UnifiedWorkout[];
        notes: CalendarNote[];
        events: CalendarEvent[];
      }
    >
  >();

  for (const weekNumber of sortedWeeks) {
    const weekMap = new Map<
      number,
      {
        workouts: UnifiedWorkout[];
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
      <div className="flex items-center justify-between p-2 border-b border-gray-300">
        <h2 className="text-base font-bold text-gray-800">
          {planName || 'Training Plan'}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="p-1 text-gray-600 hover:text-gray-800"
            title="Download plan as JSON"
            aria-label="Download plan as JSON"
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
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            title="Refresh plan data"
            aria-label="Refresh plan data"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
            >
              <span>←</span>
              <span>Back</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-2">
        {/* Calendar Header */}
        <div
          className="grid gap-0 border border-gray-300 mb-0 sticky top-0 bg-white z-10"
          style={{ gridTemplateColumns: '50px repeat(7, 1fr)' }}
        >
          <div className="bg-gray-100 border-r border-gray-300 p-1 font-bold text-center text-xs">
            Week
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Mon
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Tue
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Wed
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Thu
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Fri
          </div>
          <div className="bg-gray-50 border-r border-gray-300 p-1 font-semibold text-center text-xs">
            Sat
          </div>
          <div className="bg-gray-50 p-1 font-semibold text-center text-xs">
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

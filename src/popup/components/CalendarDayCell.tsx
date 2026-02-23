/**
 * CalendarDayCell component
 *
 * Displays a single day cell with compact activity icons and hover tooltips
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  flip,
  shift,
  FloatingPortal,
  autoUpdate,
} from '@floating-ui/react';
import type { CalendarNote, CalendarEvent } from '@/types/api.types';
import type { UnifiedWorkout } from './PlanCalendar';

export interface CalendarDayCellProps {
  dayOfWeek: number; // 0=Monday, 6=Sunday
  workouts: UnifiedWorkout[];
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
 * WorkoutBadge - Shows workout icon with detailed popup on hover
 * Handles both classic and RxBuilder workouts
 */
interface WorkoutBadgeProps {
  workout: UnifiedWorkout;
}

function WorkoutBadge({ workout }: WorkoutBadgeProps): ReactElement {
  // Handle RxBuilder workouts differently
  if (workout.workoutSource === 'rxBuilder') {
    return <RxBuilderWorkoutBadge workout={workout} />;
  }

  // Classic workout rendering
  return <ClassicWorkoutBadge workout={workout} />;
}

/**
 * ClassicWorkoutBadge - Shows classic workout with metrics popup
 */
function ClassicWorkoutBadge({
  workout,
}: {
  workout: UnifiedWorkout & { workoutSource: 'classic' };
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const icon = getWorkoutIcon(workout.workoutTypeValueId);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className="flex items-center justify-center w-8 h-8 rounded bg-blue-100 hover:bg-blue-200 cursor-pointer text-lg"
      >
        {icon}
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] w-64"
          >
            <div className="bg-white border-2 border-blue-400 rounded-lg shadow-xl p-3">
              {/* Workout Title */}
              <h4 className="font-bold text-sm text-gray-900 mb-2">
                {workout.title}
              </h4>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {workout.totalTimePlanned !== null && (
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-1 font-semibold">
                      {formatDuration(workout.totalTimePlanned)}
                    </span>
                  </div>
                )}

                {workout.distancePlanned !== null && (
                  <div>
                    <span className="text-gray-600">Distance:</span>
                    <span className="ml-1 font-semibold">
                      {formatDistance(workout.distancePlanned)}
                    </span>
                  </div>
                )}

                {workout.tssPlanned !== null && (
                  <div>
                    <span className="text-gray-600">TSS:</span>
                    <span className="ml-1 font-semibold text-blue-600">
                      {workout.tssPlanned}
                    </span>
                  </div>
                )}

                {workout.ifPlanned !== null && (
                  <div>
                    <span className="text-gray-600">IF:</span>
                    <span className="ml-1 font-semibold text-purple-600">
                      {workout.ifPlanned.toFixed(2)}
                    </span>
                  </div>
                )}

                {workout.elevationGainPlanned !== null && (
                  <div>
                    <span className="text-gray-600">Elevation:</span>
                    <span className="ml-1 font-semibold">
                      {workout.elevationGainPlanned}m
                    </span>
                  </div>
                )}

                {workout.caloriesPlanned !== null && (
                  <div>
                    <span className="text-gray-600">Calories:</span>
                    <span className="ml-1 font-semibold">
                      {workout.caloriesPlanned}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {workout.description && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-700 line-clamp-3">
                    {workout.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * RxBuilderWorkoutBadge - Shows RxBuilder (structured strength) workout
 * with exercise sequence popup
 */
function RxBuilderWorkoutBadge({
  workout,
}: {
  workout: UnifiedWorkout & { workoutSource: 'rxBuilder' };
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className="flex items-center justify-center w-8 h-8 rounded bg-purple-100 hover:bg-purple-200 cursor-pointer text-lg"
      >
        💪
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] w-64"
          >
            <div className="bg-white border-2 border-purple-400 rounded-lg shadow-xl p-3">
              {/* Workout Title */}
              <h4 className="font-bold text-sm text-gray-900 mb-2">
                {workout.title}
              </h4>

              {/* Instructions */}
              {workout.instructions && (
                <p className="text-xs text-gray-600 mb-2">
                  {workout.instructions}
                </p>
              )}

              {/* Exercise Sequence */}
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-gray-700">Exercises:</div>
                {workout.sequenceSummary.map((seq, i) => (
                  <div key={i} className="text-gray-600">
                    {seq.sequenceOrder}. {seq.title}
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                {workout.totalSets} sets • {workout.totalPrescriptions}{' '}
                exercises
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * NoteBadge - Shows note icon with popup on hover
 */
interface NoteBadgeProps {
  note: CalendarNote;
}

function NoteBadge({ note }: NoteBadgeProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className="flex items-center justify-center w-8 h-8 rounded bg-yellow-100 hover:bg-yellow-200 cursor-pointer text-lg"
      >
        📝
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] w-56"
          >
            <div className="bg-white border-2 border-yellow-400 rounded-lg shadow-xl p-3">
              <h4 className="font-bold text-sm text-gray-900 mb-1">
                📝 {note.title}
              </h4>
              {note.description && (
                <p className="text-xs text-gray-700">{note.description}</p>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/**
 * EventBadge - Shows event icon with popup on hover
 */
interface EventBadgeProps {
  event: CalendarEvent;
}

function EventBadge({ event }: EventBadgeProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className="flex items-center justify-center w-8 h-8 rounded bg-green-100 hover:bg-green-200 cursor-pointer text-lg"
      >
        🏁
      </div>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] w-56"
          >
            <div className="bg-white border-2 border-green-400 rounded-lg shadow-xl p-3">
              <h4 className="font-bold text-sm text-gray-900 mb-1">
                🏁 {event.name}
              </h4>
              <p className="text-xs text-gray-600 mb-1">{event.eventType}</p>
              {event.distance && (
                <p className="text-xs text-gray-700">
                  Distance: {event.distance} {event.distanceUnits || ''}
                </p>
              )}
              {event.description && (
                <p className="text-xs text-gray-700 mt-1">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
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
    <div className="border-r border-gray-300 last:border-r-0 p-1 min-h-16 bg-white overflow-visible">
      {!hasContent ? (
        <div className="text-xs text-gray-400 text-center py-2">-</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {/* Workouts */}
          {workouts.map((workout) => {
            const key =
              workout.workoutSource === 'classic'
                ? `classic-${workout.workoutId}`
                : `rx-${workout.id}`;
            return <WorkoutBadge key={key} workout={workout} />;
          })}

          {/* Notes */}
          {notes.map((note) => (
            <NoteBadge key={note.id} note={note} />
          ))}

          {/* Events */}
          {events.map((event) => (
            <EventBadge key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

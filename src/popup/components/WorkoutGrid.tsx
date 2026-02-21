import type { ReactElement, ReactNode } from 'react';

export interface WorkoutGridProps {
  children: ReactNode;
}

/**
 * WorkoutGrid component provides a consistent layout for workout cards
 *
 * Uses a vertical stack layout with consistent spacing.
 * Similar to LibraryGrid but optimized for workout cards.
 *
 * @param props.children - Workout cards to display (typically WorkoutCard components)
 *
 * @example
 * ```tsx
 * <WorkoutGrid>
 *   {workouts.map(workout => (
 *     <WorkoutCard key={workout.id} workout={workout} onClick={handleClick} />
 *   ))}
 * </WorkoutGrid>
 * ```
 */
export function WorkoutGrid({ children }: WorkoutGridProps): ReactElement {
  return <div className="flex flex-col space-y-4">{children}</div>;
}

/**
 * TrainingPlanCard component
 *
 * Displays a training plan summary card with title, author, and metadata
 */

import type { ReactElement } from 'react';
import type { TrainingPlan } from '@/types/api.types';

export interface TrainingPlanCardProps {
  plan: TrainingPlan;
  onClick: (planId: number) => void;
}

/**
 * Format date string to "MMM DD" format
 * @param dateString - ISO date string (e.g., "2026-02-24")
 * @returns Formatted date (e.g., "Feb 24")
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format week count with proper singular/plural
 * @param count - Number of weeks
 * @returns Formatted string (e.g., "1 week" or "3 weeks")
 */
function formatWeeks(count: number): string {
  return count === 1 ? '1 week' : `${count} weeks`;
}

/**
 * Format workout count with proper singular/plural
 * @param count - Number of workouts
 * @returns Formatted string (e.g., "1 workout" or "8 workouts")
 */
function formatWorkouts(count: number): string {
  return count === 1 ? '1 workout' : `${count} workouts`;
}

export function TrainingPlanCard({
  plan,
  onClick,
}: TrainingPlanCardProps): ReactElement {
  const handleClick = (): void => {
    onClick(plan.planId);
  };

  const dateRange = `${formatDate(plan.startDate)} - ${formatDate(plan.endDate)}`;
  const metadata = `${formatWeeks(plan.weekCount)} • ${formatWorkouts(plan.workoutCount)} • ${dateRange}`;

  return (
    <button
      onClick={handleClick}
      aria-label={`View ${plan.title} by ${plan.author}`}
      className="w-full p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
    >
      <h3 className="text-base font-semibold text-gray-900 truncate">
        {plan.title}
      </h3>
      <p className="text-sm text-gray-600 mt-1">by {plan.author}</p>
      <p className="text-xs text-gray-500 mt-1">{metadata}</p>
    </button>
  );
}

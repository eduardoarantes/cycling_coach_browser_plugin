/**
 * TrainingPlanList component
 *
 * Displays list of training plans with loading, error, and empty states
 */

import type { ReactElement } from 'react';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { TrainingPlanCard } from './TrainingPlanCard';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

export interface TrainingPlanListProps {
  onSelectPlan: (planId: number) => void;
}

export function TrainingPlanList({
  onSelectPlan,
}: TrainingPlanListProps): ReactElement {
  const { data: plans, isLoading, error, refetch } = useTrainingPlans();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-800">
            Failed to Load Data
          </p>
          <p className="mt-1 text-xs text-red-600">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no plans at all)
  if (!plans || plans.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="No Training Plans Found"
          message="You don't have any training plans yet."
        />
      </div>
    );
  }

  // Success state with plans
  return (
    <div className="mt-4 space-y-3">
      {plans.map((plan) => (
        <TrainingPlanCard
          key={plan.planId}
          plan={plan}
          onClick={onSelectPlan}
        />
      ))}
    </div>
  );
}

/**
 * Unit tests for TrainingPlanList component
 *
 * Tests training plan list rendering, loading states, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrainingPlanList } from '@/popup/components/TrainingPlanList';
import type { TrainingPlan } from '@/types/api.types';

// Mock the useTrainingPlans hook
vi.mock('@/hooks/useTrainingPlans', () => ({
  useTrainingPlans: vi.fn(),
}));

import { useTrainingPlans } from '@/hooks/useTrainingPlans';

// Mock training plans data
const mockPlans: TrainingPlan[] = [
  {
    planAccess: {
      planAccessId: 1,
      personId: 123,
      planId: 456,
      accessFromPayment: false,
      accessFromShare: true,
      grantedFromPersonId: 789,
      planAccessType: 1,
    },
    planId: 456,
    planPersonId: 123,
    ownerPersonId: 789,
    createdOn: '2025-01-01T00:00:00Z',
    title: 'Cycling Custom Training Plan',
    author: 'Eduardo',
    planEmail: 'test@example.com',
    planLanguage: 'en',
    dayCount: 21,
    weekCount: 3,
    startDate: '2026-02-24',
    endDate: '2026-03-13',
    workoutCount: 8,
    eventCount: 1,
    description: 'A custom training plan',
    planCategory: 1,
    subcategory: null,
    additionalCriteria: null,
    eventPlan: false,
    eventName: null,
    eventDate: null,
    forceDate: false,
    isDynamic: false,
    isPublic: false,
    isSearchable: false,
    price: null,
    customUrl: 0,
    hasWeeklyGoals: false,
    sampleWeekOne: null,
    sampleWeekTwo: null,
  },
  {
    planAccess: {
      planAccessId: 2,
      personId: 123,
      planId: 789,
      accessFromPayment: true,
      accessFromShare: false,
      grantedFromPersonId: 123,
      planAccessType: 1,
    },
    planId: 789,
    planPersonId: 123,
    ownerPersonId: 123,
    createdOn: '2025-01-15T00:00:00Z',
    title: 'Running Base Building Plan',
    author: 'Coach John',
    planEmail: 'coach@example.com',
    planLanguage: 'en',
    dayCount: 42,
    weekCount: 6,
    startDate: '2026-03-01',
    endDate: '2026-04-11',
    workoutCount: 24,
    eventCount: 0,
    description: 'Build your aerobic base',
    planCategory: 2,
    subcategory: null,
    additionalCriteria: null,
    eventPlan: false,
    eventName: null,
    eventDate: null,
    forceDate: false,
    isDynamic: false,
    isPublic: true,
    isSearchable: true,
    price: 29.99,
    customUrl: 0,
    hasWeeklyGoals: true,
    sampleWeekOne: null,
    sampleWeekTwo: null,
  },
];

function renderWithQueryClient(
  ui: React.ReactElement
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('TrainingPlanList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('should display loading spinner when loading', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      // Should show loading state
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message when fetch fails', () => {
      const mockError = new Error('Network error');
      const mockRefetch = vi.fn();

      vi.mocked(useTrainingPlans).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      expect(screen.getByText('Failed to Load Data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should call refetch when retry button clicked', async () => {
      const user = userEvent.setup();
      const mockError = new Error('Network error');
      const mockRefetch = vi.fn();

      vi.mocked(useTrainingPlans).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('should display empty state when no plans available', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      expect(screen.getByText('No Training Plans Found')).toBeInTheDocument();
      expect(
        screen.getByText("You don't have any training plans yet.")
      ).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('should display all training plan cards', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: mockPlans,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      expect(
        screen.getByText('Cycling Custom Training Plan')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Running Base Building Plan')
      ).toBeInTheDocument();
    });

    it('should call onSelectPlan when plan card clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: mockPlans,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      const firstPlanCard = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      await user.click(firstPlanCard);

      expect(mockOnSelectPlan).toHaveBeenCalledWith(456);
      expect(mockOnSelectPlan).toHaveBeenCalledTimes(1);
    });

    it('should render plans in correct order', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: mockPlans,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      const planCards = screen.getAllByRole('button');
      expect(planCards[0]).toHaveTextContent('Cycling Custom Training Plan');
      expect(planCards[1]).toHaveTextContent('Running Base Building Plan');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined data gracefully', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      expect(screen.getByText('No Training Plans Found')).toBeInTheDocument();
    });

    it('should handle single plan correctly', () => {
      vi.mocked(useTrainingPlans).mockReturnValue({
        data: [mockPlans[0]],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      const mockOnSelectPlan = vi.fn();
      renderWithQueryClient(
        <TrainingPlanList onSelectPlan={mockOnSelectPlan} />
      );

      expect(
        screen.getByText('Cycling Custom Training Plan')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Running Base Building Plan')
      ).not.toBeInTheDocument();
    });
  });
});

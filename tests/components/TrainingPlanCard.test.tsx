/**
 * Unit tests for TrainingPlanCard component
 *
 * Tests training plan card rendering, interactions, and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainingPlanCard } from '@/popup/components/TrainingPlanCard';
import type { TrainingPlan } from '@/types/api.types';

// Mock training plan data
const mockPlan: TrainingPlan = {
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
  description: 'A custom training plan for cycling',
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
};

describe('TrainingPlanCard', () => {
  describe('rendering', () => {
    it('should render plan title', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      expect(
        screen.getByText('Cycling Custom Training Plan')
      ).toBeInTheDocument();
    });

    it('should render author name', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      expect(screen.getByText('by Eduardo')).toBeInTheDocument();
    });

    it('should render week count and workout count', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      expect(screen.getByText(/3 weeks/)).toBeInTheDocument();
      expect(screen.getByText(/8 workouts/)).toBeInTheDocument();
    });

    it('should render formatted date range', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      // Check for formatted date (e.g., "Feb 24 - Mar 13")
      expect(screen.getByText(/Feb 24 - Mar 13/)).toBeInTheDocument();
    });

    it('should render all metadata in one line', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      // Should show: "3 weeks • 8 workouts • Feb 24 - Mar 13"
      expect(
        screen.getByText(/3 weeks • 8 workouts • Feb 24 - Mar 13/)
      ).toBeInTheDocument();
    });

    it('should handle plan with no workouts', () => {
      const mockOnClick = vi.fn();
      const planWithNoWorkouts = { ...mockPlan, workoutCount: 0 };
      render(
        <TrainingPlanCard plan={planWithNoWorkouts} onClick={mockOnClick} />
      );

      expect(screen.getByText(/0 workouts/)).toBeInTheDocument();
    });

    it('should handle plan with single week', () => {
      const mockOnClick = vi.fn();
      const singleWeekPlan = { ...mockPlan, weekCount: 1 };
      render(<TrainingPlanCard plan={singleWeekPlan} onClick={mockOnClick} />);

      expect(screen.getByText(/1 week/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClick with planId when card clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      await user.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(456);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should show hover effect on mouse over', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      expect(card).toHaveClass('hover:border-blue-400');
      expect(card).toHaveClass('hover:shadow-md');
    });

    it('should support keyboard navigation with Enter', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      card.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledWith(456);
    });

    it('should support keyboard navigation with Space', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      card.focus();
      await user.keyboard(' ');

      expect(mockOnClick).toHaveBeenCalledWith(456);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA label', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /View Cycling Custom Training Plan by Eduardo/,
      });
      expect(card).toBeInTheDocument();
    });

    it('should be a button element', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      const card = screen.getByRole('button', {
        name: /Cycling Custom Training Plan/,
      });
      expect(card.tagName).toBe('BUTTON');
    });

    it('should have descriptive text for screen readers', () => {
      const mockOnClick = vi.fn();
      render(<TrainingPlanCard plan={mockPlan} onClick={mockOnClick} />);

      // Should have author info
      expect(screen.getByText(/by Eduardo/)).toBeInTheDocument();

      // Should have metadata
      expect(screen.getByText(/3 weeks/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long plan titles', () => {
      const mockOnClick = vi.fn();
      const longTitlePlan = {
        ...mockPlan,
        title:
          'This is a very long training plan title that should be truncated with ellipsis',
      };
      render(<TrainingPlanCard plan={longTitlePlan} onClick={mockOnClick} />);

      const titleElement = screen.getByText(
        /This is a very long training plan title/
      );
      expect(titleElement).toHaveClass('truncate');
    });

    it('should handle dates across year boundary', () => {
      const mockOnClick = vi.fn();
      const crossYearPlan = {
        ...mockPlan,
        startDate: '2025-12-15',
        endDate: '2026-01-15',
      };
      render(<TrainingPlanCard plan={crossYearPlan} onClick={mockOnClick} />);

      // Should show formatted dates
      expect(screen.getByText(/Dec 15 - Jan 15/)).toBeInTheDocument();
    });

    it('should handle same start and end date', () => {
      const mockOnClick = vi.fn();
      const sameDatePlan = {
        ...mockPlan,
        startDate: '2026-02-24',
        endDate: '2026-02-24',
      };
      render(<TrainingPlanCard plan={sameDatePlan} onClick={mockOnClick} />);

      expect(screen.getByText(/Feb 24 - Feb 24/)).toBeInTheDocument();
    });
  });
});

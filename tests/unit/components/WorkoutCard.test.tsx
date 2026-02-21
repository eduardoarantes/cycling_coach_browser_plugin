import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutCard } from '@/popup/components/WorkoutCard';
import type { LibraryItem } from '@/types/api.types';

describe('WorkoutCard', () => {
  const mockWorkout: LibraryItem = {
    exerciseLibraryId: 1,
    exerciseLibraryItemId: 101,
    exerciseLibraryItemType: 'Workout',
    itemName: 'Endurance Ride',
    workoutTypeId: 11,
    distancePlanned: 50000, // 50km in meters
    totalTimePlanned: 7200, // 2 hours in seconds
    caloriesPlanned: 1200,
    tssPlanned: 85,
    ifPlanned: 0.75,
    velocityPlanned: 25.5,
    energyPlanned: 180,
    elevationGainPlanned: 500,
    description: 'A steady endurance ride focusing on aerobic development.',
    coachComments: 'Keep HR in Zone 2 throughout.',
  };

  describe('Component Rendering', () => {
    it('should render workout name', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
    });

    it('should render duration in hours and minutes', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      // 7200 seconds = 2 hours 0 minutes
      expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    });

    it('should render TSS when available', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(screen.getByText(/TSS/)).toBeInTheDocument();
      expect(screen.getByText(/85/)).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(
        screen.getByText(
          /A steady endurance ride focusing on aerobic development/
        )
      ).toBeInTheDocument();
    });

    it('should render coach comments when available', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(screen.getByText(/Coach:/)).toBeInTheDocument();
      expect(
        screen.getByText(/Keep HR in Zone 2 throughout/)
      ).toBeInTheDocument();
    });

    it('should not render coach comments section when null', () => {
      const workoutWithoutComments = { ...mockWorkout, coachComments: null };
      render(
        <WorkoutCard workout={workoutWithoutComments} onClick={vi.fn()} />
      );
      expect(screen.queryByText(/Coach:/)).not.toBeInTheDocument();
    });

    it('should not render TSS when null', () => {
      const workoutWithoutTSS = { ...mockWorkout, tssPlanned: null };
      render(<WorkoutCard workout={workoutWithoutTSS} onClick={vi.fn()} />);
      expect(screen.queryByText(/TSS/)).not.toBeInTheDocument();
    });

    it('should render distance when available', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      // 50000 meters = 50km
      expect(screen.getByText(/50.*km/i)).toBeInTheDocument();
    });

    it('should not render distance when null', () => {
      const workoutWithoutDistance = { ...mockWorkout, distancePlanned: null };
      render(
        <WorkoutCard workout={workoutWithoutDistance} onClick={vi.fn()} />
      );
      // Should not show "0 km" or similar
      const card = screen.getByRole('button');
      expect(card.textContent).not.toMatch(/\d+\s*km/i);
    });

    it('should render elevation when available', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(screen.getByText(/500.*m/i)).toBeInTheDocument();
    });
  });

  describe('Duration Formatting', () => {
    it('should format duration with only hours when minutes is zero', () => {
      const workout = { ...mockWorkout, totalTimePlanned: 3600 }; // 1 hour
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);
      expect(screen.getByText(/1h 0m/)).toBeInTheDocument();
    });

    it('should format duration with hours and minutes', () => {
      const workout = { ...mockWorkout, totalTimePlanned: 5430 }; // 1h 30m 30s
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);
      expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
    });

    it('should format duration with only minutes when less than 1 hour', () => {
      const workout = { ...mockWorkout, totalTimePlanned: 1800 }; // 30 minutes
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);
      expect(screen.getByText(/0h 30m/)).toBeInTheDocument();
    });

    it('should handle zero duration', () => {
      const workout = { ...mockWorkout, totalTimePlanned: 0 };
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);
      expect(screen.getByText(/0h 0m/)).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onClick with workout ID when clicked', () => {
      const handleClick = vi.fn();
      render(<WorkoutCard workout={mockWorkout} onClick={handleClick} />);

      const card = screen.getByRole('button');
      card.click();

      expect(handleClick).toHaveBeenCalledWith(101);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<WorkoutCard workout={mockWorkout} onClick={handleClick} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });

    it('should have descriptive aria-label', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      const card = screen.getByRole('button');
      const ariaLabel = card.getAttribute('aria-label');
      expect(ariaLabel).toContain('Endurance Ride');
      expect(ariaLabel).toContain('2h 0m');
    });

    it('should have aria-label even without TSS', () => {
      const workoutWithoutTSS = { ...mockWorkout, tssPlanned: null };
      render(<WorkoutCard workout={workoutWithoutTSS} onClick={vi.fn()} />);
      const card = screen.getByRole('button');
      const ariaLabel = card.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Endurance Ride');
    });
  });

  describe('Long Content Handling', () => {
    it('should truncate long descriptions', () => {
      const longDescription =
        'This is a very long description that should be truncated when displayed. '.repeat(
          10
        );
      const workout = { ...mockWorkout, description: longDescription };
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);

      // Find the description element by its partial content
      const descElement = screen.getByText(/This is a very long description/, {
        exact: false,
      });
      // Should have line-clamp class for CSS truncation
      expect(descElement).toHaveClass('line-clamp-2');
    });

    it('should handle null description', () => {
      const workout = { ...mockWorkout, description: null };
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);

      // Should not show description text
      expect(screen.queryByText(/steady endurance/)).not.toBeInTheDocument();
    });

    it('should handle empty description', () => {
      const workout = { ...mockWorkout, description: '' };
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);

      // Should not show description section
      const card = screen.getByRole('button');
      expect(card.textContent).not.toMatch(/^\s*$/);
    });
  });

  describe('Metric Display', () => {
    it('should display IF (Intensity Factor) when available', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);
      expect(screen.getByText(/IF/)).toBeInTheDocument();
      expect(screen.getByText(/0\.75/)).toBeInTheDocument();
    });

    it('should not display IF when null', () => {
      const workout = { ...mockWorkout, ifPlanned: null };
      render(<WorkoutCard workout={workout} onClick={vi.fn()} />);
      expect(screen.queryByText(/IF/)).not.toBeInTheDocument();
    });

    it('should display all available metrics', () => {
      render(<WorkoutCard workout={mockWorkout} onClick={vi.fn()} />);

      // Check for presence of metrics
      expect(screen.getByText(/2h 0m/)).toBeInTheDocument(); // Duration
      expect(screen.getByText(/TSS/)).toBeInTheDocument(); // TSS
      expect(screen.getByText(/50.*km/i)).toBeInTheDocument(); // Distance
      expect(screen.getByText(/500.*m/i)).toBeInTheDocument(); // Elevation
    });
  });
});

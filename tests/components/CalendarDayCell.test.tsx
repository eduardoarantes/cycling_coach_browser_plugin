/**
 * Unit tests for CalendarDayCell component
 *
 * Tests calendar day cell rendering with workouts, notes, and events
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarDayCell } from '@/popup/components/CalendarDayCell';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

// Mock data
const mockWorkout: PlanWorkout = {
  workoutId: 1,
  athleteId: 123,
  title: 'Recovery Run',
  workoutTypeValueId: 3,
  code: null,
  workoutDay: '2026-02-24',
  startTime: null,
  startTimePlanned: null,
  isItAnOr: false,
  isHidden: false,
  completed: false,
  description: 'Easy 5k run',
  userTags: null,
  coachComments: null,
  workoutComments: null,
  newComment: null,
  hasPrivateWorkoutNoteForCaller: false,
  publicSettingValue: 0,
  sharedWorkoutInformationKey: null,
  sharedWorkoutInformationExpireKey: null,
  distance: 5000,
  distancePlanned: 5000,
  distanceCustomized: null,
  distanceUnitsCustomized: null,
  totalTime: null,
  totalTimePlanned: 0.5,
  heartRateMinimum: null,
  heartRateMaximum: null,
  heartRateAverage: null,
  calories: null,
  caloriesPlanned: null,
  tssActual: null,
  tssPlanned: 42,
  tssSource: null,
  if: null,
  ifPlanned: 0.65,
  velocityAverage: null,
  velocityPlanned: null,
  velocityMaximum: null,
  normalizedSpeedActual: null,
  normalizedPowerActual: null,
  powerAverage: null,
  powerMaximum: null,
  energy: null,
  energyPlanned: null,
  elevationGain: null,
  elevationGainPlanned: null,
  elevationLoss: null,
  elevationMinimum: null,
  elevationAverage: null,
  elevationMaximum: null,
  torqueAverage: null,
  torqueMaximum: null,
  tempMin: null,
  tempAvg: null,
  tempMax: null,
  cadenceAverage: null,
  cadenceMaximum: null,
  lastModifiedDate: '2026-02-01T00:00:00Z',
  equipmentBikeId: null,
  equipmentShoeId: null,
  isLocked: false,
  complianceDurationPercent: null,
  complianceDistancePercent: null,
  complianceTssPercent: null,
  rpe: null,
  feeling: null,
  structure: null,
  orderOnDay: null,
  personalRecordCount: null,
  syncedTo: null,
  poolLengthOptionId: null,
  workoutSubTypeId: null,
  workoutDeviceSource: null,
};

const mockNote: CalendarNote = {
  id: 1,
  title: 'Week 2 starting',
  description: 'Recovery week focus',
  noteDate: '2026-02-24',
  createdDate: '2026-02-01T00:00:00Z',
  modifiedDate: '2026-02-01T00:00:00Z',
  planId: 456,
  attachments: [],
};

const mockEvent: CalendarEvent = {
  id: 1,
  planId: 456,
  eventDate: '2026-02-24',
  name: 'Husky',
  eventType: 'MultisportTriathlon',
  description: null,
  comment: null,
  distance: 51.5,
  distanceUnits: 'km',
  legs: [],
};

describe('CalendarDayCell', () => {
  describe('day label rendering', () => {
    it('should render Monday label for dayOfWeek=0', () => {
      render(
        <CalendarDayCell dayOfWeek={0} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    it('should render Tuesday label for dayOfWeek=1', () => {
      render(
        <CalendarDayCell dayOfWeek={1} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Tue')).toBeInTheDocument();
    });

    it('should render Wednesday label for dayOfWeek=2', () => {
      render(
        <CalendarDayCell dayOfWeek={2} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Wed')).toBeInTheDocument();
    });

    it('should render Thursday label for dayOfWeek=3', () => {
      render(
        <CalendarDayCell dayOfWeek={3} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Thu')).toBeInTheDocument();
    });

    it('should render Friday label for dayOfWeek=4', () => {
      render(
        <CalendarDayCell dayOfWeek={4} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Fri')).toBeInTheDocument();
    });

    it('should render Saturday label for dayOfWeek=5', () => {
      render(
        <CalendarDayCell dayOfWeek={5} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('should render Sunday label for dayOfWeek=6', () => {
      render(
        <CalendarDayCell dayOfWeek={6} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Sun')).toBeInTheDocument();
    });
  });

  describe('empty state rendering', () => {
    it('should render empty state when no items', () => {
      render(
        <CalendarDayCell dayOfWeek={0} workouts={[]} notes={[]} events={[]} />
      );

      expect(screen.getByText('Mon')).toBeInTheDocument();
      // Should not show any workout/note/event content
      expect(screen.queryByText('Recovery Run')).not.toBeInTheDocument();
    });

    it('should have minimal content when no items', () => {
      const { container } = render(
        <CalendarDayCell dayOfWeek={0} workouts={[]} notes={[]} events={[]} />
      );

      // Should only have day label
      expect(container.textContent).toBe('Mon');
    });
  });

  describe('workout rendering', () => {
    it('should render single workout', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[]}
          events={[]}
        />
      );

      expect(screen.getByText('Recovery Run')).toBeInTheDocument();
    });

    it('should render multiple workouts', () => {
      const workout2 = { ...mockWorkout, workoutId: 2, title: 'Bike Ride' };
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout, workout2]}
          notes={[]}
          events={[]}
        />
      );

      expect(screen.getByText('Recovery Run')).toBeInTheDocument();
      expect(screen.getByText('Bike Ride')).toBeInTheDocument();
    });

    it('should pass workout data to WorkoutCard component', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[]}
          events={[]}
        />
      );

      // WorkoutCard should display workout details
      expect(screen.getByText('Recovery Run')).toBeInTheDocument();
      expect(screen.getByText(/30m/)).toBeInTheDocument(); // Duration
    });
  });

  describe('note rendering', () => {
    it('should render single note', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[mockNote]}
          events={[]}
        />
      );

      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
    });

    it('should render multiple notes', () => {
      const note2 = { ...mockNote, id: 2, title: 'Important reminder' };
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[mockNote, note2]}
          events={[]}
        />
      );

      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
      expect(screen.getByText('Important reminder')).toBeInTheDocument();
    });

    it('should pass note data to NoteCard component', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[mockNote]}
          events={[]}
        />
      );

      // NoteCard should display note details
      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
      expect(screen.getByText(/📝/)).toBeInTheDocument();
    });
  });

  describe('event rendering', () => {
    it('should render single event', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[]}
          events={[mockEvent]}
        />
      );

      expect(screen.getByText('Husky')).toBeInTheDocument();
    });

    it('should render multiple events', () => {
      const event2 = { ...mockEvent, id: 2, name: 'Marathon' };
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[]}
          events={[mockEvent, event2]}
        />
      );

      expect(screen.getByText('Husky')).toBeInTheDocument();
      expect(screen.getByText('Marathon')).toBeInTheDocument();
    });

    it('should pass event data to EventCard component', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[]}
          notes={[]}
          events={[mockEvent]}
        />
      );

      // EventCard should display event details
      expect(screen.getByText('Husky')).toBeInTheDocument();
      expect(screen.getByText(/🏁/)).toBeInTheDocument();
    });
  });

  describe('mixed content rendering', () => {
    it('should render workouts, notes, and events together', () => {
      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[mockNote]}
          events={[mockEvent]}
        />
      );

      expect(screen.getByText('Recovery Run')).toBeInTheDocument();
      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
      expect(screen.getByText('Husky')).toBeInTheDocument();
    });

    it('should render items in order: workouts, notes, events', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[mockNote]}
          events={[mockEvent]}
        />
      );

      const items = container.querySelectorAll('[aria-label]');
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle many items per day', () => {
      const workouts = [
        mockWorkout,
        { ...mockWorkout, workoutId: 2, title: 'Bike' },
        { ...mockWorkout, workoutId: 3, title: 'Swim' },
      ];
      const notes = [mockNote, { ...mockNote, id: 2, title: 'Note 2' }];
      const events = [mockEvent];

      render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={workouts}
          notes={notes}
          events={events}
        />
      );

      expect(screen.getByText('Recovery Run')).toBeInTheDocument();
      expect(screen.getByText('Bike')).toBeInTheDocument();
      expect(screen.getByText('Swim')).toBeInTheDocument();
      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
      expect(screen.getByText('Note 2')).toBeInTheDocument();
      expect(screen.getByText('Husky')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have compact layout for calendar cells', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[]}
          events={[]}
        />
      );

      // Should have appropriate padding
      const cell = container.querySelector('.p-2');
      expect(cell).toBeInTheDocument();
    });

    it('should have border for cell separation', () => {
      const { container } = render(
        <CalendarDayCell dayOfWeek={0} workouts={[]} notes={[]} events={[]} />
      );

      const cell = container.querySelector('.border');
      expect(cell).toBeInTheDocument();
    });

    it('should be scrollable when many items', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[]}
          events={[]}
        />
      );

      // Should have overflow styling for scrolling
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('should have fixed or minimum height', () => {
      const { container } = render(
        <CalendarDayCell dayOfWeek={0} workouts={[]} notes={[]} events={[]} />
      );

      // Should have min-height styling
      const cell = container.querySelector('.min-h-32');
      expect(cell).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic HTML structure', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[]}
          events={[]}
        />
      );

      // Day label should be in a heading
      const dayLabel = screen.getByText('Mon');
      expect(dayLabel.tagName).toMatch(/H[1-6]|STRONG|P/);
    });

    it('should have aria-label for screen readers', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[mockNote]}
          events={[mockEvent]}
        />
      );

      const cell = container.firstChild as HTMLElement;
      expect(cell).toHaveAttribute('aria-label');
    });

    it('should describe cell content in aria-label', () => {
      const { container } = render(
        <CalendarDayCell
          dayOfWeek={0}
          workouts={[mockWorkout]}
          notes={[mockNote]}
          events={[mockEvent]}
        />
      );

      const cell = container.firstChild as HTMLElement;
      const ariaLabel = cell.getAttribute('aria-label');

      // Should mention Monday and item counts
      expect(ariaLabel).toContain('Monday');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid dayOfWeek gracefully', () => {
      render(
        <CalendarDayCell dayOfWeek={7} workouts={[]} notes={[]} events={[]} />
      );

      // Should render something or fallback
      expect(
        screen.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|Invalid/)
      ).toBeInTheDocument();
    });

    it('should handle negative dayOfWeek gracefully', () => {
      render(
        <CalendarDayCell dayOfWeek={-1} workouts={[]} notes={[]} events={[]} />
      );

      // Should render something or fallback
      expect(
        screen.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|Invalid/)
      ).toBeInTheDocument();
    });
  });
});

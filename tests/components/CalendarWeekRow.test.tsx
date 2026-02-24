/**
 * Unit tests for CalendarWeekRow component
 *
 * Tests calendar week row rendering with 7 day cells
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarWeekRow } from '@/popup/components/CalendarWeekRow';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

// Mock data
const mockWorkout: PlanWorkout = {
  workoutId: 1,
  athleteId: 123,
  title: 'Monday Workout',
  workoutTypeValueId: 3,
  code: null,
  workoutDay: '2026-02-24',
  startTime: null,
  startTimePlanned: null,
  isItAnOr: false,
  isHidden: false,
  completed: false,
  description: null,
  userTags: null,
  coachComments: null,
  workoutComments: null,
  newComment: null,
  hasPrivateWorkoutNoteForCaller: false,
  publicSettingValue: 0,
  sharedWorkoutInformationKey: null,
  sharedWorkoutInformationExpireKey: null,
  distance: null,
  distancePlanned: 5000,
  distanceCustomized: null,
  distanceUnitsCustomized: null,
  totalTime: null,
  totalTimePlanned: 1.0,
  heartRateMinimum: null,
  heartRateMaximum: null,
  heartRateAverage: null,
  calories: null,
  caloriesPlanned: null,
  tssActual: null,
  tssPlanned: 50,
  tssSource: null,
  if: null,
  ifPlanned: null,
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
  title: 'Week note',
  description: 'Focus on recovery',
  noteDate: '2026-02-25',
  createdDate: '2026-02-01T00:00:00Z',
  modifiedDate: '2026-02-01T00:00:00Z',
  planId: 456,
  attachments: [],
};

const mockEvent: CalendarEvent = {
  id: 1,
  planId: 456,
  eventDate: '2026-03-02',
  name: 'Race Day',
  eventType: 'Run',
  description: null,
  comment: null,
  distance: 10,
  distanceUnits: 'km',
  legs: [],
};

describe('CalendarWeekRow', () => {
  describe('week number rendering', () => {
    it('should render week number 1', () => {
      render(<CalendarWeekRow weekNumber={1} weekData={new Map()} />);

      expect(screen.getByText('Week 1')).toBeInTheDocument();
    });

    it('should render week number 2', () => {
      render(<CalendarWeekRow weekNumber={2} weekData={new Map()} />);

      expect(screen.getByText('Week 2')).toBeInTheDocument();
    });

    it('should render week number 10', () => {
      render(<CalendarWeekRow weekNumber={10} weekData={new Map()} />);

      expect(screen.getByText('Week 10')).toBeInTheDocument();
    });

    it('should display week number prominently', () => {
      render(<CalendarWeekRow weekNumber={1} weekData={new Map()} />);

      const weekLabel = screen.getByText('Week 1');
      expect(weekLabel.tagName).toMatch(/H[1-6]|STRONG|P/);
    });
  });

  describe('day cells rendering', () => {
    it('should render 7 day cells', () => {
      render(<CalendarWeekRow weekNumber={1} weekData={new Map()} />);

      // Check for all day labels
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('should render day cells in correct order (Mon-Sun)', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      const dayLabels = container.textContent || '';
      const monIndex = dayLabels.indexOf('Mon');
      const tueIndex = dayLabels.indexOf('Tue');
      const sunIndex = dayLabels.indexOf('Sun');

      expect(monIndex).toBeLessThan(tueIndex);
      expect(tueIndex).toBeLessThan(sunIndex);
    });
  });

  describe('data distribution', () => {
    it('should pass Monday data to Monday cell (dayOfWeek=0)', () => {
      const weekData = new Map();
      weekData.set(0, {
        workouts: [mockWorkout],
        notes: [],
        events: [],
      });

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      expect(screen.getByText('Monday Workout')).toBeInTheDocument();
    });

    it('should pass Tuesday data to Tuesday cell (dayOfWeek=1)', () => {
      const weekData = new Map();
      weekData.set(1, {
        workouts: [],
        notes: [mockNote],
        events: [],
      });

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      expect(screen.getByText('Week note')).toBeInTheDocument();
    });

    it('should pass Sunday data to Sunday cell (dayOfWeek=6)', () => {
      const weekData = new Map();
      weekData.set(6, {
        workouts: [],
        notes: [],
        events: [mockEvent],
      });

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      expect(screen.getByText('Race Day')).toBeInTheDocument();
    });

    it('should handle multiple days with data', () => {
      const weekData = new Map();
      weekData.set(0, {
        workouts: [mockWorkout],
        notes: [],
        events: [],
      });
      weekData.set(3, {
        workouts: [],
        notes: [mockNote],
        events: [],
      });
      weekData.set(6, {
        workouts: [],
        notes: [],
        events: [mockEvent],
      });

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      expect(screen.getByText('Monday Workout')).toBeInTheDocument();
      expect(screen.getByText('Week note')).toBeInTheDocument();
      expect(screen.getByText('Race Day')).toBeInTheDocument();
    });

    it('should pass empty arrays to days without data', () => {
      const weekData = new Map();
      weekData.set(0, {
        workouts: [mockWorkout],
        notes: [],
        events: [],
      });

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      // Monday has workout
      expect(screen.getByText('Monday Workout')).toBeInTheDocument();

      // Other days should be empty (only day labels)
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      // But no workout/note/event content for those days
    });
  });

  describe('grid layout', () => {
    it('should use CSS Grid for layout', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      // Should have grid layout
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should have 8 columns (week number + 7 days)', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      // Should have grid-cols-8 class
      const gridContainer = container.querySelector('.grid-cols-8');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should have proper spacing between cells', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      // Should have gap between cells (gap-0 means no gap, which is fine for tight calendar)
      const gridContainer = container.querySelector('.gap-0');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have row borders', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      const row = container.querySelector('.border');
      expect(row).toBeInTheDocument();
    });

    it('should have week number column styled differently', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      // Week number should have background color
      const weekCell = container.querySelector('.bg-gray-100');
      expect(weekCell).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic HTML structure', () => {
      render(<CalendarWeekRow weekNumber={1} weekData={new Map()} />);

      // Week number should be in a heading
      const weekLabel = screen.getByText('Week 1');
      expect(weekLabel.tagName).toMatch(/H[1-6]|STRONG|P/);
    });

    it('should have aria-label for screen readers', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={1} weekData={new Map()} />
      );

      const row = container.firstChild as HTMLElement;
      expect(row).toHaveAttribute('aria-label');
    });

    it('should describe week in aria-label', () => {
      const { container } = render(
        <CalendarWeekRow weekNumber={5} weekData={new Map()} />
      );

      const row = container.firstChild as HTMLElement;
      const ariaLabel = row.getAttribute('aria-label');

      // Should mention week number
      expect(ariaLabel).toContain('Week 5');
    });
  });

  describe('edge cases', () => {
    it('should handle week 0', () => {
      render(<CalendarWeekRow weekNumber={0} weekData={new Map()} />);

      expect(screen.getByText('Week 0')).toBeInTheDocument();
    });

    it('should handle large week numbers', () => {
      render(<CalendarWeekRow weekNumber={52} weekData={new Map()} />);

      expect(screen.getByText('Week 52')).toBeInTheDocument();
    });

    it('should handle empty weekData map', () => {
      render(<CalendarWeekRow weekNumber={1} weekData={new Map()} />);

      // Should still render all 7 days
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('should handle weekData with missing day entries', () => {
      const weekData = new Map();
      weekData.set(0, {
        workouts: [mockWorkout],
        notes: [],
        events: [],
      });
      // Days 1-6 are missing

      render(<CalendarWeekRow weekNumber={1} weekData={weekData} />);

      // Should still render all 7 day cells
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });
  });
});

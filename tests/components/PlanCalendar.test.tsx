/**
 * Unit tests for PlanCalendar component
 *
 * Tests main calendar container with data fetching and organization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlanCalendar } from '@/popup/components/PlanCalendar';
import * as usePlanWorkoutsModule from '@/hooks/usePlanWorkouts';
import * as usePlanNotesModule from '@/hooks/usePlanNotes';
import * as usePlanEventsModule from '@/hooks/usePlanEvents';
import type {
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';

// Mock the hooks
vi.mock('@/hooks/usePlanWorkouts');
vi.mock('@/hooks/usePlanNotes');
vi.mock('@/hooks/usePlanEvents');

// Mock data
const mockWorkout: PlanWorkout = {
  workoutId: 1,
  athleteId: 123,
  title: 'Week 1 Workout',
  workoutTypeValueId: 3,
  code: null,
  workoutDay: '2026-02-24', // Monday
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

const mockWorkout2: PlanWorkout = {
  ...mockWorkout,
  workoutId: 2,
  title: 'Week 2 Workout',
  workoutDay: '2026-03-02', // Following Monday (Week 2)
};

const mockNote: CalendarNote = {
  id: 1,
  title: 'Week 1 Note',
  description: 'Recovery week',
  noteDate: '2026-02-25', // Tuesday
  createdDate: '2026-02-01T00:00:00Z',
  modifiedDate: '2026-02-01T00:00:00Z',
  planId: 456,
  attachments: [],
};

const mockEvent: CalendarEvent = {
  id: 1,
  planId: 456,
  eventDate: '2026-03-01', // Sunday
  name: 'Race',
  eventType: 'Run',
  description: null,
  comment: null,
  distance: 10,
  distanceUnits: 'km',
  legs: [],
};

// Helper to create QueryClient for tests
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// Helper to render with QueryClient
function renderWithQueryClient(
  ui: React.ReactElement
): ReturnType<typeof render> {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('PlanCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner when workouts are loading', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Loading training plan...')).toBeInTheDocument();
    });

    it('should show loading spinner when notes are loading', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Loading training plan...')).toBeInTheDocument();
    });

    it('should show loading spinner when events are loading', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Loading training plan...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when workouts fail to load', () => {
      const error = new Error('Failed to load workouts');
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: vi.fn(),
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(
        screen.getAllByText(/failed to load workouts/i).length
      ).toBeGreaterThan(0);
    });

    it('should show error message when notes fail to load', () => {
      const error = new Error('Failed to load notes');
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: vi.fn(),
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(
        screen.getAllByText(/failed to load notes/i).length
      ).toBeGreaterThan(0);
    });

    it('should show error message when events fail to load', () => {
      const error = new Error('Failed to load events');
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: vi.fn(),
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(
        screen.getAllByText(/failed to load events/i).length
      ).toBeGreaterThan(0);
    });

    it('should show retry button on error', () => {
      const refetch = vi.fn();
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed'),
        refetch,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no data', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(
        screen.getByText(/no workouts, notes, or events/i)
      ).toBeInTheDocument();
    });
  });

  describe('calendar rendering', () => {
    it('should render calendar header with day labels', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      // Should show day labels in header (multiple Mon, Tue, etc. due to header + cells)
      expect(screen.getAllByText('Mon').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Tue').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sun').length).toBeGreaterThan(0);
    });

    it('should render week rows based on data', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout, mockWorkout2],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      // Should render Week 1 and Week 2
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
    });

    it('should display workouts in correct weeks', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout, mockWorkout2],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Week 1 Workout')).toBeInTheDocument();
      expect(screen.getByText('Week 2 Workout')).toBeInTheDocument();
    });

    it('should display notes in correct weeks', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [mockNote],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Week 1 Note')).toBeInTheDocument();
    });

    it('should display events in correct weeks', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [mockEvent],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText('Race')).toBeInTheDocument();
    });

    it('should organize all data types together', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout, mockWorkout2],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [mockNote],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [mockEvent],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      // All items should be visible
      expect(screen.getByText('Week 1 Workout')).toBeInTheDocument();
      expect(screen.getByText('Week 2 Workout')).toBeInTheDocument();
      expect(screen.getByText('Week 1 Note')).toBeInTheDocument();
      expect(screen.getByText('Race')).toBeInTheDocument();
    });
  });

  describe('back button', () => {
    it('should render back button when onBack is provided', () => {
      const onBack = vi.fn();
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} onBack={onBack} />);

      expect(screen.getByText('Back to Plans')).toBeInTheDocument();
    });

    it('should call onBack when back button is clicked', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} onBack={onBack} />);

      const backButton = screen.getByText('Back to Plans');
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('plan name display', () => {
    it('should display plan name when provided', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(
        <PlanCalendar planId={123} planName="Marathon Training" />
      );

      expect(screen.getByText('Marathon Training')).toBeInTheDocument();
    });

    it('should show default title when no plan name provided', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      expect(screen.getByText(/training plan/i)).toBeInTheDocument();
    });
  });

  describe('date calculations', () => {
    it('should start calendar from earliest date', () => {
      // Workout on Feb 24 (Monday)
      // Note on Feb 25 (Tuesday)
      // Event on Mar 1 (Sunday)
      // All should be in Week 1 based on Feb 24 start
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [mockNote],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [mockEvent],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} />);

      // All items should be in Week 1
      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 1 Workout')).toBeInTheDocument();
      expect(screen.getByText('Week 1 Note')).toBeInTheDocument();
      expect(screen.getByText('Race')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic HTML structure', () => {
      vi.spyOn(usePlanWorkoutsModule, 'usePlanWorkouts').mockReturnValue({
        data: [mockWorkout],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanNotesModule, 'usePlanNotes').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);
      vi.spyOn(usePlanEventsModule, 'usePlanEvents').mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderWithQueryClient(<PlanCalendar planId={123} planName="Test Plan" />);

      // Plan name should be in a heading
      const planName = screen.getByText('Test Plan');
      expect(planName.tagName).toMatch(/H[1-6]/);
    });
  });
});

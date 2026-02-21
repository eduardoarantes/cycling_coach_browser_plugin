/**
 * Unit tests for TrainingPeaks Training Plans API functions
 *
 * Tests all training plan API methods with mocked fetch and chrome.storage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchTrainingPlans,
  fetchPlanWorkouts,
  fetchPlanNotes,
  fetchPlanEvents,
} from '@/background/api/trainingPeaks';
import type {
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/schemas/trainingPlan.schema';

// Mock chrome.storage.local
const mockGet = vi.fn();
const mockRemove = vi.fn();

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Setup chrome mock
  global.chrome = {
    storage: {
      local: {
        get: mockGet,
        remove: mockRemove,
      },
    },
  } as any;

  // Setup fetch mock
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trainingPeaks Training Plans API', () => {
  describe('fetchTrainingPlans', () => {
    it('should return training plans array when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockPlans: TrainingPlan[] = [
        {
          planAccess: {
            planAccessId: 1,
            personId: 12345,
            planId: 100,
            accessFromPayment: false,
            accessFromShare: true,
            grantedFromPersonId: 54321,
            planAccessType: 1,
          },
          planId: 100,
          planPersonId: 12345,
          ownerPersonId: 54321,
          createdOn: '2024-01-15T10:00:00Z',
          title: 'Marathon Training Plan',
          author: 'Coach Smith',
          planEmail: 'coach@example.com',
          planLanguage: 'en',
          dayCount: 84,
          weekCount: 12,
          startDate: '2024-03-01',
          endDate: '2024-05-23',
          workoutCount: 48,
          eventCount: 1,
          description: 'A comprehensive 12-week marathon training plan',
          planCategory: 1,
          subcategory: null,
          additionalCriteria: null,
          eventPlan: true,
          eventName: 'City Marathon',
          eventDate: '2024-05-23',
          forceDate: false,
          isDynamic: false,
          isPublic: true,
          isSearchable: true,
          price: null,
          customUrl: 0,
          hasWeeklyGoals: true,
          sampleWeekOne: null,
          sampleWeekTwo: null,
        },
      ];

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPlans,
      });

      // Act
      const result = await fetchTrainingPlans();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockPlans);
        expect(result.data).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/plans/v1/plansWithAccess',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer valid-token-123',
          }),
        })
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchTrainingPlans();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Not authenticated');
        expect(result.error.code).toBe('NO_TOKEN');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchTrainingPlans();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Act
      const result = await fetchTrainingPlans();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ invalid: 'schema' }],
      });

      // Act
      const result = await fetchTrainingPlans();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });

  describe('fetchPlanWorkouts', () => {
    const planId = 100;

    it('should return plan workouts array when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockWorkouts: PlanWorkout[] = [
        {
          workoutId: 1001,
          athleteId: 12345,
          title: 'Easy Run',
          workoutTypeValueId: 3,
          code: 'RUN01',
          workoutDay: '2024-03-01',
          startTime: null,
          startTimePlanned: null,
          isItAnOr: false,
          isHidden: false,
          completed: false,
          description: 'Easy 5k run at conversational pace',
          userTags: null,
          coachComments: 'Focus on maintaining steady pace',
          workoutComments: null,
          newComment: null,
          hasPrivateWorkoutNoteForCaller: false,
          publicSettingValue: 1,
          sharedWorkoutInformationKey: null,
          sharedWorkoutInformationExpireKey: null,
          distance: null,
          distancePlanned: 5000,
          distanceCustomized: null,
          distanceUnitsCustomized: null,
          totalTime: null,
          totalTimePlanned: 1800,
          heartRateMinimum: null,
          heartRateMaximum: null,
          heartRateAverage: null,
          calories: null,
          caloriesPlanned: 400,
          tssActual: null,
          tssPlanned: 45,
          tssSource: null,
          if: null,
          ifPlanned: 0.65,
          velocityAverage: null,
          velocityPlanned: 10.0,
          velocityMaximum: null,
          normalizedSpeedActual: null,
          normalizedPowerActual: null,
          powerAverage: null,
          powerMaximum: null,
          energy: null,
          energyPlanned: null,
          elevationGain: null,
          elevationGainPlanned: 50,
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
          lastModifiedDate: '2024-02-20T10:00:00Z',
          equipmentBikeId: null,
          equipmentShoeId: null,
          isLocked: false,
          complianceDurationPercent: null,
          complianceDistancePercent: null,
          complianceTssPercent: null,
          rpe: null,
          feeling: null,
          structure: null,
          orderOnDay: 1,
          personalRecordCount: null,
          syncedTo: null,
          poolLengthOptionId: null,
          workoutSubTypeId: null,
          workoutDeviceSource: null,
        },
      ];

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockWorkouts,
      });

      // Act
      const result = await fetchPlanWorkouts(planId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockWorkouts);
        expect(result.data).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/plans/v1/plans/100/workouts/2010-12-15/2038-09-13',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer valid-token-123',
          }),
        })
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchPlanWorkouts(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_TOKEN');
      }
    });

    it('should return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchPlanWorkouts(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return error on 404 (plan not found)', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await fetchPlanWorkouts(999);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Timeout'));

      // Act
      const result = await fetchPlanWorkouts(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Timeout');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ missing: 'required fields' }],
      });

      // Act
      const result = await fetchPlanWorkouts(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });

  describe('fetchPlanNotes', () => {
    const planId = 100;

    it('should return calendar notes array when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockNotes: CalendarNote[] = [
        {
          id: 501,
          title: 'Week 1 Focus',
          description: 'Build aerobic base this week. Keep intensity low.',
          noteDate: '2024-03-01',
          createdDate: '2024-02-15T10:00:00Z',
          modifiedDate: '2024-02-15T10:00:00Z',
          planId: 100,
          attachments: [],
        },
      ];

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockNotes,
      });

      // Act
      const result = await fetchPlanNotes(planId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockNotes);
        expect(result.data).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/plans/v1/plans/100/calendarNote/2010-12-15/2038-09-13',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer valid-token-123',
          }),
        })
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchPlanNotes(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_TOKEN');
      }
    });

    it('should return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchPlanNotes(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return error on 404 (plan not found)', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await fetchPlanNotes(999);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await fetchPlanNotes(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Connection failed');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ invalid: 'data' }],
      });

      // Act
      const result = await fetchPlanNotes(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });

  describe('fetchPlanEvents', () => {
    const planId = 100;

    it('should return calendar events array when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockEvents: CalendarEvent[] = [
        {
          id: 601,
          planId: 100,
          eventDate: '2024-05-23',
          name: 'City Marathon',
          eventType: 'Race',
          description: 'Full marathon - 42.2km',
          comment: 'Target time: 3:30:00',
          distance: 42.2,
          distanceUnits: 'km',
          legs: [],
        },
      ];

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockEvents,
      });

      // Act
      const result = await fetchPlanEvents(planId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockEvents);
        expect(result.data).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/plans/v1/plans/100/events/2010-12-15/2038-09-13',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer valid-token-123',
          }),
        })
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchPlanEvents(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_TOKEN');
      }
    });

    it('should return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchPlanEvents(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
    });

    it('should return error on 404 (plan not found)', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await fetchPlanEvents(999);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await fetchPlanEvents(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Service unavailable');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ incomplete: 'event' }],
      });

      // Act
      const result = await fetchPlanEvents(planId);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });
});

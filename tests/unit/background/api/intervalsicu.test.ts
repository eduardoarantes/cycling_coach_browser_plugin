/**
 * Unit tests for Intervals.icu API client
 *
 * Tests direct upload to Intervals.icu API with Basic Auth
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LibraryItem } from '@/schemas/library.schema';
import { exportToIntervals } from '@/background/api/intervalsicu';
import * as intervalsApiKeyService from '@/services/intervalsApiKeyService';

// Mock the API key service
vi.mock('@/services/intervalsApiKeyService');

describe('exportToIntervals', () => {
  const mockApiKey = 'test-api-key-12345';
  const mockWorkout: LibraryItem = {
    exerciseLibraryId: 1,
    exerciseLibraryItemId: 123456,
    exerciseLibraryItemType: 'workout',
    itemName: 'Sweet Spot Intervals',
    workoutTypeId: 2, // Bike
    totalTimePlanned: 2.0, // 2 hours
    tssPlanned: 85,
    distancePlanned: 50,
    elevationGainPlanned: 500,
    caloriesPlanned: 850,
    velocityPlanned: 25,
    energyPlanned: 200,
    ifPlanned: 0.88,
    description: '4x10min @ 88-93% FTP with 5min recovery',
    coachComments: 'Focus on smooth power delivery',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API key retrieval by default
    vi.mocked(intervalsApiKeyService.getIntervalsApiKey).mockResolvedValue(
      mockApiKey
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful export', () => {
    it('should export single workout successfully', async () => {
      const mockResponse = [
        {
          id: 789,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Sweet Spot Intervals',
          icu_training_load: 85,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockResponse);
        expect(result.data.length).toBe(1);
        expect(result.data[0].id).toBe(789);
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Basic ${btoa(`API_KEY:${mockApiKey}`)}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should export multiple workouts in batch', async () => {
      const workout2: LibraryItem = {
        ...mockWorkout,
        exerciseLibraryItemId: 123457,
        itemName: 'Endurance Ride',
        workoutTypeId: 2,
      };

      const mockResponse = [
        {
          id: 789,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
        },
        {
          id: 790,
          start_date_local: '2024-02-25',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await exportToIntervals(
        [mockWorkout, workout2],
        ['2024-02-24', '2024-02-25']
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }

      // Verify batch request
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body).toHaveLength(2);
    });

    it('should include comprehensive description with all metadata', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      const description = body[0].description;

      // Check that description includes all metadata
      expect(description).toContain('4x10min @ 88-93% FTP'); // Main description
      expect(description).toContain('Coach Notes'); // Coach comments section
      expect(description).toContain('Focus on smooth power delivery');
      expect(description).toContain('IF: 0.88');
      expect(description).toContain('Distance: 50');
      expect(description).toContain('Elevation: 500m');
      expect(description).toContain('Calories: 850');
    });

    it('should handle workout with minimal metadata', async () => {
      const minimalWorkout: LibraryItem = {
        exerciseLibraryId: 1,
        exerciseLibraryItemId: 999,
        exerciseLibraryItemType: 'workout',
        itemName: 'Simple Run',
        workoutTypeId: 1, // Run
        totalTimePlanned: null,
        tssPlanned: null,
        distancePlanned: null,
        elevationGainPlanned: null,
        caloriesPlanned: null,
        velocityPlanned: null,
        energyPlanned: null,
        ifPlanned: null,
        description: null,
        coachComments: null,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 800,
            start_date_local: '2024-02-24',
            type: 'Run',
            category: 'WORKOUT',
          },
        ],
      });

      const result = await exportToIntervals([minimalWorkout], ['2024-02-24']);

      expect(result.success).toBe(true);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].name).toBe('Simple Run');
      expect(body[0].description).toBeTruthy(); // Should not be empty
    });
  });

  describe('sport type mapping', () => {
    const testCases = [
      { workoutTypeId: 1, expectedType: 'Run', sportName: 'Run' },
      { workoutTypeId: 2, expectedType: 'Ride', sportName: 'Bike' },
      { workoutTypeId: 3, expectedType: 'Swim', sportName: 'Swim' },
      {
        workoutTypeId: 13,
        expectedType: 'WeightTraining',
        sportName: 'Strength',
      },
      { workoutTypeId: 999, expectedType: 'Ride', sportName: 'Unknown' }, // Fallback
    ];

    testCases.forEach(({ workoutTypeId, expectedType, sportName }) => {
      it(`should map ${sportName} (workoutTypeId ${workoutTypeId}) to ${expectedType}`, async () => {
        const workout: LibraryItem = {
          ...mockWorkout,
          workoutTypeId,
        };

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [
            {
              id: 789,
              start_date_local: '2024-02-24',
              type: expectedType,
              category: 'WORKOUT',
            },
          ],
        });

        await exportToIntervals([workout], ['2024-02-24']);

        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body[0].type).toBe(expectedType);
      });
    });
  });

  describe('workout transformation', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });
    });

    it('should transform duration from hours to seconds', async () => {
      const workout: LibraryItem = {
        ...mockWorkout,
        totalTimePlanned: 1.5, // 1.5 hours
      };

      await exportToIntervals([workout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].moving_time).toBe(5400); // 1.5 * 3600 = 5400 seconds
    });

    it('should handle null duration', async () => {
      const workout: LibraryItem = {
        ...mockWorkout,
        totalTimePlanned: null,
      };

      await exportToIntervals([workout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].moving_time).toBeUndefined();
    });

    it('should include TSS as icu_training_load', async () => {
      const workout: LibraryItem = {
        ...mockWorkout,
        tssPlanned: 120,
      };

      await exportToIntervals([workout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].icu_training_load).toBe(120);
    });

    it('should handle null TSS', async () => {
      const workout: LibraryItem = {
        ...mockWorkout,
        tssPlanned: null,
      };

      await exportToIntervals([workout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].icu_training_load).toBeUndefined();
    });

    it('should format start date as ISO 8601', async () => {
      await exportToIntervals([mockWorkout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].start_date_local).toBe('2024-02-24T00:00:00');
    });

    it('should set category to WORKOUT', async () => {
      await exportToIntervals([mockWorkout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].category).toBe('WORKOUT');
    });

    it('should generate external_id from exerciseLibraryItemId', async () => {
      const workout: LibraryItem = {
        ...mockWorkout,
        exerciseLibraryItemId: 123456,
      };

      await exportToIntervals([workout], ['2024-02-24']);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body[0].external_id).toBe('tp_123456');
    });
  });

  describe('error handling', () => {
    it('should return error when API key is not configured', async () => {
      vi.mocked(intervalsApiKeyService.getIntervalsApiKey).mockResolvedValue(
        null
      );

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe(
          'Intervals.icu API key not configured'
        );
        expect(result.error.code).toBe('NO_API_KEY');
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle 401 Unauthorized (invalid API key)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid Intervals.icu API key');
        expect(result.error.code).toBe('INVALID_API_KEY');
        expect(result.error.status).toBe(401);
      }
    });

    it('should handle 500 Server Error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Intervals.icu API error: 500');
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.status).toBe(500);
      }
    });

    it('should handle network errors', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network connection failed'));

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Network connection failed');
        expect(result.error.code).toBe('EXPORT_ERROR');
      }
    });

    it('should handle Zod validation failure on response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            // Missing required 'id' field
            start_date_local: '2024-02-24',
            type: 'Ride',
          },
        ],
      });

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('EXPORT_ERROR');
      }
    });

    it('should handle malformed JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid JSON');
      }
    });
  });

  describe('authentication', () => {
    it('should use Basic Auth with API_KEY prefix', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      const expectedAuth = btoa(`API_KEY:${mockApiKey}`);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedAuth}`,
          }),
        })
      );
    });

    it('should retrieve API key from service', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(intervalsApiKeyService.getIntervalsApiKey).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('API endpoint', () => {
    it('should use correct endpoint with upsert parameter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true',
        expect.any(Object)
      );
    });

    it('should use POST method', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should send JSON content type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 789,
            start_date_local: '2024-02-24',
            type: 'Ride',
            category: 'WORKOUT',
          },
        ],
      });

      await exportToIntervals([mockWorkout], ['2024-02-24']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});

/**
 * Unit tests for Intervals.icu API client (Redesigned)
 *
 * Tests folder creation and workout template export (NOT calendar events)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LibraryItem } from '@/schemas/library.schema';
import {
  createIntervalsFolder,
  exportWorkoutsToLibrary,
} from '@/background/api/intervalsicu';
import * as intervalsApiKeyService from '@/services/intervalsApiKeyService';

// Mock the API key service
vi.mock('@/services/intervalsApiKeyService');

describe('Intervals.icu API Client - Redesigned', () => {
  const mockApiKey = 'test-api-key-12345';
  const mockAthleteId = 12345;
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

  /**
   * Helper to mock fetch calls with athlete + folder/workout responses
   */
  function mockFetchWithAthlete(
    secondResponse: unknown,
    secondOk: boolean = true
  ): void {
    const athleteResponse = {
      id: mockAthleteId,
      name: 'Test Athlete',
      email: 'test@example.com',
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: getCurrentAthlete()
        return Promise.resolve({
          ok: true,
          json: async () => athleteResponse,
        });
      } else {
        // Second call: folder/workout operation
        return Promise.resolve({
          ok: secondOk,
          status: secondOk ? 200 : 500,
          text: async () => (secondOk ? 'OK' : 'Error'),
          json: async () => secondResponse,
        });
      }
    });
  }

  /**
   * Mock athlete fetch failure
   */
  function mockAthleteFailure(status: number = 401): void {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: async () => 'Error',
    });
  }

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

  describe('createIntervalsFolder', () => {
    describe('successful folder creation', () => {
      it('should create folder with name and description', async () => {
        const mockAthleteResponse = {
          id: mockAthleteId,
          name: 'Test Athlete',
          email: 'test@example.com',
        };

        const mockFolderResponse = {
          id: 456,
          name: 'Cycling Base Training',
          athlete_id: mockAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        // Mock both API calls: getCurrentAthlete() then createFolder()
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation((_url: string) => {
          callCount++;
          if (callCount === 1) {
            // First call: getCurrentAthlete()
            return Promise.resolve({
              ok: true,
              json: async () => mockAthleteResponse,
            });
          } else {
            // Second call: createIntervalsFolder()
            return Promise.resolve({
              ok: true,
              json: async () => mockFolderResponse,
            });
          }
        });

        const result = await createIntervalsFolder(
          'Cycling Base Training',
          'Base phase workouts'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(456);
          expect(result.data.name).toBe('Cycling Base Training');
          expect(result.data.athlete_id).toBe(mockAthleteId);
        }
      });

      it('should use correct endpoint POST /athlete/{athleteId}/folders', async () => {
        const mockAthleteResponse = {
          id: mockAthleteId,
          name: 'Test Athlete',
        };

        const mockFolderResponse = {
          id: 456,
          name: 'Test Folder',
          athlete_id: mockAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation((_url: string) => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => mockAthleteResponse,
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: async () => mockFolderResponse,
            });
          }
        });

        await createIntervalsFolder('Test Folder');

        // First call should be to get athlete info
        expect(global.fetch).toHaveBeenNthCalledWith(
          1,
          'https://intervals.icu/api/v1/athlete/0',
          expect.any(Object)
        );

        // Second call should use the real athlete ID
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          `https://intervals.icu/api/v1/athlete/${mockAthleteId}/folders`,
          expect.any(Object)
        );
      });

      it('should normalize athlete alias id=0 before calling folders endpoint', async () => {
        const mockAthleteResponse = {
          id: 0,
          athlete_id: mockAthleteId,
          name: 'Test Athlete',
        };

        const mockFolderResponse = {
          id: 456,
          name: 'Test Folder',
          athlete_id: mockAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => mockAthleteResponse,
            });
          }

          return Promise.resolve({
            ok: true,
            json: async () => mockFolderResponse,
          });
        });

        await createIntervalsFolder('Test Folder');

        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          `https://intervals.icu/api/v1/athlete/${mockAthleteId}/folders`,
          expect.any(Object)
        );
      });

      it('should use string athlete ID from /athlete/0 for folders endpoint', async () => {
        const stringAthleteId = 'i346347';
        const mockAthleteResponse = {
          id: stringAthleteId,
          name: 'Eduardo A Rodrigues',
        };

        const mockFolderResponse = {
          id: 456,
          name: 'Test Folder',
          athlete_id: stringAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => mockAthleteResponse,
            });
          }

          return Promise.resolve({
            ok: true,
            json: async () => mockFolderResponse,
          });
        });

        await createIntervalsFolder('Test Folder');

        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          `https://intervals.icu/api/v1/athlete/${stringAthleteId}/folders`,
          expect.any(Object)
        );
      });

      it('should use Basic Auth with API_KEY prefix', async () => {
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            ok: true,
            json: async () => {
              if (callCount === 1) {
                return { id: mockAthleteId, name: 'Test' };
              } else {
                return {
                  id: 456,
                  name: 'Test Folder',
                  athlete_id: mockAthleteId,
                  created: '2024-02-24T12:00:00Z',
                };
              }
            },
          });
        });

        await createIntervalsFolder('Test Folder');

        const expectedAuth = btoa(`API_KEY:${mockApiKey}`);

        // Both calls should use Basic Auth
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Basic ${expectedAuth}`,
            }),
          })
        );
      });

      it('should send POST request with JSON body', async () => {
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            ok: true,
            json: async () => {
              if (callCount === 1) {
                return { id: mockAthleteId, name: 'Test' };
              } else {
                return {
                  id: 456,
                  name: 'Test Folder',
                  athlete_id: mockAthleteId,
                  created: '2024-02-24T12:00:00Z',
                };
              }
            },
          });
        });

        await createIntervalsFolder('Test Folder', 'Test description');

        // Second call should be the folder creation POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const options = fetchCall[1];
        expect(options?.method).toBe('POST');
        expect(options?.headers).toMatchObject({
          'Content-Type': 'application/json',
        });

        const body = JSON.parse(options?.body as string);
        expect(body).toEqual({
          name: 'Test Folder',
          description: 'Test description',
        });
      });

      it('should validate response with IntervalsFolderResponseSchema', async () => {
        const mockResponse = {
          id: 456,
          name: 'Test Folder',
          athlete_id: mockAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        mockFetchWithAthlete(mockResponse);

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveProperty('id');
          expect(result.data).toHaveProperty('name');
          expect(result.data).toHaveProperty('athlete_id');
          expect(result.data).toHaveProperty('created');
        }
      });

      it('should return folder ID in response', async () => {
        const mockResponse = {
          id: 999,
          name: 'Test Folder',
          athlete_id: mockAthleteId,
          created: '2024-02-24T12:00:00Z',
        };

        mockFetchWithAthlete(mockResponse);

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(999);
        }
      });
    });

    describe('error handling', () => {
      it('should return error when no API key', async () => {
        vi.mocked(intervalsApiKeyService.getIntervalsApiKey).mockResolvedValue(
          null
        );

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NO_API_KEY');
          expect(result.error.message).toContain('API key not configured');
        }

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should handle 401 Unauthorized on athlete fetch', async () => {
        mockAthleteFailure(401);

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_API_KEY');
          expect(result.error.status).toBe(401);
        }
      });

      it('should handle 500 Server Error on athlete fetch', async () => {
        mockAthleteFailure(500);

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('API_ERROR');
          expect(result.error.status).toBe(500);
        }
      });

      it('should handle 401 Unauthorized on folder creation', async () => {
        // Athlete fetch succeeds, folder creation fails
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test' }),
            });
          } else {
            return Promise.resolve({
              ok: false,
              status: 401,
              text: async () => 'Unauthorized',
            });
          }
        });

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_API_KEY');
          expect(result.error.status).toBe(401);
        }
      });

      it('should handle network errors', async () => {
        global.fetch = vi
          .fn()
          .mockRejectedValue(new Error('Network connection failed'));

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Network connection failed');
        }
      });

      it('should handle malformed JSON response on athlete fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Invalid JSON');
        }
      });

      it('should handle Zod validation failure on athlete response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            // Missing required 'id' field
            name: 'Test Folder',
          }),
        });

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
      });

      it('should handle Zod validation failure on folder response', async () => {
        mockFetchWithAthlete({
          // Missing required 'id' field
          name: 'Test Folder',
        });

        const result = await createIntervalsFolder('Test Folder');

        expect(result.success).toBe(false);
      });
    });
  });

  describe('exportWorkoutsToLibrary', () => {
    describe('successful export', () => {
      it('should export single workout without folder', async () => {
        const mockResponse = {
          id: 789,
          name: 'Sweet Spot Intervals',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        };

        mockFetchWithAthlete(mockResponse);

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].id).toBe(789);
          expect(result.data[0].name).toBe('Sweet Spot Intervals');
        }
      });

      it('should export multiple workouts to specific folder', async () => {
        const workout2: LibraryItem = {
          ...mockWorkout,
          exerciseLibraryItemId: 123457,
          itemName: 'Endurance Ride',
          workoutTypeId: 2,
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            // First call: getCurrentAthlete()
            return {
              ok: true,
              json: async () => ({
                id: mockAthleteId,
                name: 'Test Athlete',
              }),
            };
          } else {
            // Subsequent calls: workout exports
            return {
              ok: true,
              json: async () => ({
                id: 789 + callCount - 1,
                name:
                  callCount === 2 ? 'Sweet Spot Intervals' : 'Endurance Ride',
                type: 'Ride',
                category: 'WORKOUT',
                athlete_id: mockAthleteId,
              }),
            };
          }
        });

        const result = await exportWorkoutsToLibrary(
          [mockWorkout, workout2],
          456
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(2);
          // 1 athlete call + 2 workout calls = 3 total
          expect(global.fetch).toHaveBeenCalledTimes(3);
        }
      });

      it('should NOT include start_date_local field in payload', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        // Second call is the workout POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        expect(body).not.toHaveProperty('start_date_local');
      });

      it('should include folder_id when provided', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout], 456);

        // Second call is the workout POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        expect(body.folder_id).toBe(456);
      });

      it('should transform workout name, description, type', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Sweet Spot Intervals',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        // Second call is the workout POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        expect(body.name).toBe('Sweet Spot Intervals');
        expect(body.type).toBe('Ride');
        expect(body.description).toContain('4x10min @ 88-93% FTP');
      });

      it('should include TP description and coach notes in Intervals description', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        // Second call is the workout POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        // Check for metadata in description
        expect(body.description).toContain('4x10min @ 88-93% FTP');
        expect(body.description).toContain('Coach Notes');
        expect(body.description).toContain('Focus on smooth power delivery');
        expect(body.description).not.toContain('IF: 0.88');
      });

      it('should render TP structure as Intervals text in description when present', async () => {
        const structuredWorkout: LibraryItem = {
          ...mockWorkout,
          structure: {
            structure: [
              {
                type: 'step',
                length: { unit: 'repetition', value: 1 },
                steps: [
                  {
                    name: 'Warm up',
                    intensityClass: 'warmUp',
                    length: { unit: 'second', value: 300 },
                    openDuration: false,
                    targets: [{ minValue: 40, maxValue: 50 }],
                  },
                ],
                begin: 0,
                end: 300,
              },
              {
                type: 'repetition',
                length: { unit: 'repetition', value: 3 },
                steps: [
                  {
                    name: 'Hard',
                    intensityClass: 'active',
                    length: { unit: 'second', value: 30 },
                    openDuration: false,
                    targets: [{ minValue: 120, maxValue: 150 }],
                  },
                  {
                    name: 'Easy',
                    intensityClass: 'rest',
                    length: { unit: 'second', value: 240 },
                    openDuration: false,
                    targets: [{ minValue: 50, maxValue: 60 }],
                  },
                ],
                begin: 0,
                end: 810,
              },
            ],
            primaryIntensityMetric: 'percentOfFtp',
            primaryLengthMetric: 'duration',
          },
        };

        mockFetchWithAthlete({
          id: 789,
          name: 'Sweet Spot Intervals',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([structuredWorkout]);

        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        expect(
          body.description.startsWith('- 5m 40-50% intensity=warmup')
        ).toBe(true);
        expect(body.description).toContain('- 5m 40-50% intensity=warmup');
        expect(body.description).toContain('3x');
        expect(body.description).toContain('- Hard 30s 120-150%');
        expect(body.description).toContain('- Easy 4m 50-60% intensity=rest');
        expect(body.description).toContain('- - - -');
        expect(body.description).toContain('Coach Notes:');
        expect(body.description).not.toContain('Workout Details:');
      });

      it('should set category to WORKOUT', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        // Second call is the workout POST
        const fetchCall = vi.mocked(global.fetch).mock.calls[1];
        const body = JSON.parse(fetchCall[1]?.body as string);

        expect(body.category).toBe('WORKOUT');
      });

      it('should make individual POST requests per workout', async () => {
        const workout2: LibraryItem = {
          ...mockWorkout,
          exerciseLibraryItemId: 123457,
          itemName: 'Workout 2',
        };
        const workout3: LibraryItem = {
          ...mockWorkout,
          exerciseLibraryItemId: 123458,
          itemName: 'Workout 3',
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test' }),
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                id: 789,
                name: 'Test',
                type: 'Ride',
                category: 'WORKOUT',
                athlete_id: mockAthleteId,
              }),
            });
          }
        });

        await exportWorkoutsToLibrary([mockWorkout, workout2, workout3]);

        // 1 athlete call + 3 workout calls = 4 total
        expect(global.fetch).toHaveBeenCalledTimes(4);
      });

      it('should use correct endpoint POST /athlete/{athleteId}/workouts', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        // First call: get athlete
        expect(global.fetch).toHaveBeenNthCalledWith(
          1,
          'https://intervals.icu/api/v1/athlete/0',
          expect.any(Object)
        );

        // Second call: create workout with real athlete ID
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          `https://intervals.icu/api/v1/athlete/${mockAthleteId}/workouts`,
          expect.any(Object)
        );
      });

      it('should use Basic Auth with API_KEY prefix', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        await exportWorkoutsToLibrary([mockWorkout]);

        const expectedAuth = btoa(`API_KEY:${mockApiKey}`);

        // Both calls should use Basic Auth
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Basic ${expectedAuth}`,
            }),
          })
        );
      });

      it('should validate each response with IntervalsWorkoutResponseSchema', async () => {
        mockFetchWithAthlete({
          id: 789,
          name: 'Test',
          type: 'Ride',
          category: 'WORKOUT',
          athlete_id: mockAthleteId,
        });

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[0]).toHaveProperty('id');
          expect(result.data[0]).toHaveProperty('name');
          expect(result.data[0]).toHaveProperty('type');
        }
      });
    });

    describe('sport type mapping', () => {
      const testCases = [
        { workoutTypeId: 1, expectedType: 'Swim', sportName: 'Swim' },
        { workoutTypeId: 2, expectedType: 'Ride', sportName: 'Bike' },
        { workoutTypeId: 3, expectedType: 'Run', sportName: 'Run' },
        {
          workoutTypeId: 9,
          expectedType: 'WeightTraining',
          sportName: 'Strength',
        },
        {
          workoutTypeId: 29,
          expectedType: 'WeightTraining',
          sportName: 'Strength (duplicate)',
        },
        { workoutTypeId: 11, expectedType: 'NordicSki', sportName: 'XC-Ski' },
        { workoutTypeId: 12, expectedType: 'Rowing', sportName: 'Rowing' },
        { workoutTypeId: 13, expectedType: 'Walk', sportName: 'Walk' },
        { workoutTypeId: 999, expectedType: 'Other', sportName: 'Unknown' },
      ];

      testCases.forEach(({ workoutTypeId, expectedType, sportName }) => {
        it(`should map ${sportName} (workoutTypeId ${workoutTypeId}) to ${expectedType}`, async () => {
          const workout: LibraryItem = {
            ...mockWorkout,
            workoutTypeId,
          };

          mockFetchWithAthlete({
            id: 789,
            name: 'Test',
            type: expectedType,
            category: 'WORKOUT',
            athlete_id: mockAthleteId,
          });

          await exportWorkoutsToLibrary([workout]);

          // Second call is the workout POST
          const fetchCall = vi.mocked(global.fetch).mock.calls[1];
          const body = JSON.parse(fetchCall[1]?.body as string);
          expect(body.type).toBe(expectedType);
        });
      });
    });

    describe('error handling', () => {
      it('should handle partial failures', async () => {
        const workout2: LibraryItem = {
          ...mockWorkout,
          exerciseLibraryItemId: 123457,
          itemName: 'Workout 2',
        };

        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            // First call: athlete succeeds
            return {
              ok: true,
              json: async () => ({
                id: mockAthleteId,
                name: 'Test Athlete',
              }),
            };
          } else if (callCount === 2) {
            // Second call: first workout succeeds
            return {
              ok: true,
              json: async () => ({
                id: 789,
                name: 'Workout 1',
                type: 'Ride',
                category: 'WORKOUT',
                athlete_id: mockAthleteId,
              }),
            };
          } else {
            // Third call: second workout fails
            return {
              ok: false,
              status: 500,
              text: async () => 'Server error',
            };
          }
        });

        const result = await exportWorkoutsToLibrary([mockWorkout, workout2]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Failed to export');
        }
      });

      it('should return error when no API key', async () => {
        vi.mocked(intervalsApiKeyService.getIntervalsApiKey).mockResolvedValue(
          null
        );

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NO_API_KEY');
        }

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should handle 401 Unauthorized on athlete fetch', async () => {
        mockAthleteFailure(401);

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_API_KEY');
          expect(result.error.status).toBe(401);
        }
      });

      it('should handle 401 Unauthorized on workout export', async () => {
        let callCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test' }),
            });
          } else {
            return Promise.resolve({
              ok: false,
              status: 401,
              text: async () => 'Unauthorized',
            });
          }
        });

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('INVALID_API_KEY');
          expect(result.error.status).toBe(401);
        }
      });

      it('should handle 500 Server Error on athlete fetch', async () => {
        mockAthleteFailure(500);

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('API_ERROR');
          expect(result.error.status).toBe(500);
        }
      });

      it('should handle network errors', async () => {
        global.fetch = vi
          .fn()
          .mockRejectedValue(new Error('Network connection failed'));

        const result = await exportWorkoutsToLibrary([mockWorkout]);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Network connection failed');
        }
      });
    });
  });
});

/**
 * Unit tests for Intervals.icu API client (Redesigned)
 *
 * Tests folder creation and workout template export (NOT calendar events)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LibraryItem } from '@/schemas/library.schema';
import type { RxBuilderWorkout } from '@/schemas/rxBuilder.schema';
import type {
  PlanWorkout,
  TrainingPlan,
  CalendarNote,
  CalendarEvent,
} from '@/schemas/trainingPlan.schema';
import {
  buildIntervalsPlanStartDateLocal,
  createIntervalsFolder,
  createIntervalsPlanFolder,
  exportTrainingPlanToIntervalsPlan,
  exportPlanWorkoutsToIntervalsPlan,
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

  const mockTrainingPlan = {
    planId: 999001,
    title: 'TP Build Plan',
    startDate: '2026-03-05T00:00:00',
    weekCount: 4,
    workoutCount: 12,
    description: 'TrainingPeaks plan description',
  } as unknown as TrainingPlan;

  function makePlanWorkout(overrides: Partial<PlanWorkout> = {}): PlanWorkout {
    return {
      workoutId: 1001,
      athleteId: 1,
      title: 'Plan Workout',
      workoutTypeValueId: 2,
      code: null,
      workoutDay: '2026-03-02T00:00:00',
      startTime: null,
      startTimePlanned: null,
      isItAnOr: false,
      isHidden: false,
      completed: null,
      description: 'Plan workout description',
      userTags: null,
      coachComments: null,
      workoutComments: null,
      newComment: null,
      hasPrivateWorkoutNoteForCaller: false,
      publicSettingValue: 0,
      sharedWorkoutInformationKey: null,
      sharedWorkoutInformationExpireKey: null,
      distance: null,
      distancePlanned: null,
      distanceCustomized: null,
      distanceUnitsCustomized: null,
      totalTime: null,
      totalTimePlanned: 1,
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
      lastModifiedDate: '2026-03-01T00:00:00',
      equipmentBikeId: null,
      equipmentShoeId: null,
      isLocked: null,
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
      ...overrides,
    } as PlanWorkout;
  }

  function makeRxBuilderWorkout(
    overrides: Partial<RxBuilderWorkout> = {}
  ): RxBuilderWorkout {
    return {
      id: 'rx-1001',
      calendarId: 1,
      title: 'Strength Session',
      instructions: 'Use controlled tempo',
      prescribedDate: '2026-03-02',
      prescribedStartTime: null,
      startDateTime: null,
      completedDateTime: null,
      orderOnDay: null,
      workoutType: 'StructuredStrength',
      workoutSubTypeId: null,
      isLocked: false,
      isHidden: false,
      totalBlocks: 2,
      completedBlocks: 0,
      totalPrescriptions: 2,
      completedPrescriptions: 0,
      totalSets: 6,
      completedSets: 0,
      compliancePercent: 0,
      sequenceSummary: [
        { sequenceOrder: 'A', title: 'Goblet Squat', compliancePercent: 0 },
        { sequenceOrder: 'B1', title: 'Split Squat', compliancePercent: 0 },
      ],
      rpe: 7,
      feel: null,
      prescribedDurationInSeconds: 1800,
      executedDurationInSeconds: null,
      lastUpdatedAt: '2026-03-01T00:00:00',
      ...overrides,
    } as RxBuilderWorkout;
  }

  function makeCalendarNote(
    overrides: Partial<CalendarNote> = {}
  ): CalendarNote {
    return {
      id: 4001,
      title: 'Note #1',
      description: 'Base phase note',
      noteDate: '2026-03-02T00:00:00',
      createdDate: '2026-03-01T00:00:00',
      modifiedDate: '2026-03-01T00:00:00',
      planId: mockTrainingPlan.planId,
      attachments: [],
      ...overrides,
    } as CalendarNote;
  }

  function makeCalendarEvent(
    overrides: Partial<CalendarEvent> = {}
  ): CalendarEvent {
    return {
      id: 5001,
      planId: mockTrainingPlan.planId,
      eventDate: '2026-03-02T00:00:00',
      name: 'Race Day',
      eventType: 'Race',
      description: 'A-priority race',
      comment: 'Taper into this event',
      distance: null,
      distanceUnits: null,
      legs: [],
      ...overrides,
    } as CalendarEvent;
  }

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
        expect(body.description).toContain('Pre workout comments');
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
        expect(body.description).toContain(
          '- Easy 4m 50-60% intensity=rest\n\n\n4x10min @ 88-93% FTP'
        );
        expect(body.description).not.toContain('- - - -');
        expect(body.description).toContain('Pre workout comments:');
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

  describe('plan export helpers', () => {
    it('should compute Monday start_date_local from earliest TP plan workout date', () => {
      const workouts = [
        makePlanWorkout({ workoutDay: '2026-03-10T00:00:00' }), // Tue
        makePlanWorkout({ workoutId: 1002, workoutDay: '2026-03-02T00:00:00' }), // Mon
      ];

      const result = buildIntervalsPlanStartDateLocal(
        mockTrainingPlan,
        workouts
      );

      expect(result).toBe('2026-03-02T00:00:00');
    });

    it('should create PLAN folder using TP training plan title as name', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 721356,
            name: mockTrainingPlan.title,
            athlete_id: mockAthleteId,
          }),
        });
      });

      const workouts = [makePlanWorkout({ workoutDay: '2026-03-03T00:00:00' })];
      const result = await createIntervalsPlanFolder(
        mockTrainingPlan,
        workouts
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.folder.name).toBe(mockTrainingPlan.title);
        expect(result.data.start_date_local).toBe('2026-03-02T00:00:00');
      }

      const [, options] = vi.mocked(global.fetch).mock.calls[1];
      const body = JSON.parse(options?.body as string);
      expect(body).toMatchObject({
        type: 'PLAN',
        name: mockTrainingPlan.title,
        start_date_local: '2026-03-02T00:00:00',
      });
    });

    it('should map plan workouts to zero-based day offsets (day 0 and day 8)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 8000 + callCount,
            name: 'Created Workout',
            type: 'Ride',
            category: 'WORKOUT',
            athlete_id: mockAthleteId,
            folder_id: 721356,
          }),
        });
      });

      const workouts = [
        makePlanWorkout({
          workoutId: 2001,
          title: 'Day Zero Workout',
          workoutDay: '2026-03-02T00:00:00',
        }),
        makePlanWorkout({
          workoutId: 2002,
          title: 'Next Week Workout',
          workoutDay: '2026-03-10T00:00:00',
        }),
      ];

      const result = await exportPlanWorkoutsToIntervalsPlan(
        workouts,
        721356,
        '2026-03-02T00:00:00'
      );

      expect(result.success).toBe(true);

      const firstWorkoutBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[1]?.[1]?.body as string
      );
      const secondWorkoutBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[2]?.[1]?.body as string
      );

      expect(firstWorkoutBody).toMatchObject({
        folder_id: 721356,
        name: 'Day Zero Workout',
        day: 0,
        for_week: false,
      });

      expect(secondWorkoutBody).toMatchObject({
        folder_id: 721356,
        name: 'Next Week Workout',
        day: 8,
        for_week: false,
      });
    });

    it('should fall back to a generated name when TP plan workout title is empty', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 8003,
            name: 'Created Workout',
            type: 'Ride',
            category: 'WORKOUT',
            athlete_id: mockAthleteId,
            folder_id: 721356,
          }),
        });
      });

      const workouts = [
        makePlanWorkout({
          workoutId: 3001,
          title: '   ',
          workoutDay: '2026-03-02T00:00:00',
        }),
      ];

      const result = await exportPlanWorkoutsToIntervalsPlan(
        workouts,
        721356,
        '2026-03-02T00:00:00'
      );

      expect(result.success).toBe(true);

      const requestBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[1]?.[1]?.body as string
      );

      expect(requestBody.name).toBe('TrainingPeaks Workout 3001');
    });

    it('should export RxBuilder strength workouts into the Intervals plan with WeightTraining type and day offset', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // createIntervalsPlanFolder -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        if (callCount === 2) {
          // createIntervalsPlanFolder -> POST /folders
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 721356,
              name: mockTrainingPlan.title,
              athlete_id: mockAthleteId,
            }),
          });
        }

        if (callCount === 3) {
          // exportRxBuilderWorkoutsToIntervalsPlan -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        // exportRxBuilderWorkoutsToIntervalsPlan -> POST /workouts
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9901,
            name: 'Strength Session',
            type: 'WeightTraining',
            category: 'WORKOUT',
            athlete_id: mockAthleteId,
            folder_id: 721356,
          }),
        });
      });

      const rxWorkouts = [
        makeRxBuilderWorkout({
          id: 'rx-2001',
          title: 'Lower Body Strength',
          prescribedDate: '2026-03-10', // day 8 from 2026-03-02 Monday anchor
        }),
      ];

      const result = await exportTrainingPlanToIntervalsPlan(
        mockTrainingPlan,
        [],
        rxWorkouts
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workouts).toHaveLength(1);
        expect(result.data.start_date_local).toBe('2026-03-09T00:00:00');
      }

      const folderBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[1]?.[1]?.body as string
      );
      expect(folderBody).toMatchObject({
        type: 'PLAN',
        name: mockTrainingPlan.title,
        start_date_local: '2026-03-09T00:00:00',
      });

      const workoutBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[3]?.[1]?.body as string
      );
      expect(workoutBody).toMatchObject({
        folder_id: 721356,
        type: 'WeightTraining',
        name: 'Lower Body Strength',
        day: 1,
        for_week: false,
        moving_time: 1800,
      });
      expect(workoutBody.description).toContain('Exercises:');
      expect(workoutBody.description).toContain('A. Goblet Squat');
      expect(workoutBody.description).toContain('Instructions:');
    });

    it('should export plan notes as NOTE items using the /workouts endpoint payload shape', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // createIntervalsPlanFolder -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        if (callCount === 2) {
          // createIntervalsPlanFolder -> POST /folders
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 721439,
              name: mockTrainingPlan.title,
              athlete_id: mockAthleteId,
            }),
          });
        }

        if (callCount === 3) {
          // exportPlanNotesToIntervalsPlan -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        // exportPlanNotesToIntervalsPlan -> POST /workouts
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9902,
            name: 'Note #1',
            type: 'NOTE',
            athlete_id: mockAthleteId,
            folder_id: 721439,
          }),
        });
      });

      const notes = [
        makeCalendarNote({
          title: 'Note #1 ',
          description:
            'This begins 8 weeks of Base efforts to set the stage for building phase workouts later on.',
        }),
      ];

      const result = await exportTrainingPlanToIntervalsPlan(
        mockTrainingPlan,
        [],
        [],
        notes
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workouts).toHaveLength(1);
        expect(result.data.workouts[0]?.type).toBe('NOTE');
      }

      const noteBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[3]?.[1]?.body as string
      );
      expect(noteBody).toMatchObject({
        name: 'Note #1',
        description:
          'This begins 8 weeks of Base efforts to set the stage for building phase workouts later on.',
        type: 'NOTE',
        color: 'green',
        day: 0,
        folder_id: 721439,
      });
      expect(noteBody).not.toHaveProperty('category');
    });

    it('should export plan events as category RACE_A items using the /workouts endpoint payload shape', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // createIntervalsPlanFolder -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        if (callCount === 2) {
          // createIntervalsPlanFolder -> POST /folders
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 721440,
              name: mockTrainingPlan.title,
              athlete_id: mockAthleteId,
            }),
          });
        }

        if (callCount === 3) {
          // exportPlanEventsToIntervalsPlan -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        // exportPlanEventsToIntervalsPlan -> POST /workouts
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9903,
            name: 'Event: Target Race',
            type: 'Ride',
            category: 'RACE_A',
            athlete_id: mockAthleteId,
            folder_id: 721440,
          }),
        });
      });

      const events = [
        makeCalendarEvent({
          name: 'Target Race',
          eventType: 'Bike',
          description: 'Season goal event',
          comment: 'Arrive fresh',
        }),
      ];

      const result = await exportTrainingPlanToIntervalsPlan(
        mockTrainingPlan,
        [],
        [],
        [],
        undefined,
        undefined,
        events
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workouts).toHaveLength(1);
        expect(result.data.workouts[0]?.type).toBe('Ride');
        expect(result.data.workouts[0]?.category).toBe('RACE_A');
      }

      const eventBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[3]?.[1]?.body as string
      );
      expect(eventBody).toMatchObject({
        name: 'Event: Target Race',
        description: 'Season goal event\n\nArrive fresh',
        type: 'Ride',
        category: 'RACE_A',
        day: 0,
        folder_id: 721440,
      });
      expect(eventBody).not.toHaveProperty('color');
    });

    it('should append to an existing Intervals PLAN folder when append strategy is selected', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url?: string) => {
        callCount++;

        if (callCount === 1) {
          // findIntervalsPlanFolderByName -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        if (callCount === 2) {
          // listIntervalsFolders -> GET /folders
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 721777,
                name: mockTrainingPlan.title,
                athlete_id: mockAthleteId,
                type: 'PLAN',
                start_date_local: '2026-03-02T00:00:00',
              },
            ],
          });
        }

        if (callCount === 3) {
          // exportPlanWorkoutsToIntervalsPlan -> getCurrentAthlete
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
          });
        }

        // exportPlanWorkoutsToIntervalsPlan -> POST /workouts
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 9910,
            name: 'Created Workout',
            type: 'Ride',
            category: 'WORKOUT',
            athlete_id: mockAthleteId,
            folder_id: 721777,
          }),
        });
      });

      const workouts = [
        makePlanWorkout({
          workoutId: 2101,
          title: 'Append Me',
          workoutDay: '2026-03-10T00:00:00',
        }),
      ];

      const result = await exportTrainingPlanToIntervalsPlan(
        mockTrainingPlan,
        workouts,
        [],
        [],
        undefined,
        'append'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.folder.id).toBe(721777);
        expect(result.data.start_date_local).toBe('2026-03-02T00:00:00');
      }

      expect(vi.mocked(global.fetch).mock.calls).toHaveLength(4);
      const listFoldersUrl = String(vi.mocked(global.fetch).mock.calls[1]?.[0]);
      expect(listFoldersUrl).toContain('/athlete/12345/folders');

      const workoutBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[3]?.[1]?.body as string
      );
      expect(workoutBody).toMatchObject({
        folder_id: 721777,
        name: 'Append Me',
        day: 8,
        for_week: false,
      });
    });

    it('should replace an existing Intervals PLAN folder when replace strategy is selected', async () => {
      let callCount = 0;
      global.fetch = vi
        .fn()
        .mockImplementation((_url?: string, options?: RequestInit) => {
          callCount++;

          if (callCount === 1) {
            // findIntervalsPlanFolderByName -> getCurrentAthlete
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
            });
          }

          if (callCount === 2) {
            // listIntervalsFolders -> GET /folders
            return Promise.resolve({
              ok: true,
              json: async () => [
                {
                  id: 721888,
                  name: mockTrainingPlan.title,
                  athlete_id: mockAthleteId,
                  type: 'PLAN',
                  start_date_local: '2026-03-02T00:00:00',
                },
              ],
            });
          }

          if (callCount === 3) {
            // deleteIntervalsFolder -> getCurrentAthlete
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
            });
          }

          if (callCount === 4) {
            // deleteIntervalsFolder -> DELETE /folders/{id}
            expect(options?.method).toBe('DELETE');
            return Promise.resolve({
              ok: true,
              text: async () => '',
            });
          }

          if (callCount === 5) {
            // createIntervalsPlanFolder -> getCurrentAthlete
            return Promise.resolve({
              ok: true,
              json: async () => ({ id: mockAthleteId, name: 'Test Athlete' }),
            });
          }

          // createIntervalsPlanFolder -> POST /folders
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 721999,
              name: mockTrainingPlan.title,
              athlete_id: mockAthleteId,
            }),
          });
        });

      const result = await exportTrainingPlanToIntervalsPlan(
        mockTrainingPlan,
        [],
        [],
        [],
        undefined,
        'replace'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.folder.id).toBe(721999);
      }

      const deleteUrl = String(vi.mocked(global.fetch).mock.calls[3]?.[0]);
      expect(deleteUrl).toContain('/athlete/12345/folders/721888');

      const createFolderUrl = String(
        vi.mocked(global.fetch).mock.calls[5]?.[0]
      );
      expect(createFolderUrl).toContain('/athlete/12345/folders');
      const createFolderBody = JSON.parse(
        vi.mocked(global.fetch).mock.calls[5]?.[1]?.body as string
      );
      expect(createFolderBody).toMatchObject({
        type: 'PLAN',
        name: mockTrainingPlan.title,
      });
    });
  });
});

/**
 * Unit tests for IntervalsIcuAdapter
 *
 * Tests the adapter implementation following TDD principles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntervalsIcuAdapter } from '@/export/adapters/intervalsicu/IntervalsIcuAdapter';
import type { LibraryItem } from '@/types';
import type {
  IntervalsIcuExportConfig,
  IntervalsEventResponse,
} from '@/types/intervalsicu.types';
import * as intervalsApi from '@/background/api/intervalsicu';

// Mock the API client
vi.mock('@/background/api/intervalsicu');

describe('IntervalsIcuAdapter', () => {
  let adapter: IntervalsIcuAdapter;

  beforeEach(() => {
    adapter = new IntervalsIcuAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('adapter metadata', () => {
    it('should have correct id', () => {
      expect(adapter.id).toBe('intervalsicu');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Intervals.icu');
    });

    it('should have correct description', () => {
      expect(adapter.description).toBe(
        'Export workouts to Intervals.icu calendar via API'
      );
    });

    it('should support api format', () => {
      expect(adapter.supportedFormats).toContain('api');
    });

    it('should have cycling icon', () => {
      expect(adapter.icon).toBeDefined();
    });
  });

  describe('transform', () => {
    const mockWorkout: LibraryItem = {
      exerciseLibraryItemId: 123456,
      itemName: 'Test Workout',
      description: 'Test description',
      workoutTypeId: 2, // Ride
      totalTimePlanned: 1.5, // 1.5 hours
      tssPlanned: 85,
      ifPlanned: 0.85,
      distancePlanned: 50,
      elevationGainPlanned: 500,
      coachComments: 'Coach notes here',
    } as LibraryItem;

    const mockConfig: IntervalsIcuExportConfig = {
      apiKey: 'test-api-key',
      startDate: '2024-03-15',
    };

    it('should successfully transform workouts with valid config', async () => {
      const mockResponse: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
          icu_training_load: 85,
        },
      ];

      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await adapter.transform([mockWorkout], mockConfig);

      expect(result).toEqual(mockResponse);
      expect(intervalsApi.exportToIntervals).toHaveBeenCalledWith(
        [mockWorkout],
        ['2024-03-15']
      );
    });

    it('should calculate multiple dates for multiple workouts', async () => {
      const mockWorkouts = [mockWorkout, mockWorkout, mockWorkout];
      const mockResponse: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
        },
        {
          id: 790,
          start_date_local: '2024-03-16',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
        },
        {
          id: 791,
          start_date_local: '2024-03-17',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
        },
      ];

      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await adapter.transform(mockWorkouts, mockConfig);

      expect(result).toEqual(mockResponse);
      expect(intervalsApi.exportToIntervals).toHaveBeenCalledWith(
        mockWorkouts,
        ['2024-03-15', '2024-03-16', '2024-03-17']
      );
    });

    it('should throw error when API key is missing', async () => {
      const configWithoutKey: IntervalsIcuExportConfig = {
        startDate: '2024-03-15',
      };

      await expect(
        adapter.transform([mockWorkout], configWithoutKey)
      ).rejects.toThrow('Intervals.icu API key is required');

      expect(intervalsApi.exportToIntervals).not.toHaveBeenCalled();
    });

    it('should throw error when API key is empty string', async () => {
      const configWithEmptyKey: IntervalsIcuExportConfig = {
        apiKey: '',
        startDate: '2024-03-15',
      };

      await expect(
        adapter.transform([mockWorkout], configWithEmptyKey)
      ).rejects.toThrow('Intervals.icu API key is required');

      expect(intervalsApi.exportToIntervals).not.toHaveBeenCalled();
    });

    it('should throw error when start date is missing', async () => {
      const configWithoutDate: IntervalsIcuExportConfig = {
        apiKey: 'test-api-key',
      };

      await expect(
        adapter.transform([mockWorkout], configWithoutDate)
      ).rejects.toThrow('Start date is required');

      expect(intervalsApi.exportToIntervals).not.toHaveBeenCalled();
    });

    it('should throw error when API client returns error', async () => {
      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: false,
        error: {
          message: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
      });

      await expect(
        adapter.transform([mockWorkout], mockConfig)
      ).rejects.toThrow('Invalid API key');
    });

    it('should throw error when API client returns NO_API_KEY error', async () => {
      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: false,
        error: {
          message: 'Intervals.icu API key not configured',
          code: 'NO_API_KEY',
        },
      });

      await expect(
        adapter.transform([mockWorkout], mockConfig)
      ).rejects.toThrow('Intervals.icu API key not configured');
    });

    it('should handle network errors from API client', async () => {
      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: false,
        error: {
          message: 'Network error',
          code: 'EXPORT_ERROR',
        },
      });

      await expect(
        adapter.transform([mockWorkout], mockConfig)
      ).rejects.toThrow('Network error');
    });

    it('should handle empty workouts array', async () => {
      vi.mocked(intervalsApi.exportToIntervals).mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await adapter.transform([], mockConfig);

      expect(result).toEqual([]);
      expect(intervalsApi.exportToIntervals).toHaveBeenCalledWith([], []);
    });
  });

  describe('validate', () => {
    it('should validate successfully with valid workouts', async () => {
      const validWorkouts: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
          icu_training_load: 85,
        },
      ];

      const result = await adapter.validate(validWorkouts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should add warning when workout has no name', async () => {
      const workoutsWithoutName: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          // name is optional
        },
      ];

      const result = await adapter.validate(workoutsWithoutName);

      expect(result.isValid).toBe(true); // warnings don't invalidate
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        field: 'workouts[0].name',
        message: 'Workout uploaded without a name',
        severity: 'warning',
      });
    });

    it('should add warning when workout has empty name', async () => {
      const workoutsWithEmptyName: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: '   ', // whitespace only
        },
      ];

      const result = await adapter.validate(workoutsWithEmptyName);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe(
        'Workout uploaded without a name'
      );
    });

    it('should validate multiple workouts', async () => {
      const workouts: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Workout 1',
        },
        {
          id: 790,
          start_date_local: '2024-03-16',
          type: 'Run',
          category: 'WORKOUT',
          name: 'Workout 2',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should collect multiple warnings from multiple workouts', async () => {
      const workouts: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
        },
        {
          id: 790,
          start_date_local: '2024-03-16',
          type: 'Run',
          category: 'WORKOUT',
          name: '',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].field).toBe('workouts[0].name');
      expect(result.warnings[1].field).toBe('workouts[1].name');
    });

    it('should handle validation of invalid workout data', async () => {
      // Purposely invalid data that would fail Zod schema
      const invalidWorkouts = [
        {
          id: 'not-a-number', // should be number
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ] as unknown as IntervalsEventResponse[];

      const result = await adapter.validate(invalidWorkouts);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('workouts[0]');
      expect(result.errors[0].message).toContain('Validation failed');
    });

    it('should validate empty array successfully', async () => {
      const result = await adapter.validate([]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('export', () => {
    const mockWorkouts: IntervalsEventResponse[] = [
      {
        id: 789,
        start_date_local: '2024-03-15',
        type: 'Ride',
        category: 'WORKOUT',
        name: 'Test Workout',
        icu_training_load: 85,
      },
    ];

    const mockConfig: IntervalsIcuExportConfig = {
      apiKey: 'test-api-key',
      startDate: '2024-03-15',
    };

    it('should return successful export result', async () => {
      const result = await adapter.export(mockWorkouts, mockConfig);

      expect(result.success).toBe(true);
      expect(result.format).toBe('api');
      expect(result.itemsExported).toBe(1);
      expect(result.warnings).toEqual([]);
      expect(result.fileName).toContain('intervals_icu_export_');
    });

    it('should include warnings in export result', async () => {
      const workoutsWithWarnings: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          // no name
        },
      ];

      const result = await adapter.export(workoutsWithWarnings, mockConfig);

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe(
        'Workout uploaded without a name'
      );
    });

    it('should return correct item count for multiple workouts', async () => {
      const multipleWorkouts: IntervalsEventResponse[] = [
        {
          id: 789,
          start_date_local: '2024-03-15',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Workout 1',
        },
        {
          id: 790,
          start_date_local: '2024-03-16',
          type: 'Run',
          category: 'WORKOUT',
          name: 'Workout 2',
        },
        {
          id: 791,
          start_date_local: '2024-03-17',
          type: 'Swim',
          category: 'WORKOUT',
          name: 'Workout 3',
        },
      ];

      const result = await adapter.export(multipleWorkouts, mockConfig);

      expect(result.success).toBe(true);
      expect(result.itemsExported).toBe(3);
    });

    it('should handle empty workouts array', async () => {
      const result = await adapter.export([], mockConfig);

      expect(result.success).toBe(true);
      expect(result.itemsExported).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should generate unique file name with timestamp', async () => {
      const result1 = await adapter.export(mockWorkouts, mockConfig);

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await adapter.export(mockWorkouts, mockConfig);

      expect(result1.fileName).not.toBe(result2.fileName);
      expect(result1.fileName).toMatch(/^intervals_icu_export_\d+$/);
      expect(result2.fileName).toMatch(/^intervals_icu_export_\d+$/);
    });

    it('should not generate fileUrl for API export', async () => {
      const result = await adapter.export(mockWorkouts, mockConfig);

      expect(result.fileUrl).toBeUndefined();
    });
  });
});

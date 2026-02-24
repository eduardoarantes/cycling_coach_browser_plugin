/**
 * Unit tests for IntervalsIcuAdapter
 *
 * Tests the adapter implementation following TDD principles.
 * Phase 3: Library-based export (folders + workout templates, NO dates)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntervalsIcuAdapter } from '@/export/adapters/intervalsicu/IntervalsIcuAdapter';
import type { LibraryItem } from '@/types';
import type {
  IntervalsIcuExportConfig,
  IntervalsWorkoutResponse,
} from '@/types/intervalsicu.types';
import * as intervalsApiKeyService from '@/services/intervalsApiKeyService';

// Mock chrome runtime for message passing
const mockSendMessage = vi.fn();
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
} as never;

// Mock the API key service
vi.mock('@/services/intervalsApiKeyService');

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
        'Export workouts to Intervals.icu library via API'
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
      libraryName: 'My Training Library',
      createFolder: false,
    };

    it('should export workouts without creating folder', async () => {
      const mockResponse: IntervalsWorkoutResponse[] = [
        {
          id: 789,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
          folder_id: null,
        },
      ];

      // Mock API key check
      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      // Mock export message response
      mockSendMessage.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await adapter.transform([mockWorkout], mockConfig);

      expect(result).toEqual(mockResponse);
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'EXPORT_WORKOUTS_TO_LIBRARY',
        workouts: [mockWorkout],
        folderId: undefined,
      });
      expect(mockSendMessage).toHaveBeenCalledTimes(1); // No folder creation
    });

    it('should create folder and export workouts when createFolder is true', async () => {
      const configWithFolder: IntervalsIcuExportConfig = {
        ...mockConfig,
        createFolder: true,
      };

      const folderResponse = {
        id: 123,
        name: 'My Training Library',
        athlete_id: 456,
      };

      const mockWorkoutResponse: IntervalsWorkoutResponse[] = [
        {
          id: 789,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
          folder_id: 123,
        },
      ];

      // Mock API key check
      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      // Mock folder creation then workout export
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          data: folderResponse,
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockWorkoutResponse,
        });

      const result = await adapter.transform([mockWorkout], configWithFolder);

      expect(result).toEqual(mockWorkoutResponse);

      // Should call folder creation first
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        type: 'CREATE_INTERVALS_FOLDER',
        libraryName: 'My Training Library',
        description: undefined,
      });

      // Then export with folder ID
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
        type: 'EXPORT_WORKOUTS_TO_LIBRARY',
        workouts: [mockWorkout],
        folderId: 123,
      });
    });

    it('should throw when no API key configured', async () => {
      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        false
      );

      await expect(
        adapter.transform([mockWorkout], mockConfig)
      ).rejects.toThrow('Intervals.icu API key not configured');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should throw when folder creation fails', async () => {
      const configWithFolder: IntervalsIcuExportConfig = {
        ...mockConfig,
        createFolder: true,
      };

      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      mockSendMessage.mockResolvedValue({
        success: false,
        error: {
          message: 'Failed to create folder',
          code: 'FOLDER_ERROR',
        },
      });

      await expect(
        adapter.transform([mockWorkout], configWithFolder)
      ).rejects.toThrow('Failed to create folder: Failed to create folder');
    });

    it('should throw when workout export fails', async () => {
      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      mockSendMessage.mockResolvedValue({
        success: false,
        error: {
          message: 'Failed to export workouts',
          code: 'EXPORT_ERROR',
        },
      });

      await expect(
        adapter.transform([mockWorkout], mockConfig)
      ).rejects.toThrow('Failed to export workouts: Failed to export workouts');
    });

    it('should handle empty workout list', async () => {
      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      mockSendMessage.mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await adapter.transform([], mockConfig);

      expect(result).toEqual([]);
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'EXPORT_WORKOUTS_TO_LIBRARY',
        workouts: [],
        folderId: undefined,
      });
    });

    it('should pass description when creating folder', async () => {
      const configWithDescription: IntervalsIcuExportConfig = {
        ...mockConfig,
        createFolder: true,
        description: 'My custom description',
      };

      const folderResponse = {
        id: 123,
        name: 'My Training Library',
        athlete_id: 456,
      };

      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          data: folderResponse,
        })
        .mockResolvedValueOnce({
          success: true,
          data: [],
        });

      await adapter.transform([], configWithDescription);

      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        type: 'CREATE_INTERVALS_FOLDER',
        libraryName: 'My Training Library',
        description: 'My custom description',
      });
    });

    it('should handle multiple workouts', async () => {
      const mockWorkouts = [mockWorkout, mockWorkout, mockWorkout];
      const mockResponse: IntervalsWorkoutResponse[] = [
        { id: 1, name: 'Workout 1', type: 'Ride', category: 'WORKOUT' },
        { id: 2, name: 'Workout 2', type: 'Ride', category: 'WORKOUT' },
        { id: 3, name: 'Workout 3', type: 'Ride', category: 'WORKOUT' },
      ];

      vi.mocked(intervalsApiKeyService.hasIntervalsApiKey).mockResolvedValue(
        true
      );

      mockSendMessage.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await adapter.transform(mockWorkouts, mockConfig);

      expect(result).toEqual(mockResponse);
      expect(result).toHaveLength(3);
    });
  });

  describe('validate', () => {
    it('should validate successful workout templates', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        {
          id: 789,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing names', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        {
          id: 789,
          name: '',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true); // Warnings don't invalidate
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        field: 'workouts[0].name',
        message: 'Workout template has no name',
        severity: 'warning',
      });
    });

    it('should warn about whitespace-only names', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        {
          id: 789,
          name: '   ',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Workout template has no name');
    });

    it('should warn about missing IDs', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        {
          id: 0,
          name: 'Test Workout',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        field: 'workouts[0].id',
        message: 'Workout template was not created',
        severity: 'warning',
      });
    });

    it('should handle multiple warnings from same workout', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        {
          id: 0,
          name: '',
          type: 'Ride',
          category: 'WORKOUT',
        },
      ];

      const result = await adapter.validate(workouts);

      expect(result.warnings).toHaveLength(2);
    });

    it('should validate multiple workouts', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        { id: 1, name: 'Workout 1', type: 'Ride', category: 'WORKOUT' },
        { id: 2, name: 'Workout 2', type: 'Run', category: 'WORKOUT' },
        { id: 3, name: 'Workout 3', type: 'Swim', category: 'WORKOUT' },
      ];

      const result = await adapter.validate(workouts);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle empty array', async () => {
      const result = await adapter.validate([]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('export', () => {
    const mockConfig: IntervalsIcuExportConfig = {
      apiKey: 'test-api-key',
      libraryName: 'My Training Library',
    };

    it('should return success result', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        { id: 1, name: 'Workout 1', type: 'Ride', category: 'WORKOUT' },
        { id: 2, name: 'Workout 2', type: 'Run', category: 'WORKOUT' },
      ];

      const result = await adapter.export(workouts, mockConfig);

      expect(result.success).toBe(true);
      expect(result.format).toBe('api');
      expect(result.itemsExported).toBe(2);
      expect(result.fileName).toContain('intervals_icu_export_');
    });

    it('should include correct item count', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        { id: 1, name: 'Workout 1', type: 'Ride', category: 'WORKOUT' },
        { id: 2, name: 'Workout 2', type: 'Run', category: 'WORKOUT' },
      ];

      const result = await adapter.export(workouts, mockConfig);

      expect(result.itemsExported).toBe(2);
    });

    it('should handle empty workout list', async () => {
      const result = await adapter.export([], mockConfig);

      expect(result.success).toBe(true);
      expect(result.itemsExported).toBe(0);
    });

    it('should include warnings if validation finds issues', async () => {
      const workouts: IntervalsWorkoutResponse[] = [
        { id: 0, name: '', type: 'Ride', category: 'WORKOUT' },
      ];

      const result = await adapter.export(workouts, mockConfig);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });
});

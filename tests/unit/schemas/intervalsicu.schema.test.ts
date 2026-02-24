/**
 * Unit tests for Intervals.icu Zod schemas
 *
 * Tests validation logic for API responses and storage data
 */

import { describe, it, expect } from 'vitest';
import {
  IntervalsFolderPayloadSchema,
  IntervalsFolderResponseSchema,
  IntervalsWorkoutPayloadSchema,
  IntervalsWorkoutResponseSchema,
  IntervalsWorkoutBulkResponseSchema,
  IntervalsIcuExportConfigSchema,
  IntervalsApiKeyStorageSchema,
} from '@/schemas/intervalsicu.schema';

describe('IntervalsFolderPayloadSchema', () => {
  describe('valid data', () => {
    it('should validate folder payload with name only', () => {
      const payload = {
        name: 'TrainingPeaks Library',
      };

      const result = IntervalsFolderPayloadSchema.parse(payload);

      expect(result).toEqual(payload);
      expect(result.name).toBe('TrainingPeaks Library');
      expect(result.description).toBeUndefined();
    });

    it('should validate folder payload with name and description', () => {
      const payload = {
        name: 'Sweet Spot Workouts',
        description: 'Imported from TrainingPeaks',
      };

      const result = IntervalsFolderPayloadSchema.parse(payload);

      expect(result).toEqual(payload);
      expect(result.description).toBe('Imported from TrainingPeaks');
    });

    it('should validate folder payload with empty description', () => {
      const payload = {
        name: 'My Library',
        description: '',
      };

      const result = IntervalsFolderPayloadSchema.parse(payload);

      expect(result.name).toBe('My Library');
      expect(result.description).toBe('');
    });
  });

  describe('invalid data', () => {
    it('should reject payload with missing name', () => {
      const payload = {
        description: 'Test description',
      };

      expect(() => IntervalsFolderPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with empty name', () => {
      const payload = {
        name: '',
        description: 'Test',
      };

      expect(() => IntervalsFolderPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with non-string name', () => {
      const payload = {
        name: 123,
      };

      expect(() => IntervalsFolderPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with non-string description', () => {
      const payload = {
        name: 'Test',
        description: 123,
      };

      expect(() => IntervalsFolderPayloadSchema.parse(payload)).toThrow();
    });
  });
});

describe('IntervalsFolderResponseSchema', () => {
  describe('valid data', () => {
    it('should validate complete folder response', () => {
      const response = {
        id: 12345,
        name: 'TrainingPeaks Library',
        athlete_id: 67890,
      };

      const result = IntervalsFolderResponseSchema.parse(response);

      expect(result).toEqual(response);
      expect(result.id).toBe(12345);
      expect(result.athlete_id).toBe(67890);
    });

    it('should validate folder response with special characters in name', () => {
      const response = {
        id: 999,
        name: 'Library & Workouts (2024)',
        athlete_id: 111,
      };

      const result = IntervalsFolderResponseSchema.parse(response);

      expect(result.name).toBe('Library & Workouts (2024)');
    });
  });

  describe('invalid data', () => {
    it('should reject response with missing id', () => {
      const response = {
        name: 'Test',
        athlete_id: 123,
      };

      expect(() => IntervalsFolderResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with negative id', () => {
      const response = {
        id: -1,
        name: 'Test',
        athlete_id: 123,
      };

      expect(() => IntervalsFolderResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with missing athlete_id', () => {
      const response = {
        id: 123,
        name: 'Test',
      };

      expect(() => IntervalsFolderResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with string id', () => {
      const response = {
        id: '123',
        name: 'Test',
        athlete_id: 456,
      };

      expect(() => IntervalsFolderResponseSchema.parse(response)).toThrow();
    });
  });
});

describe('IntervalsWorkoutPayloadSchema', () => {
  describe('valid data', () => {
    it('should validate complete workout payload', () => {
      const payload = {
        name: 'Sweet Spot Intervals',
        description: '3x10 min @ 88-93% FTP',
        type: 'Ride',
        category: 'WORKOUT' as const,
        folder_id: 123,
        workout_doc: 'structured workout data',
      };

      const result = IntervalsWorkoutPayloadSchema.parse(payload);

      expect(result).toEqual(payload);
      expect(result.category).toBe('WORKOUT');
    });

    it('should validate minimal workout payload without optional fields', () => {
      const payload = {
        name: 'Easy Run',
        description: '30 minutes easy pace',
        type: 'Run',
        category: 'WORKOUT' as const,
      };

      const result = IntervalsWorkoutPayloadSchema.parse(payload);

      expect(result.name).toBe('Easy Run');
      expect(result.folder_id).toBeUndefined();
      expect(result.workout_doc).toBeUndefined();
    });

    it('should validate workout with folder_id but no workout_doc', () => {
      const payload = {
        name: 'Tempo Ride',
        description: '20 min @ FTP',
        type: 'Ride',
        category: 'WORKOUT' as const,
        folder_id: 456,
      };

      const result = IntervalsWorkoutPayloadSchema.parse(payload);

      expect(result.folder_id).toBe(456);
      expect(result.workout_doc).toBeUndefined();
    });

    it('should validate workout with workout_doc but no folder_id', () => {
      const payload = {
        name: 'Structured Intervals',
        description: 'Power-based intervals',
        type: 'Ride',
        category: 'WORKOUT' as const,
        workout_doc: '{ "intervals": [] }',
      };

      const result = IntervalsWorkoutPayloadSchema.parse(payload);

      expect(result.workout_doc).toBe('{ "intervals": [] }');
      expect(result.folder_id).toBeUndefined();
    });

    it('should validate different workout types', () => {
      const types = ['Ride', 'Run', 'Swim', 'WeightTraining'];

      types.forEach((type) => {
        const payload = {
          name: `Test ${type}`,
          description: 'Description',
          type,
          category: 'WORKOUT' as const,
        };

        const result = IntervalsWorkoutPayloadSchema.parse(payload);
        expect(result.type).toBe(type);
      });
    });
  });

  describe('invalid data', () => {
    it('should reject payload with missing name', () => {
      const payload = {
        description: 'Test',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with empty name', () => {
      const payload = {
        name: '',
        description: 'Test',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with missing description', () => {
      const payload = {
        name: 'Test',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with missing type', () => {
      const payload = {
        name: 'Test',
        description: 'Test',
        category: 'WORKOUT',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with missing category', () => {
      const payload = {
        name: 'Test',
        description: 'Test',
        type: 'Ride',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with invalid category', () => {
      const payload = {
        name: 'Test',
        description: 'Test',
        type: 'Ride',
        category: 'INVALID',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });

    it('should reject payload with start_date_local field', () => {
      const payload = {
        name: 'Test',
        description: 'Test',
        type: 'Ride',
        category: 'WORKOUT',
        start_date_local: '2024-02-24', // This should not be allowed
      };

      const result = IntervalsWorkoutPayloadSchema.parse(payload);
      expect(result).not.toHaveProperty('start_date_local');
    });

    it('should reject payload with non-number folder_id', () => {
      const payload = {
        name: 'Test',
        description: 'Test',
        type: 'Ride',
        category: 'WORKOUT',
        folder_id: '123',
      };

      expect(() => IntervalsWorkoutPayloadSchema.parse(payload)).toThrow();
    });
  });
});

describe('IntervalsWorkoutResponseSchema', () => {
  describe('valid data', () => {
    it('should validate complete workout response', () => {
      const response = {
        id: 123456,
        name: 'Sweet Spot Intervals',
        type: 'Ride',
        folder_id: 789,
        athlete_id: 111,
      };

      const result = IntervalsWorkoutResponseSchema.parse(response);

      expect(result).toEqual(response);
      expect(result.id).toBe(123456);
      expect(result.folder_id).toBe(789);
    });

    it('should validate workout response with null folder_id', () => {
      const response = {
        id: 999,
        name: 'Unorganized Workout',
        type: 'Run',
        folder_id: null,
        athlete_id: 222,
      };

      const result = IntervalsWorkoutResponseSchema.parse(response);

      expect(result.folder_id).toBeNull();
    });

    it('should validate workout response without start_date_local', () => {
      const response = {
        id: 555,
        name: 'Template Workout',
        type: 'Ride',
        folder_id: 111,
        athlete_id: 333,
      };

      const result = IntervalsWorkoutResponseSchema.parse(response);

      expect(result).not.toHaveProperty('start_date_local');
    });
  });

  describe('invalid data', () => {
    it('should reject response with missing id', () => {
      const response = {
        name: 'Test',
        type: 'Ride',
        folder_id: 123,
        athlete_id: 456,
      };

      expect(() => IntervalsWorkoutResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with negative id', () => {
      const response = {
        id: -1,
        name: 'Test',
        type: 'Ride',
        folder_id: 123,
        athlete_id: 456,
      };

      expect(() => IntervalsWorkoutResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with missing athlete_id', () => {
      const response = {
        id: 123,
        name: 'Test',
        type: 'Ride',
        folder_id: 456,
      };

      expect(() => IntervalsWorkoutResponseSchema.parse(response)).toThrow();
    });

    it('should reject response with string folder_id', () => {
      const response = {
        id: 123,
        name: 'Test',
        type: 'Ride',
        folder_id: '456',
        athlete_id: 789,
      };

      expect(() => IntervalsWorkoutResponseSchema.parse(response)).toThrow();
    });
  });
});

describe('IntervalsWorkoutBulkResponseSchema', () => {
  describe('valid data', () => {
    it('should validate empty array', () => {
      const result = IntervalsWorkoutBulkResponseSchema.parse([]);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should validate array with single workout', () => {
      const workouts = [
        {
          id: 123,
          name: 'Test Workout',
          type: 'Ride',
          folder_id: 456,
          athlete_id: 789,
        },
      ];

      const result = IntervalsWorkoutBulkResponseSchema.parse(workouts);

      expect(result).toEqual(workouts);
      expect(result.length).toBe(1);
    });

    it('should validate array with multiple workouts', () => {
      const workouts = [
        {
          id: 123,
          name: 'Workout 1',
          type: 'Ride',
          folder_id: 111,
          athlete_id: 999,
        },
        {
          id: 456,
          name: 'Workout 2',
          type: 'Run',
          folder_id: null,
          athlete_id: 999,
        },
        {
          id: 789,
          name: 'Workout 3',
          type: 'Swim',
          folder_id: 222,
          athlete_id: 999,
        },
      ];

      const result = IntervalsWorkoutBulkResponseSchema.parse(workouts);

      expect(result).toEqual(workouts);
      expect(result.length).toBe(3);
    });
  });

  describe('invalid data', () => {
    it('should reject non-array input', () => {
      const invalid = { id: 123, name: 'Test' };

      expect(() => IntervalsWorkoutBulkResponseSchema.parse(invalid)).toThrow();
    });

    it('should reject array with invalid workout', () => {
      const workouts = [
        {
          id: 123,
          name: 'Valid',
          type: 'Ride',
          folder_id: 456,
          athlete_id: 789,
        },
        {
          // Missing required fields
          id: 456,
          name: 'Invalid',
        },
      ];

      expect(() =>
        IntervalsWorkoutBulkResponseSchema.parse(workouts)
      ).toThrow();
    });
  });
});

describe('IntervalsIcuExportConfigSchema', () => {
  describe('valid data', () => {
    it('should validate config with all required fields', () => {
      const config = {
        apiKey: 'test-api-key-12345',
        libraryName: 'TrainingPeaks Library',
      };

      const result = IntervalsIcuExportConfigSchema.parse(config);

      expect(result).toEqual(config);
      expect(result.createFolder).toBeUndefined();
    });

    it('should validate config with createFolder option', () => {
      const config = {
        apiKey: 'api-key',
        libraryName: 'My Workouts',
        createFolder: true,
      };

      const result = IntervalsIcuExportConfigSchema.parse(config);

      expect(result.createFolder).toBe(true);
    });

    it('should validate config with createFolder false', () => {
      const config = {
        apiKey: 'api-key',
        libraryName: 'Existing Library',
        createFolder: false,
      };

      const result = IntervalsIcuExportConfigSchema.parse(config);

      expect(result.createFolder).toBe(false);
    });
  });

  describe('invalid data', () => {
    it('should reject config with missing apiKey', () => {
      const config = {
        libraryName: 'Test Library',
      };

      expect(() => IntervalsIcuExportConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with empty apiKey', () => {
      const config = {
        apiKey: '',
        libraryName: 'Test Library',
      };

      expect(() => IntervalsIcuExportConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with missing libraryName', () => {
      const config = {
        apiKey: 'test-key',
      };

      expect(() => IntervalsIcuExportConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with empty libraryName', () => {
      const config = {
        apiKey: 'test-key',
        libraryName: '',
      };

      expect(() => IntervalsIcuExportConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with non-boolean createFolder', () => {
      const config = {
        apiKey: 'test-key',
        libraryName: 'Test',
        createFolder: 'true',
      };

      expect(() => IntervalsIcuExportConfigSchema.parse(config)).toThrow();
    });

    it('should reject config with startDates field', () => {
      const config = {
        apiKey: 'test-key',
        libraryName: 'Test',
        startDates: ['2024-02-24'], // This should not be allowed
      };

      const result = IntervalsIcuExportConfigSchema.parse(config);
      expect(result).not.toHaveProperty('startDates');
    });
  });
});

describe('IntervalsApiKeyStorageSchema', () => {
  describe('valid data', () => {
    it('should validate storage with API key', () => {
      const storage = {
        intervals_api_key: 'test-api-key-12345',
      };

      const result = IntervalsApiKeyStorageSchema.parse(storage);

      expect(result).toEqual(storage);
      expect(result.intervals_api_key).toBe('test-api-key-12345');
    });

    it('should validate empty storage object', () => {
      const storage = {};

      const result = IntervalsApiKeyStorageSchema.parse(storage);

      expect(result).toEqual({});
      expect(result.intervals_api_key).toBeUndefined();
    });

    it('should validate storage with undefined API key', () => {
      const storage = {
        intervals_api_key: undefined,
      };

      const result = IntervalsApiKeyStorageSchema.parse(storage);

      expect(result.intervals_api_key).toBeUndefined();
    });

    it('should validate storage with long API key', () => {
      const longKey = 'a'.repeat(200);
      const storage = {
        intervals_api_key: longKey,
      };

      const result = IntervalsApiKeyStorageSchema.parse(storage);

      expect(result.intervals_api_key).toBe(longKey);
    });
  });

  describe('invalid data', () => {
    it('should reject storage with non-string API key', () => {
      const storage = {
        intervals_api_key: 12345,
      };

      expect(() => IntervalsApiKeyStorageSchema.parse(storage)).toThrow();
    });

    it('should reject storage with null API key', () => {
      const storage = {
        intervals_api_key: null,
      };

      expect(() => IntervalsApiKeyStorageSchema.parse(storage)).toThrow();
    });

    it('should reject storage with boolean API key', () => {
      const storage = {
        intervals_api_key: true,
      };

      expect(() => IntervalsApiKeyStorageSchema.parse(storage)).toThrow();
    });

    it('should reject non-object input', () => {
      expect(() =>
        IntervalsApiKeyStorageSchema.parse('not-an-object')
      ).toThrow();
    });

    it('should reject null input', () => {
      expect(() => IntervalsApiKeyStorageSchema.parse(null)).toThrow();
    });

    it('should reject array input', () => {
      expect(() => IntervalsApiKeyStorageSchema.parse([])).toThrow();
    });
  });
});

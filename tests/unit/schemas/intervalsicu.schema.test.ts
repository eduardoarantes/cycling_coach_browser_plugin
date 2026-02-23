/**
 * Unit tests for Intervals.icu Zod schemas
 *
 * Tests validation logic for API responses and storage data
 */

import { describe, it, expect } from 'vitest';
import {
  IntervalsEventResponseSchema,
  IntervalsBulkResponseSchema,
  IntervalsApiKeyStorageSchema,
} from '@/schemas/intervalsicu.schema';

describe('IntervalsEventResponseSchema', () => {
  describe('valid data', () => {
    it('should validate complete event response', () => {
      const validEvent = {
        id: 123456,
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
        name: 'Sweet Spot Intervals',
        icu_training_load: 85,
      };

      const result = IntervalsEventResponseSchema.parse(validEvent);

      expect(result).toEqual(validEvent);
      expect(result.id).toBe(123456);
      expect(result.type).toBe('Ride');
    });

    it('should validate event without optional fields', () => {
      const minimalEvent = {
        id: 789,
        start_date_local: '2024-02-24T10:00:00',
        type: 'Run',
        category: 'WORKOUT',
      };

      const result = IntervalsEventResponseSchema.parse(minimalEvent);

      expect(result).toEqual(minimalEvent);
      expect(result.name).toBeUndefined();
      expect(result.icu_training_load).toBeUndefined();
    });

    it('should validate event with name but no TSS', () => {
      const event = {
        id: 456,
        start_date_local: '2024-02-25',
        type: 'Swim',
        category: 'WORKOUT',
        name: 'Easy Recovery Swim',
      };

      const result = IntervalsEventResponseSchema.parse(event);

      expect(result.name).toBe('Easy Recovery Swim');
      expect(result.icu_training_load).toBeUndefined();
    });

    it('should validate event with TSS but no name', () => {
      const event = {
        id: 999,
        start_date_local: '2024-02-26',
        type: 'WeightTraining',
        category: 'WORKOUT',
        icu_training_load: 50,
      };

      const result = IntervalsEventResponseSchema.parse(event);

      expect(result.icu_training_load).toBe(50);
      expect(result.name).toBeUndefined();
    });
  });

  describe('invalid data', () => {
    it('should reject event with missing required id', () => {
      const invalidEvent = {
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with negative id', () => {
      const invalidEvent = {
        id: -1,
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with zero id', () => {
      const invalidEvent = {
        id: 0,
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with empty start_date_local', () => {
      const invalidEvent = {
        id: 123,
        start_date_local: '',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with empty type', () => {
      const invalidEvent = {
        id: 123,
        start_date_local: '2024-02-24',
        type: '',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with empty category', () => {
      const invalidEvent = {
        id: 123,
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: '',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with wrong type for id', () => {
      const invalidEvent = {
        id: '123',
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject event with null id', () => {
      const invalidEvent = {
        id: null,
        start_date_local: '2024-02-24',
        type: 'Ride',
        category: 'WORKOUT',
      };

      expect(() => IntervalsEventResponseSchema.parse(invalidEvent)).toThrow();
    });
  });
});

describe('IntervalsBulkResponseSchema', () => {
  describe('valid data', () => {
    it('should validate empty array', () => {
      const result = IntervalsBulkResponseSchema.parse([]);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should validate array with single event', () => {
      const events = [
        {
          id: 123,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
          name: 'Test Workout',
        },
      ];

      const result = IntervalsBulkResponseSchema.parse(events);

      expect(result).toEqual(events);
      expect(result.length).toBe(1);
    });

    it('should validate array with multiple events', () => {
      const events = [
        {
          id: 123,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
        },
        {
          id: 456,
          start_date_local: '2024-02-25',
          type: 'Run',
          category: 'WORKOUT',
          icu_training_load: 75,
        },
        {
          id: 789,
          start_date_local: '2024-02-26',
          type: 'Swim',
          category: 'WORKOUT',
          name: 'Recovery Swim',
        },
      ];

      const result = IntervalsBulkResponseSchema.parse(events);

      expect(result).toEqual(events);
      expect(result.length).toBe(3);
    });
  });

  describe('invalid data', () => {
    it('should reject non-array input', () => {
      const invalid = { id: 123, type: 'Ride' };

      expect(() => IntervalsBulkResponseSchema.parse(invalid)).toThrow();
    });

    it('should reject array with invalid event', () => {
      const events = [
        {
          id: 123,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
        },
        {
          // Missing required fields
          id: 456,
          type: 'Run',
        },
      ];

      expect(() => IntervalsBulkResponseSchema.parse(events)).toThrow();
    });

    it('should reject array with mixed valid/invalid events', () => {
      const events = [
        {
          id: 123,
          start_date_local: '2024-02-24',
          type: 'Ride',
          category: 'WORKOUT',
        },
        {
          id: -1, // Invalid: negative id
          start_date_local: '2024-02-25',
          type: 'Run',
          category: 'WORKOUT',
        },
      ];

      expect(() => IntervalsBulkResponseSchema.parse(events)).toThrow();
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

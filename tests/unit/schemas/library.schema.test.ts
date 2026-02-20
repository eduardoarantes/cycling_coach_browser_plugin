/**
 * Library schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  LibrarySchema,
  LibrariesApiResponseSchema,
  LibraryItemSchema,
  LibraryItemsApiResponseSchema,
} from '@/schemas/library.schema';

describe('LibrarySchema', () => {
  it('should validate a complete library object', () => {
    const validLibrary = {
      exerciseLibraryId: 2550514,
      libraryName: 'My Library',
      ownerId: 4830660,
      ownerName: 'Eduardo Rodrigues',
      imageUrl:
        'https://userdata.trainingpeaks.com/0660384/profile/person-photo-images/638420560120926980-300x300.jpeg',
      isDefaultContent: false,
    };

    const result = LibrarySchema.parse(validLibrary);
    expect(result).toEqual(validLibrary);
  });

  it('should validate library with minimal required fields', () => {
    const minimalLibrary = {
      exerciseLibraryId: 123,
      libraryName: 'Test Library',
      ownerId: 456,
      ownerName: 'Test Owner',
      imageUrl: 'https://example.com/image.jpg',
      isDefaultContent: true,
    };

    const result = LibrarySchema.parse(minimalLibrary);
    expect(result).toEqual(minimalLibrary);
  });

  it('should reject library missing exerciseLibraryId', () => {
    const invalidLibrary = {
      libraryName: 'Test Library',
      ownerId: 123,
      ownerName: 'Test Owner',
      imageUrl: 'https://example.com/image.jpg',
      isDefaultContent: false,
    };

    expect(() => LibrarySchema.parse(invalidLibrary)).toThrow();
  });

  it('should reject library with invalid exerciseLibraryId type', () => {
    const invalidLibrary = {
      exerciseLibraryId: '123',
      libraryName: 'Test Library',
      ownerId: 123,
      ownerName: 'Test Owner',
      imageUrl: 'https://example.com/image.jpg',
      isDefaultContent: false,
    };

    expect(() => LibrarySchema.parse(invalidLibrary)).toThrow();
  });

  it('should reject library with invalid isDefaultContent type', () => {
    const invalidLibrary = {
      exerciseLibraryId: 123,
      libraryName: 'Test Library',
      ownerId: 123,
      ownerName: 'Test Owner',
      imageUrl: 'https://example.com/image.jpg',
      isDefaultContent: 'false',
    };

    expect(() => LibrarySchema.parse(invalidLibrary)).toThrow();
  });

  it('should handle null imageUrl', () => {
    const libraryWithNullImage = {
      exerciseLibraryId: 123,
      libraryName: 'Test Library',
      ownerId: 123,
      ownerName: 'Test Owner',
      imageUrl: null,
      isDefaultContent: false,
    };

    const result = LibrarySchema.parse(libraryWithNullImage);
    expect(result.imageUrl).toBeNull();
  });
});

describe('LibrariesApiResponseSchema', () => {
  it('should validate array of libraries', () => {
    const validResponse = [
      {
        exerciseLibraryId: 2550514,
        libraryName: 'My Library',
        ownerId: 4830660,
        ownerName: 'Eduardo Rodrigues',
        imageUrl: 'https://example.com/image.jpg',
        isDefaultContent: false,
      },
      {
        exerciseLibraryId: 112352,
        libraryName: 'Default Library',
        ownerId: 12,
        ownerName: 'Joe Friel',
        imageUrl: 'https://assets.trainingpeaks.com/images/icons/folder.svg',
        isDefaultContent: true,
      },
    ];

    const result = LibrariesApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(2);
  });

  it('should validate empty array', () => {
    const emptyResponse: unknown[] = [];

    const result = LibrariesApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      libraries: [],
    };

    expect(() => LibrariesApiResponseSchema.parse(invalidResponse)).toThrow();
  });

  it('should reject array with invalid library objects', () => {
    const invalidResponse = [
      {
        exerciseLibraryId: '123',
        libraryName: 'Invalid',
      },
    ];

    expect(() => LibrariesApiResponseSchema.parse(invalidResponse)).toThrow();
  });
});

describe('LibraryItemSchema', () => {
  it('should validate a complete library item', () => {
    const validItem = {
      exerciseLibraryId: 2550514,
      exerciseLibraryItemId: 12378193,
      exerciseLibraryItemType: 'WorkoutTemplate',
      itemName: 'VO2 Max Booster - 6 x 30/15 - 3 repeats',
      workoutTypeId: 2,
      distancePlanned: null,
      totalTimePlanned: 0.9916666666666667,
      caloriesPlanned: null,
      tssPlanned: 56.2,
      ifPlanned: 0.75,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
    };

    const result = LibraryItemSchema.parse(validItem);
    expect(result).toEqual(validItem);
  });

  it('should validate item with all null optional fields', () => {
    const minimalItem = {
      exerciseLibraryId: 123,
      exerciseLibraryItemId: 456,
      exerciseLibraryItemType: 'WorkoutTemplate',
      itemName: 'Test Workout',
      workoutTypeId: 1,
      distancePlanned: null,
      totalTimePlanned: 1.0,
      caloriesPlanned: null,
      tssPlanned: null,
      ifPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
    };

    const result = LibraryItemSchema.parse(minimalItem);
    expect(result).toEqual(minimalItem);
  });

  it('should validate item with defined optional fields', () => {
    const itemWithOptionals = {
      exerciseLibraryId: 123,
      exerciseLibraryItemId: 456,
      exerciseLibraryItemType: 'WorkoutTemplate',
      itemName: 'Test Workout',
      workoutTypeId: 1,
      distancePlanned: 5000,
      totalTimePlanned: 1.0,
      caloriesPlanned: 300,
      tssPlanned: 50,
      ifPlanned: 0.8,
      velocityPlanned: 10,
      energyPlanned: 1200,
      elevationGainPlanned: 100,
      description: 'A test workout',
      coachComments: 'Focus on form',
    };

    const result = LibraryItemSchema.parse(itemWithOptionals);
    expect(result).toEqual(itemWithOptionals);
  });

  it('should reject item missing required fields', () => {
    const invalidItem = {
      exerciseLibraryId: 123,
      itemName: 'Test Workout',
    };

    expect(() => LibraryItemSchema.parse(invalidItem)).toThrow();
  });

  it('should reject item with invalid field types', () => {
    const invalidItem = {
      exerciseLibraryId: 123,
      exerciseLibraryItemId: '456',
      exerciseLibraryItemType: 'WorkoutTemplate',
      itemName: 'Test Workout',
      workoutTypeId: 1,
      distancePlanned: null,
      totalTimePlanned: '1.0',
      caloriesPlanned: null,
      tssPlanned: null,
      ifPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
    };

    expect(() => LibraryItemSchema.parse(invalidItem)).toThrow();
  });
});

describe('LibraryItemsApiResponseSchema', () => {
  it('should validate array of library items', () => {
    const validResponse = [
      {
        exerciseLibraryId: 2550514,
        exerciseLibraryItemId: 12378193,
        exerciseLibraryItemType: 'WorkoutTemplate',
        itemName: 'VO2 Max Booster',
        workoutTypeId: 2,
        distancePlanned: null,
        totalTimePlanned: 0.99,
        caloriesPlanned: null,
        tssPlanned: 56.2,
        ifPlanned: 0.75,
        velocityPlanned: null,
        energyPlanned: null,
        elevationGainPlanned: null,
        description: null,
        coachComments: null,
      },
    ];

    const result = LibraryItemsApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
    expect(result).toHaveLength(1);
  });

  it('should validate empty array of items', () => {
    const emptyResponse: unknown[] = [];

    const result = LibraryItemsApiResponseSchema.parse(emptyResponse);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should reject non-array response', () => {
    const invalidResponse = {
      items: [],
    };

    expect(() =>
      LibraryItemsApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });

  it('should reject array with invalid item objects', () => {
    const invalidResponse = [
      {
        exerciseLibraryId: 123,
        itemName: 'Incomplete',
      },
    ];

    expect(() =>
      LibraryItemsApiResponseSchema.parse(invalidResponse)
    ).toThrow();
  });
});

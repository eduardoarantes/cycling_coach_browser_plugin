/**
 * Athlete group (coach tag) schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  AthleteGroupSchema,
  AthleteGroupsApiResponseSchema,
} from '@/schemas/athleteGroup.schema';

describe('AthleteGroupSchema', () => {
  it('should validate a complete athlete group object', () => {
    const validGroup = {
      id: 340617,
      coachId: 6469888,
      name: 'Group1',
      athleteIds: [6469889],
      isDefault: false,
    };

    const result = AthleteGroupSchema.parse(validGroup);
    expect(result).toEqual(validGroup);
  });

  it('should validate a default group with an empty athlete list', () => {
    const defaultGroup = {
      id: 340276,
      coachId: 6469888,
      name: 'My Athletes',
      athleteIds: [],
      isDefault: true,
    };

    const result = AthleteGroupSchema.parse(defaultGroup);
    expect(result).toEqual(defaultGroup);
  });

  it('should validate a group with multiple athletes', () => {
    const group = {
      id: 1,
      coachId: 2,
      name: 'Squad',
      athleteIds: [10, 20, 30],
      isDefault: false,
    };

    const result = AthleteGroupSchema.parse(group);
    expect(result.athleteIds).toHaveLength(3);
  });

  it('should reject a group missing the id field', () => {
    const invalidGroup = {
      coachId: 6469888,
      name: 'Group1',
      athleteIds: [],
      isDefault: false,
    };

    expect(() => AthleteGroupSchema.parse(invalidGroup)).toThrow();
  });

  it('should reject a group with a non-numeric athlete id', () => {
    const invalidGroup = {
      id: 1,
      coachId: 2,
      name: 'Group1',
      athleteIds: ['not-a-number'],
      isDefault: false,
    };

    expect(() => AthleteGroupSchema.parse(invalidGroup)).toThrow();
  });

  it('should reject a group with an invalid isDefault type', () => {
    const invalidGroup = {
      id: 1,
      coachId: 2,
      name: 'Group1',
      athleteIds: [],
      isDefault: 'yes',
    };

    expect(() => AthleteGroupSchema.parse(invalidGroup)).toThrow();
  });
});

describe('AthleteGroupsApiResponseSchema', () => {
  it('should validate the full API response array', () => {
    const response = [
      {
        id: 340276,
        coachId: 6469888,
        name: 'My Athletes',
        athleteIds: [],
        isDefault: true,
      },
      {
        id: 340617,
        coachId: 6469888,
        name: 'Group1',
        athleteIds: [6469889],
        isDefault: false,
      },
      {
        id: 340618,
        coachId: 6469888,
        name: 'group 2',
        athleteIds: [],
        isDefault: false,
      },
    ];

    const result = AthleteGroupsApiResponseSchema.parse(response);
    expect(result).toHaveLength(3);
    expect(result[1].athleteIds).toEqual([6469889]);
  });

  it('should validate an empty array', () => {
    const result = AthleteGroupsApiResponseSchema.parse([]);
    expect(result).toEqual([]);
  });

  it('should reject a non-array response', () => {
    expect(() => AthleteGroupsApiResponseSchema.parse({})).toThrow();
  });
});

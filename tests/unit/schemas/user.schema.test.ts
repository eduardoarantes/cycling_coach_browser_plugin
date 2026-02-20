/**
 * User schema validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  UserApiResponseSchema,
  UserProfileSchema,
} from '@/schemas/user.schema';

describe('UserProfileSchema', () => {
  it('should validate a valid user profile', () => {
    const validProfile = {
      userId: 4830660,
      email: 'user@example.com',
      firstName: 'Eduardo',
      lastName: 'Rodrigues',
      timeZone: 'Australia/Sydney',
    };

    const result = UserProfileSchema.parse(validProfile);
    expect(result).toEqual(validProfile);
  });

  it('should reject profile missing required userId', () => {
    const invalidProfile = {
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      timeZone: 'America/Los_Angeles',
    };

    expect(() => UserProfileSchema.parse(invalidProfile)).toThrow();
  });

  it('should reject profile missing required email', () => {
    const invalidProfile = {
      userId: 123,
      firstName: 'John',
      lastName: 'Doe',
      timeZone: 'America/Los_Angeles',
    };

    expect(() => UserProfileSchema.parse(invalidProfile)).toThrow();
  });

  it('should reject profile with invalid userId type', () => {
    const invalidProfile = {
      userId: '123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      timeZone: 'America/Los_Angeles',
    };

    expect(() => UserProfileSchema.parse(invalidProfile)).toThrow();
  });

  it('should reject profile with invalid email type', () => {
    const invalidProfile = {
      userId: 123,
      email: 123,
      firstName: 'John',
      lastName: 'Doe',
      timeZone: 'America/Los_Angeles',
    };

    expect(() => UserProfileSchema.parse(invalidProfile)).toThrow();
  });

  it('should accept profile with all optional fields', () => {
    const validProfile = {
      userId: 123,
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      timeZone: 'America/Los_Angeles',
    };

    const result = UserProfileSchema.parse(validProfile);
    expect(result).toEqual(validProfile);
  });
});

describe('UserApiResponseSchema', () => {
  it('should validate a complete user API response', () => {
    const validResponse = {
      user: {
        userId: 4830660,
        email: 'r.eduardo.arantes@gmail.com',
        firstName: 'Eduardo',
        lastName: 'Rodrigues',
        timeZone: 'Australia/Sydney',
      },
    };

    const result = UserApiResponseSchema.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  it('should reject response missing user object', () => {
    const invalidResponse = {};

    expect(() => UserApiResponseSchema.parse(invalidResponse)).toThrow();
  });

  it('should reject response with invalid user object', () => {
    const invalidResponse = {
      user: {
        userId: '123',
        email: 'user@example.com',
      },
    };

    expect(() => UserApiResponseSchema.parse(invalidResponse)).toThrow();
  });

  it('should validate user response from actual API data', () => {
    const actualResponse = {
      user: {
        userId: 4830660,
        email: 'r.eduardo.arantes@gmail.com',
        firstName: 'Eduardo',
        lastName: 'Rodrigues',
        timeZone: 'Australia/Sydney',
      },
    };

    const result = UserApiResponseSchema.parse(actualResponse);
    expect(result.user.userId).toBe(4830660);
    expect(result.user.email).toBe('r.eduardo.arantes@gmail.com');
    expect(result.user.firstName).toBe('Eduardo');
    expect(result.user.lastName).toBe('Rodrigues');
    expect(result.user.timeZone).toBe('Australia/Sydney');
  });

  it('should handle additional fields in user object gracefully', () => {
    const responseWithExtra = {
      user: {
        userId: 4830660,
        email: 'user@example.com',
        firstName: 'Eduardo',
        lastName: 'Rodrigues',
        timeZone: 'Australia/Sydney',
        extraField: 'should be ignored',
        settings: { some: 'data' },
      },
    };

    // Zod will strip unknown keys by default
    const result = UserApiResponseSchema.parse(responseWithExtra);
    expect(result.user.userId).toBe(4830660);
    expect(result.user.email).toBe('user@example.com');
  });
});

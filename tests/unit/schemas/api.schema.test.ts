/**
 * API common patterns schema validation tests
 */

import { describe, it, expect } from 'vitest';
import { ApiErrorSchema } from '@/schemas/api.schema';

describe('ApiErrorSchema', () => {
  it('should validate a simple error object', () => {
    const validError = {
      message: 'Authentication failed',
    };

    const result = ApiErrorSchema.parse(validError);
    expect(result).toEqual(validError);
    expect(result.message).toBe('Authentication failed');
  });

  it('should validate error with status code', () => {
    const errorWithStatus = {
      message: 'Not found',
      status: 404,
    };

    const result = ApiErrorSchema.parse(errorWithStatus);
    expect(result).toEqual(errorWithStatus);
    expect(result.status).toBe(404);
  });

  it('should validate error with error code', () => {
    const errorWithCode = {
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
    };

    const result = ApiErrorSchema.parse(errorWithCode);
    expect(result).toEqual(errorWithCode);
    expect(result.code).toBe('INVALID_TOKEN');
  });

  it('should validate error with all optional fields', () => {
    const completeError = {
      message: 'Server error',
      status: 500,
      code: 'INTERNAL_ERROR',
    };

    const result = ApiErrorSchema.parse(completeError);
    expect(result).toEqual(completeError);
  });

  it('should reject error missing message', () => {
    const invalidError = {
      status: 500,
      code: 'ERROR',
    };

    expect(() => ApiErrorSchema.parse(invalidError)).toThrow();
  });

  it('should reject error with invalid message type', () => {
    const invalidError = {
      message: 123,
    };

    expect(() => ApiErrorSchema.parse(invalidError)).toThrow();
  });

  it('should reject error with invalid status type', () => {
    const invalidError = {
      message: 'Error',
      status: '500',
    };

    expect(() => ApiErrorSchema.parse(invalidError)).toThrow();
  });

  it('should reject error with invalid code type', () => {
    const invalidError = {
      message: 'Error',
      code: 404,
    };

    expect(() => ApiErrorSchema.parse(invalidError)).toThrow();
  });

  it('should validate typical 401 unauthorized error', () => {
    const unauthorizedError = {
      message: 'Unauthorized',
      status: 401,
      code: 'UNAUTHORIZED',
    };

    const result = ApiErrorSchema.parse(unauthorizedError);
    expect(result.status).toBe(401);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('should validate typical 403 forbidden error', () => {
    const forbiddenError = {
      message: 'Access forbidden',
      status: 403,
    };

    const result = ApiErrorSchema.parse(forbiddenError);
    expect(result.status).toBe(403);
  });

  it('should validate typical 404 not found error', () => {
    const notFoundError = {
      message: 'Resource not found',
      status: 404,
    };

    const result = ApiErrorSchema.parse(notFoundError);
    expect(result.status).toBe(404);
  });

  it('should validate typical 500 server error', () => {
    const serverError = {
      message: 'Internal server error',
      status: 500,
    };

    const result = ApiErrorSchema.parse(serverError);
    expect(result.status).toBe(500);
  });
});

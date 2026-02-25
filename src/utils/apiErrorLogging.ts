import type { ApiError } from '@/types/api.types';
import { logger } from '@/utils/logger';

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function getErrorLike(input: unknown): ErrorLike | null {
  if (input instanceof Error) {
    return { message: input.message };
  }

  if (typeof input === 'object' && input !== null) {
    return input as ErrorLike;
  }

  return null;
}

export function isExpectedAuthError(input: unknown): boolean {
  const error = getErrorLike(input);
  if (!error) return false;

  if (error.status === 401 || error.statusCode === 401) {
    return true;
  }

  if (typeof error.code === 'string') {
    const normalizedCode = error.code.toUpperCase();
    if (
      normalizedCode.includes('AUTH') ||
      normalizedCode === 'NO_TOKEN' ||
      normalizedCode.includes('UNAUTHORIZED')
    ) {
      return true;
    }
  }

  if (typeof error.message === 'string') {
    const normalizedMessage = error.message.trim().toLowerCase();
    if (
      normalizedMessage.includes('http 401') ||
      normalizedMessage.includes('not authenticated') ||
      normalizedMessage.includes('unauthorized')
    ) {
      return true;
    }
  }

  return false;
}

export function logApiResponseError(prefix: string, error: ApiError): void {
  const message = error.message || 'Unknown error';

  if (isExpectedAuthError(error)) {
    logger.warn(prefix, message);
    return;
  }

  logger.error(prefix, message);
}

export function logErrorWithAuthDowngrade(
  prefix: string,
  error: unknown
): void {
  if (isExpectedAuthError(error)) {
    logger.warn(prefix, error);
    return;
  }

  logger.error(prefix, error);
}

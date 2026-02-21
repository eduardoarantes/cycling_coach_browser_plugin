/**
 * TrainingPeaks API client for background service worker
 *
 * Handles authenticated requests to TrainingPeaks API with Zod validation
 */

import {
  API_BASE_URL,
  STORAGE_KEYS,
  createApiHeaders,
} from '@/utils/constants';
import { logger } from '@/utils/logger';
import {
  UserApiResponseSchema,
  LibrariesApiResponseSchema,
  LibraryItemsApiResponseSchema,
} from '@/schemas';
import type {
  ApiResponse,
  UserProfile,
  Library,
  LibraryItem,
} from '@/types/api.types';
import { ZodError, type z } from 'zod';

/**
 * Get authentication token from storage
 */
async function getAuthToken(): Promise<string | null> {
  const { auth_token } = await chrome.storage.local.get([
    STORAGE_KEYS.AUTH_TOKEN,
  ]);
  return (auth_token as string | undefined) || null;
}

/**
 * Clear authentication token from storage
 */
async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.TOKEN_TIMESTAMP,
  ]);
  logger.warn('Authentication token cleared due to 401 response');
}

/**
 * Make authenticated API request
 */
async function makeApiRequest(endpoint: string): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: createApiHeaders(token),
  });

  // Handle 401 Unauthorized - clear invalid token
  if (response.status === 401) {
    await clearAuthToken();
  }

  return response;
}

/**
 * Generic API request handler with Zod validation
 *
 * @template T - The expected response type
 * @param endpoint - API endpoint path
 * @param schema - Zod schema for response validation
 * @param operationName - Description for logging (e.g., "user profile", "libraries")
 * @returns Type-safe API response with success/error discriminated union
 */
async function apiRequest<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  operationName: string
): Promise<ApiResponse<T>> {
  try {
    logger.debug(`Fetching ${operationName}`);

    const response = await makeApiRequest(endpoint);

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: `HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    const json = await response.json();

    // Validate response with Zod schema
    const validated = schema.parse(json);

    logger.info(`${operationName} fetched successfully`);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_TOKEN') {
      return {
        success: false,
        error: {
          message: 'Not authenticated',
          code: 'NO_TOKEN',
        },
      };
    }

    if (error instanceof ZodError) {
      logger.error(`${operationName} validation failed:`, error);
      return {
        success: false,
        error: {
          message: 'Response validation failed',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error(`Error fetching ${operationName}:`, error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Fetch user profile from TrainingPeaks API
 *
 * @returns User profile data or error
 */
export async function fetchUser(): Promise<ApiResponse<UserProfile>> {
  const result = await apiRequest(
    '/users/v3/user',
    UserApiResponseSchema,
    'user profile'
  );

  // Extract user from wrapper response
  if (result.success) {
    return { success: true, data: result.data.user };
  }

  return result;
}

/**
 * Fetch libraries list from TrainingPeaks API
 *
 * @returns Array of libraries or error
 */
export async function fetchLibraries(): Promise<ApiResponse<Library[]>> {
  return apiRequest(
    '/exerciselibrary/v2/libraries',
    LibrariesApiResponseSchema,
    'libraries'
  );
}

/**
 * Fetch library items (workouts) from TrainingPeaks API
 *
 * @param libraryId - ID of the library to fetch items from
 * @returns Array of library items or error
 */
export async function fetchLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  return apiRequest(
    `/exerciselibrary/v2/libraries/${libraryId}/items`,
    LibraryItemsApiResponseSchema,
    `library ${libraryId} items`
  );
}

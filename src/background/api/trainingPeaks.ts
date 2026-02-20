/**
 * TrainingPeaks API client for background service worker
 *
 * Handles authenticated requests to TrainingPeaks API with Zod validation
 */

import { API_BASE_URL, STORAGE_KEYS } from '@/utils/constants';
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
import { ZodError } from 'zod';

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  // Handle 401 Unauthorized - clear invalid token
  if (response.status === 401) {
    await clearAuthToken();
  }

  return response;
}

/**
 * Fetch user profile from TrainingPeaks API
 *
 * @returns User profile data or error
 */
export async function fetchUser(): Promise<ApiResponse<UserProfile>> {
  try {
    logger.debug('Fetching user profile');

    const response = await makeApiRequest('/users/v3/user');

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
    const validated = UserApiResponseSchema.parse(json);

    logger.info('User profile fetched successfully');
    return { success: true, data: validated.user };
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
      logger.error('User API response validation failed:', error);
      return {
        success: false,
        error: {
          message: 'Response validation failed',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error('Error fetching user:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Fetch libraries list from TrainingPeaks API
 *
 * @returns Array of libraries or error
 */
export async function fetchLibraries(): Promise<ApiResponse<Library[]>> {
  try {
    logger.debug('Fetching libraries');

    const response = await makeApiRequest('/exerciselibrary/v2/libraries');

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
    const validated = LibrariesApiResponseSchema.parse(json);

    logger.info(`Fetched ${validated.length} libraries`);
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
      logger.error('Libraries API response validation failed:', error);
      return {
        success: false,
        error: {
          message: 'Response validation failed',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error('Error fetching libraries:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
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
  try {
    logger.debug(`Fetching items for library ${libraryId}`);

    const response = await makeApiRequest(
      `/exerciselibrary/v2/libraries/${libraryId}/items`
    );

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
    const validated = LibraryItemsApiResponseSchema.parse(json);

    logger.info(`Fetched ${validated.length} items from library ${libraryId}`);
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
      logger.error('Library items API response validation failed:', error);
      return {
        success: false,
        error: {
          message: 'Response validation failed',
          code: 'VALIDATION_ERROR',
        },
      };
    }

    logger.error(`Error fetching library items for ${libraryId}:`, error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

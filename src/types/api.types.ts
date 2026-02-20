/**
 * TypeScript type definitions for TrainingPeaks API
 *
 * These types are inferred from Zod schemas to maintain a single source of truth.
 * Import from schemas for runtime validation, or from here for type-only usage.
 */

import type { ApiError as ApiErrorType } from '@/schemas/api.schema';

// Re-export types inferred from Zod schemas
export type { UserProfile, UserApiResponse } from '@/schemas/user.schema';

export type {
  Library,
  LibrariesApiResponse,
  LibraryItem,
  LibraryItemsApiResponse,
} from '@/schemas/library.schema';

export type { ApiError } from '@/schemas/api.schema';

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  USER: '/users/v3/user',
  LIBRARIES: '/exerciselibrary/v2/libraries',
  LIBRARY_ITEMS: (libraryId: number): string =>
    `/exerciselibrary/v2/libraries/${libraryId}/items`,
} as const;

/**
 * HTTP methods used by the API
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Common API request options
 */
export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * API response wrapper for error handling
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorType };

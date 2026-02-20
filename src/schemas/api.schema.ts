/**
 * Zod schemas for common API patterns
 *
 * Provides runtime validation for API errors and common response structures
 */

import { z } from 'zod';

/**
 * Schema for API error responses
 * Common pattern across TrainingPeaks API endpoints
 */
export const ApiErrorSchema = z.object({
  message: z.string(),
  status: z.number().optional(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Zod schemas for user profile validation
 *
 * Provides runtime validation for TrainingPeaks user API responses
 */

import { z } from 'zod';

/**
 * Schema for user profile data
 * Matches the essential fields from /users/v3/user endpoint
 */
export const UserProfileSchema = z.object({
  userId: z.number(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  timeZone: z.string(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Schema for user API response wrapper
 * The API returns { user: {...} }
 */
export const UserApiResponseSchema = z.object({
  user: UserProfileSchema,
});

export type UserApiResponse = z.infer<typeof UserApiResponseSchema>;

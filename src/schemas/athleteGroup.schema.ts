/**
 * Zod schemas for athlete group (coach tag) validation
 *
 * Provides runtime validation for TrainingPeaks coach tag API responses.
 * Coach "tags" are used to organize athletes into groups.
 */

import { z } from 'zod';

/**
 * Schema for a single athlete group (coach tag)
 * Matches the structure from /coaches/v2/coaches/{coachId}/tags endpoint
 */
export const AthleteGroupSchema = z.object({
  id: z.number(),
  coachId: z.number(),
  name: z.string(),
  athleteIds: z.array(z.number()),
  isDefault: z.boolean(),
});

export type AthleteGroup = z.infer<typeof AthleteGroupSchema>;

/**
 * Schema for the athlete groups API response
 * The API returns an array of athlete group objects directly
 */
export const AthleteGroupsApiResponseSchema = z.array(AthleteGroupSchema);

export type AthleteGroupsApiResponse = z.infer<
  typeof AthleteGroupsApiResponseSchema
>;

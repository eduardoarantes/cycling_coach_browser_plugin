/**
 * Zod schemas for library validation
 *
 * Provides runtime validation for TrainingPeaks library API responses
 */

import { z } from 'zod';

/**
 * Schema for a single library object
 * Matches the structure from /exerciselibrary/v2/libraries endpoint
 */
export const LibrarySchema = z.object({
  exerciseLibraryId: z.number(),
  libraryName: z.string(),
  ownerId: z.number(),
  ownerName: z.string(),
  imageUrl: z.string().nullable(),
  isDefaultContent: z.boolean(),
});

export type Library = z.infer<typeof LibrarySchema>;

/**
 * Schema for libraries list API response
 * The API returns an array of library objects directly
 */
export const LibrariesApiResponseSchema = z.array(LibrarySchema);

export type LibrariesApiResponse = z.infer<typeof LibrariesApiResponseSchema>;

/**
 * Schema for a single library item (workout)
 * Matches the structure from /exerciselibrary/v2/libraries/{id}/items endpoint
 */
export const LibraryItemSchema = z.object({
  exerciseLibraryId: z.number(),
  exerciseLibraryItemId: z.number(),
  exerciseLibraryItemType: z.string(),
  itemName: z.string(),
  workoutTypeId: z.number(),
  distancePlanned: z.number().nullable(),
  totalTimePlanned: z.number(),
  caloriesPlanned: z.number().nullable(),
  tssPlanned: z.number().nullable(),
  ifPlanned: z.number().nullable(),
  velocityPlanned: z.number().nullable(),
  energyPlanned: z.number().nullable(),
  elevationGainPlanned: z.number().nullable(),
  description: z.string().nullable(),
  coachComments: z.string().nullable(),
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;

/**
 * Schema for library items API response
 * The API returns an array of library item objects directly
 */
export const LibraryItemsApiResponseSchema = z.array(LibraryItemSchema);

export type LibraryItemsApiResponse = z.infer<
  typeof LibraryItemsApiResponseSchema
>;

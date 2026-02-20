/**
 * Zod schemas for storage validation
 *
 * Provides runtime validation for chrome.storage data
 */

import { z } from 'zod';

/**
 * Schema for token storage data
 */
export const TokenStorageSchema = z.object({
  auth_token: z.string().nullable().optional(),
  token_timestamp: z.number().nullable().optional(),
});

export type TokenStorage = z.infer<typeof TokenStorageSchema>;

/**
 * Schema for validated token data (after retrieval)
 */
export const ValidatedTokenDataSchema = z.object({
  auth_token: z.string().nullable(),
  token_timestamp: z.number().nullable(),
});

export type ValidatedTokenData = z.infer<typeof ValidatedTokenDataSchema>;

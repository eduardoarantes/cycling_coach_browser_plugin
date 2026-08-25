/**
 * Zod schemas for the PlanMyPeak site-control protocol
 *
 * Every inbound page message is parsed here before it reaches any data-access
 * or import code path. The parser deliberately distinguishes three outcomes:
 *
 *   - `ignore`   the message is not a site-control envelope at all (some other
 *                script on the page posted it), so it is not ours to answer
 *   - `error`    it is a site-control envelope, but unusable — the page gets a
 *                correlated error response
 *   - `ok`       validated request, safe to dispatch
 */

import { z } from 'zod';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_PAGE_SOURCE,
  isSiteControlRequestType,
} from '@/types/siteControl.types';
import type {
  SiteControlError,
  SiteControlErrorCode,
  SiteControlErrorResponse,
  SiteControlImportCompletedEvent,
  SiteControlImportCompletedPayload,
  SiteControlRequest,
  SiteControlSuccessResponse,
} from '@/types/siteControl.types';
import { SITE_CONTROL_EXTENSION_SOURCE } from '@/types/siteControl.types';
import { SITE_CONTROL_IMPORT_COMPLETED } from '@/types/siteControl.types';

/** TrainingPeaks identifiers are positive integers. */
const IdSchema = z.number().int().positive();

/**
 * Requests that take no arguments still accept an explicit empty object, so the
 * page may send `payload: {}` or omit the key entirely.
 */
const EmptyPayloadSchema = z.object({}).default({});

const BaseRequestFields = {
  source: z.literal(SITE_CONTROL_PAGE_SOURCE),
  version: z.number().int().positive(),
  requestId: z.string().min(1).max(128),
};

export const SiteControlRequestSchema = z.discriminatedUnion('type', [
  z.object({
    ...BaseRequestFields,
    type: z.literal('PING'),
    payload: EmptyPayloadSchema,
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('GET_LIBRARIES'),
    payload: EmptyPayloadSchema,
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('GET_LIBRARY_ITEMS'),
    payload: z.object({ libraryId: IdSchema }),
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('GET_TRAINING_PLANS'),
    payload: EmptyPayloadSchema,
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('GET_PLAN_CONTENTS'),
    payload: z.object({ planId: IdSchema }),
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('GET_ATHLETE_GROUPS'),
    payload: EmptyPayloadSchema,
  }),
  z.object({
    ...BaseRequestFields,
    type: z.literal('OPEN_IMPORTER'),
    payload: z
      .object({
        libraryId: IdSchema.optional(),
        planId: IdSchema.optional(),
        groups: z.boolean().optional(),
      })
      .default({}),
  }),
]);

/**
 * Minimal shape that identifies a message as *ours*.
 *
 * The `source` marker is the gate: anything that fails this pre-parse belongs
 * to some other script on the page and must be ignored silently rather than
 * answered with an error.
 */
export const SiteControlEnvelopeSchema = z.object({
  source: z.literal(SITE_CONTROL_PAGE_SOURCE),
  requestId: z.string().min(1).max(128),
  type: z.unknown(),
  version: z.unknown(),
  payload: z.unknown(),
});

export type SiteControlParseResult =
  | { outcome: 'ignore' }
  | { outcome: 'error'; requestId: string; error: SiteControlError }
  | { outcome: 'ok'; request: SiteControlRequest };

function parseError(
  requestId: string,
  code: SiteControlErrorCode,
  message: string
): SiteControlParseResult {
  return { outcome: 'error', requestId, error: { code, message } };
}

/**
 * Validate a raw message posted by the page.
 *
 * Version and request-type are checked before the payload so the page gets the
 * most specific error available rather than a generic schema failure.
 */
export function parseSiteControlRequest(raw: unknown): SiteControlParseResult {
  const envelope = SiteControlEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return { outcome: 'ignore' };
  }

  const { requestId, version, type } = envelope.data;

  if (version !== PLANMYPEAK_SITE_CONTROL_VERSION) {
    return parseError(
      requestId,
      'UNSUPPORTED_VERSION',
      `Unsupported site-control protocol version. This extension speaks version ${PLANMYPEAK_SITE_CONTROL_VERSION}.`
    );
  }

  if (!isSiteControlRequestType(type)) {
    return parseError(
      requestId,
      'UNSUPPORTED_REQUEST_TYPE',
      'Unsupported site-control request type.'
    );
  }

  const parsed = SiteControlRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return parseError(
      requestId,
      'INVALID_REQUEST',
      `Invalid payload for ${type}: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'payload'} ${issue.message}`)
        .join('; ')}`
    );
  }

  return { outcome: 'ok', request: parsed.data as SiteControlRequest };
}

export function createSuccessResponse<TData>(
  requestId: string,
  data: TData
): SiteControlSuccessResponse<TData> {
  return {
    source: SITE_CONTROL_EXTENSION_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    requestId,
    ok: true,
    data,
  };
}

export function createErrorResponse(
  requestId: string,
  error: SiteControlError
): SiteControlErrorResponse {
  return {
    source: SITE_CONTROL_EXTENSION_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    requestId,
    ok: false,
    error,
  };
}

export function createImportCompletedEvent(
  requestId: string,
  payload: SiteControlImportCompletedPayload
): SiteControlImportCompletedEvent {
  return {
    source: SITE_CONTROL_EXTENSION_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    type: SITE_CONTROL_IMPORT_COMPLETED,
    requestId,
    payload,
  };
}

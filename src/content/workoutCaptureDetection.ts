/**
 * Pure helpers for detecting TrainingPeaks calendar workout writes.
 *
 * Extracted from the main-world interceptor so the URL matching and body
 * reading can be unit tested without patching `fetch` or `XMLHttpRequest`.
 *
 * Only two routes are watched, matched on the exact path:
 *
 *   POST /fitness/v6/athletes/{athleteId}/workouts            → create
 *   PUT  /fitness/v6/athletes/{athleteId}/workouts/{workoutId} → update
 *
 * The workouts collection has sibling routes (`…/workouts/{id}/comments`,
 * `…/workouts/{id}/details`) that must not be captured; a substring check
 * would match them, an anchored pattern does not.
 */

import {
  trainingPeaksEnvironmentForApiOrigin,
  type TrainingPeaksEnvironment,
} from '@/utils/constants';

export interface TrainingPeaksWorkoutWriteMatch {
  kind: 'create' | 'update';
  athleteId: number;
  /** Null for a create: the id is only assigned in the response. */
  workoutId: number | null;
  environment: TrainingPeaksEnvironment;
}

const CREATE_PATH = /^\/fitness\/v6\/athletes\/(\d+)\/workouts\/?$/;
const UPDATE_PATH = /^\/fitness\/v6\/athletes\/(\d+)\/workouts\/(\d+)\/?$/;

/**
 * Decide whether a request is a TrainingPeaks workout create or update.
 * Returns null for anything else, including sibling routes and other hosts.
 */
export function matchTrainingPeaksWorkoutWrite(
  method: string | undefined,
  url: string
): TrainingPeaksWorkoutWriteMatch | null {
  const upperMethod = (method ?? 'GET').toUpperCase();
  if (upperMethod !== 'POST' && upperMethod !== 'PUT') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const environment = trainingPeaksEnvironmentForApiOrigin(parsed.origin);
  if (!environment) {
    return null;
  }

  if (upperMethod === 'POST') {
    const match = CREATE_PATH.exec(parsed.pathname);
    if (!match) {
      return null;
    }
    return {
      kind: 'create',
      athleteId: Number(match[1]),
      workoutId: null,
      environment,
    };
  }

  const match = UPDATE_PATH.exec(parsed.pathname);
  if (!match) {
    return null;
  }
  return {
    kind: 'update',
    athleteId: Number(match[1]),
    workoutId: Number(match[2]),
    environment,
  };
}

/**
 * Parse JSON, returning `undefined` when the text is not valid JSON.
 * `undefined` is unambiguous here because it is not itself a JSON value.
 */
export function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Read a request body as JSON.
 *
 * Only a string body or a `Request` (whose body is read as text) is parsed.
 * Anything else — `FormData`, `Blob`, `URLSearchParams`, a `ReadableStream` —
 * is skipped and yields `undefined`, as does a body that is not valid JSON.
 * A `Request` passed here must be a clone the caller does not otherwise use:
 * reading its body consumes it.
 */
export async function readJsonBody(body: unknown): Promise<unknown> {
  if (typeof body === 'string') {
    return safeParseJson(body);
  }

  if (typeof Request !== 'undefined' && body instanceof Request) {
    const text = await body.text();
    return safeParseJson(text);
  }

  return undefined;
}

/**
 * Take a synchronous handle on the body of a fetch() call, before the original
 * fetch consumes it. `init.body` overrides a Request's own body, as fetch does.
 * Returns the string itself, a clone of the Request, or `undefined` for bodies
 * that will not be parsed. Never awaits anything: dispatch must not be delayed.
 */
export function takeRequestBodyHandle(
  input: RequestInfo | URL,
  init?: RequestInit
): string | Request | undefined {
  if (init && init.body !== undefined && init.body !== null) {
    return typeof init.body === 'string' ? init.body : undefined;
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.clone();
  }

  return undefined;
}

/**
 * The response's `workoutId`, when the body carries a numeric one.
 */
export function readWorkoutIdFromResponse(response: unknown): number | null {
  if (response === null || typeof response !== 'object') {
    return null;
  }
  const value = (response as { workoutId?: unknown }).workoutId;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

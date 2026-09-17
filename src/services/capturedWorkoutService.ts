/**
 * Captured workout service
 *
 * Owns the `captured_workouts` map in `chrome.storage.local`: workouts the
 * main-world interceptor saw being created (or edited) on a TrainingPeaks
 * calendar, kept locally so they can be sent to PlanMyPeak later without
 * asking TrainingPeaks for them again.
 *
 * **Only the background worker writes this key.** Every mutation here is a
 * read-modify-write of the whole map, serialized through one in-memory queue
 * (`withCapturedWorkoutsLock`) so two captures arriving together, or a capture
 * racing a status update, cannot overwrite each other. That guarantee holds
 * only while the worker is the sole writer: the popup and its hooks read the
 * key and send runtime messages, they never call `chrome.storage.local.set`
 * on it. Reads may bypass the queue.
 */

import { STORAGE_KEYS, type TrainingPeaksEnvironment } from '@/utils/constants';
import { logger } from '@/utils/logger';
import {
  CapturedWorkoutPayloadSchema,
  buildCapturedWorkoutKey,
  countPendingCapturedWorkouts,
  parseCapturedWorkoutsStorage,
  sortCapturedWorkoutsNewestFirst,
  type CapturedWorkoutData,
  type CapturedWorkoutPayload,
  type CapturedWorkoutRecord,
  type CapturedWorkoutStatus,
  type CapturedWorkoutsStorage,
} from '@/schemas/capturedWorkout.schema';
import { WorkoutStructureSchema } from '@/schemas/trainingPlan.schema';
import type { WorkoutCapturedMessage } from '@/types';

export interface CapturedWorkoutsList {
  /** Newest first */
  records: CapturedWorkoutRecord[];
  pendingCount: number;
}

export interface CapturedWorkoutPatch {
  status?: CapturedWorkoutStatus;
  planMyPeakWorkoutId?: string;
  planMyPeakLibraryName?: string;
  /** A string records the error; `null` clears it. */
  lastSendError?: string | null;
  /** Overrides the timestamp written when `status` becomes `sent`. */
  sentAt?: number;
}

// ---------------------------------------------------------------------------
// Write queue
// ---------------------------------------------------------------------------

let mutationQueue: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` after every previously queued mutation has settled. A rejected
 * `fn` rejects its own caller but does not block later mutations.
 */
export function withCapturedWorkoutsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(fn, fn);
  mutationQueue = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function readMap(): Promise<CapturedWorkoutsStorage> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_WORKOUTS);
  return parseCapturedWorkoutsStorage(data[STORAGE_KEYS.CAPTURED_WORKOUTS]);
}

async function writeMap(map: CapturedWorkoutsStorage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURED_WORKOUTS]: map });
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Merge the request and response bodies of a capture into one candidate
 * payload. `workoutId` and `athleteId` come from the message (the request
 * body's `workoutId` is `0` on a create); every other field is taken from the
 * response when present and non-null, and from the request otherwise.
 */
export function buildCapturedPayload(
  message: Pick<
    WorkoutCapturedMessage,
    'athleteId' | 'workoutId' | 'request' | 'response'
  >
): unknown {
  const request = isRecord(message.request) ? message.request : {};
  const response = isRecord(message.response) ? message.response : {};

  const merged: Record<string, unknown> = { ...request };
  for (const [key, value] of Object.entries(response)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  merged.athleteId = message.athleteId;
  merged.workoutId = message.workoutId;
  return merged;
}

/**
 * Validate a capture's merged payload. Returns null (and logs) when the body
 * does not carry what we need.
 */
export function parseCapturedWorkoutPayload(
  message: Pick<
    WorkoutCapturedMessage,
    'athleteId' | 'workoutId' | 'request' | 'response'
  >
): CapturedWorkoutPayload | null {
  const parsed = CapturedWorkoutPayloadSchema.safeParse(
    buildCapturedPayload(message)
  );
  if (!parsed.success) {
    logger.warn(
      'Captured workout payload rejected:',
      parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      )
    );
    return null;
  }
  return parsed.data;
}

/**
 * Turn a structure as captured (JSON string, object or absent) into the
 * stored shape: an object validated by `WorkoutStructureSchema`, which drops
 * the derived `polyline` and anything else nothing reads.
 */
function normalizeStructure(
  structure: CapturedWorkoutPayload['structure']
): CapturedWorkoutData['structure'] {
  if (structure === undefined || structure === null) {
    return null;
  }

  let candidate: unknown = structure;
  if (typeof structure === 'string') {
    try {
      candidate = JSON.parse(structure) as unknown;
    } catch {
      logger.warn('Captured workout structure is not valid JSON; dropping it');
      return null;
    }
  }

  const parsed = WorkoutStructureSchema.safeParse(candidate);
  if (!parsed.success) {
    logger.warn(
      'Captured workout structure has an unexpected shape; dropping it'
    );
    return null;
  }
  return parsed.data;
}

/**
 * Reduce a validated payload to the compact workout stored on a record.
 */
export function normalizeCapturedWorkout(
  _kind: WorkoutCapturedMessage['kind'],
  payload: CapturedWorkoutPayload
): CapturedWorkoutData {
  return {
    title: payload.title,
    workoutDay: payload.workoutDay,
    workoutTypeValueId: payload.workoutTypeValueId,
    structure: normalizeStructure(payload.structure),
    totalTimePlanned: payload.totalTimePlanned ?? null,
    tssPlanned: payload.tssPlanned ?? null,
    ifPlanned: payload.ifPlanned ?? null,
    distancePlanned: payload.distancePlanned ?? null,
    caloriesPlanned: payload.caloriesPlanned ?? null,
    velocityPlanned: payload.velocityPlanned ?? null,
    energyPlanned: payload.energyPlanned ?? null,
    elevationGainPlanned: payload.elevationGainPlanned ?? null,
    description: payload.description ?? null,
    coachComments: payload.coachComments ?? null,
    userTags: payload.userTags ?? null,
    lastModifiedDate: payload.lastModifiedDate ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mutations (all serialized)
// ---------------------------------------------------------------------------

/**
 * Store a capture.
 *
 * - `create`: upsert. A new key becomes a `pending` record; an existing key
 *   (a retry, a second tab) has its workout fields and `updatedAt` refreshed
 *   while `status`, `capturedAt`, `sentAt` and the PlanMyPeak ids are kept.
 * - `update`: refresh only. An existing key is refreshed the same way and its
 *   status is never changed — a dismissed workout the coach edits does not
 *   resurface. An unknown key is ignored: edits to workouts that were never
 *   captured are not captures.
 *
 * Returns the stored record, or null when the payload was invalid or the
 * update targeted an unknown key.
 */
export async function storeCapture(
  message: WorkoutCapturedMessage,
  environment: TrainingPeaksEnvironment
): Promise<CapturedWorkoutRecord | null> {
  const payload = parseCapturedWorkoutPayload(message);
  if (!payload) {
    return null;
  }

  const key = buildCapturedWorkoutKey(
    environment,
    payload.athleteId,
    payload.workoutId
  );
  const workout = normalizeCapturedWorkout(message.kind, payload);
  const timestamp =
    typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
      ? message.timestamp
      : Date.now();

  return withCapturedWorkoutsLock(async () => {
    const map = await readMap();
    const existing = map[key];

    if (existing) {
      const refreshed: CapturedWorkoutRecord = {
        ...existing,
        workout,
        updatedAt: Math.max(timestamp, existing.updatedAt),
      };
      map[key] = refreshed;
      await writeMap(map);
      logger.debug('Captured workout refreshed:', key, message.kind);
      return refreshed;
    }

    if (message.kind === 'update') {
      logger.debug('Ignoring edit of a workout that was never captured:', key);
      return null;
    }

    const record: CapturedWorkoutRecord = {
      key,
      athleteId: payload.athleteId,
      workoutId: payload.workoutId,
      environment,
      capturedAt: timestamp,
      updatedAt: timestamp,
      status: 'pending',
      workout,
    };
    map[key] = record;
    await writeMap(map);
    logger.info('Captured workout stored:', key);
    return record;
  });
}

/**
 * Apply a status/outcome patch to one record. Marking a record `sent` stamps
 * `sentAt` and clears `lastSendError`. Returns the updated record, or null
 * when the key is unknown.
 */
export async function updateCapturedWorkout(
  key: string,
  patch: CapturedWorkoutPatch
): Promise<CapturedWorkoutRecord | null> {
  return withCapturedWorkoutsLock(async () => {
    const map = await readMap();
    const existing = map[key];
    if (!existing) {
      logger.debug('Captured workout update ignored: unknown key', key);
      return null;
    }

    const updated: CapturedWorkoutRecord = { ...existing };

    if (patch.status !== undefined) {
      updated.status = patch.status;
      if (patch.status === 'sent') {
        updated.sentAt = patch.sentAt ?? Date.now();
        delete updated.lastSendError;
      }
    }

    if (patch.planMyPeakWorkoutId !== undefined) {
      updated.planMyPeakWorkoutId = patch.planMyPeakWorkoutId;
    }

    if (patch.planMyPeakLibraryName !== undefined) {
      updated.planMyPeakLibraryName = patch.planMyPeakLibraryName;
    }

    if (patch.lastSendError === null) {
      delete updated.lastSendError;
    } else if (patch.lastSendError !== undefined) {
      updated.lastSendError = patch.lastSendError;
    }

    map[key] = updated;
    await writeMap(map);
    return updated;
  });
}

/**
 * Remove every record whose status is in `statuses`. Returns how many were
 * removed.
 */
export async function removeCapturedWorkouts(
  statuses: CapturedWorkoutStatus[]
): Promise<number> {
  const remove = new Set(statuses);

  return withCapturedWorkoutsLock(async () => {
    const map = await readMap();
    let removed = 0;

    for (const [key, record] of Object.entries(map)) {
      if (remove.has(record.status)) {
        delete map[key];
        removed += 1;
      }
    }

    if (removed > 0) {
      await writeMap(map);
    }
    return removed;
  });
}

// ---------------------------------------------------------------------------
// Reads (bypass the queue)
// ---------------------------------------------------------------------------

export async function listCapturedWorkouts(): Promise<CapturedWorkoutsList> {
  const map = await readMap();
  const records = Object.values(map);
  return {
    records: sortCapturedWorkoutsNewestFirst(records),
    pendingCount: countPendingCapturedWorkouts(records),
  };
}

export async function getPendingCapturedCount(): Promise<number> {
  const map = await readMap();
  return countPendingCapturedWorkouts(Object.values(map));
}

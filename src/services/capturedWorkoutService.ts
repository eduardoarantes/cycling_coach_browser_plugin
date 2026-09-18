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

import { z } from 'zod';
import { STORAGE_KEYS, type TrainingPeaksEnvironment } from '@/utils/constants';
import { logger } from '@/utils/logger';
import {
  CapturedWorkoutPayloadSchema,
  acknowledgementKey,
  buildCapturedWorkoutKey,
  countPendingCapturedWorkouts,
  countUnlinkedCapturedWorkouts,
  isImportCandidateFor,
  parseCapturedWorkoutsStorage,
  sortCapturedWorkoutsNewestFirst,
  type CapturedWorkoutAcknowledgement,
  type CapturedWorkoutData,
  type CapturedWorkoutOwner,
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
  /** Informational only: pending records without historical coach metadata. */
  unlinkedCount: number;
}

export interface CapturedWorkoutPatch {
  status?: CapturedWorkoutStatus;
  planMyPeakWorkoutId?: string;
  planMyPeakLibraryName?: string;
  /** A string records the error; `null` clears it. */
  lastSendError?: string | null;
  /** Overrides the timestamp written when `status` becomes `sent`. */
  sentAt?: number;
  /**
   * Record what became of this capture in one destination for one coach. Only
   * ever supplied by the background from its own resolved context.
   */
  acknowledge?: Omit<CapturedWorkoutAcknowledgement, 'at'> & { at?: number };
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

/**
 * Write the map and advance the revision in one storage call, so a reader can
 * never observe new records under an old revision.
 */
async function writeMap(map: CapturedWorkoutsStorage): Promise<void> {
  const revision = (await getCapturedRevision()) + 1;
  await chrome.storage.local.set({
    [STORAGE_KEYS.CAPTURED_WORKOUTS]: map,
    [STORAGE_KEYS.CAPTURED_WORKOUTS_REVISION]: revision,
  });
}

/**
 * The current revision: a counter that increases on every captured-workout or
 * import-operation write. Zero before anything was ever written.
 */
export async function getCapturedRevision(): Promise<number> {
  const data = await chrome.storage.local.get(
    STORAGE_KEYS.CAPTURED_WORKOUTS_REVISION
  );
  const value = data[STORAGE_KEYS.CAPTURED_WORKOUTS_REVISION];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

/**
 * Advance the revision without touching the records. For writers of sibling
 * state (import operations) that a page should also notice. Must be called
 * inside {@link withCapturedWorkoutsLock}, like every other write here.
 */
export async function bumpCapturedRevision(): Promise<number> {
  const revision = (await getCapturedRevision()) + 1;
  await chrome.storage.local.set({
    [STORAGE_KEYS.CAPTURED_WORKOUTS_REVISION]: revision,
  });
  return revision;
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
 * A new record uses supplied metadata or the durable last-known coach cache.
 * Existing annotations are preserved. Automatic enrichment fills missing
 * annotations separately; none of these fields authorize or gate import.
 *
 * Returns the stored record, or null when the payload was invalid or the
 * update targeted an unknown key.
 */
export async function storeCapture(
  message: WorkoutCapturedMessage,
  environment: TrainingPeaksEnvironment,
  owner: CapturedWorkoutOwner | null = null
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

    const annotation = owner ?? (await readCaptureCoachCache());
    const record: CapturedWorkoutRecord = {
      key,
      athleteId: payload.athleteId,
      workoutId: payload.workoutId,
      environment,
      capturedAt: timestamp,
      updatedAt: timestamp,
      status: 'pending',
      workout,
      ...(annotation
        ? {
            owner: {
              coachId: annotation.coachId,
              destination: annotation.destination,
            },
          }
        : {}),
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

    if (patch.acknowledge !== undefined) {
      const acknowledgement: CapturedWorkoutAcknowledgement = {
        ...patch.acknowledge,
        at: patch.acknowledge.at ?? Date.now(),
      };
      updated.acknowledgements = {
        ...(updated.acknowledgements ?? {}),
        [acknowledgementKey(acknowledgement)]: acknowledgement,
      };
    }

    map[key] = updated;
    await writeMap(map);
    return updated;
  });
}

/**
 * Link every record that has no owner to `owner`.
 *
 * Legacy popup compatibility only. Normal capture and import require no
 * manual claim; cache publication and startup enrich absent owners.
 *
 * @deprecated No surface calls this since the popup's Link banner was removed
 * (persist-capture-coach-and-show-all-pending): unowned captures are visible
 * and importable as they are, and owners are filled automatically. Kept, and
 * idempotent, for compatibility only. Remove together with
 * `CLAIM_CAPTURED_WORKOUTS`, its handler, `claimUnlinkedCapturedWorkouts` and
 * the `claim` hook member.
 */
export async function claimUnlinkedCapturedWorkouts(
  owner: CapturedWorkoutOwner
): Promise<number> {
  return withCapturedWorkoutsLock(async () => {
    const map = await readMap();
    let claimed = 0;

    for (const [key, record] of Object.entries(map)) {
      if (record.owner === undefined) {
        map[key] = { ...record, owner };
        claimed += 1;
      }
    }

    if (claimed > 0) {
      await writeMap(map);
      logger.info('Linked unowned captured workouts to a coach:', claimed);
    }
    return claimed;
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
    unlinkedCount: countUnlinkedCapturedWorkouts(records),
  };
}

export async function getPendingCapturedCount(): Promise<number> {
  const map = await readMap();
  return countPendingCapturedWorkouts(Object.values(map));
}

/** Records a page acting for `owner` may be told about: see `isImportCandidateFor`. */
export async function listImportCandidates(
  owner: CapturedWorkoutOwner
): Promise<CapturedWorkoutRecord[]> {
  const map = await readMap();
  return sortCapturedWorkoutsNewestFirst(
    Object.values(map).filter((record) => isImportCandidateFor(record, owner))
  );
}

/** One record by key, or null. Reads bypass the queue. */
export async function getCapturedWorkout(
  key: string
): Promise<CapturedWorkoutRecord | null> {
  const map = await readMap();
  return map[key] ?? null;
}

export async function getUnlinkedCapturedCount(): Promise<number> {
  const map = await readMap();
  return countUnlinkedCapturedWorkouts(Object.values(map));
}

/** Durable metadata only: never used to authorize destination requests. */
const CaptureCoachCacheSchema = z.object({
  version: z.literal(1),
  coachId: z.string().min(1),
  destination: z.url(),
  verifiedAt: z.number().finite().nonnegative(),
});
export type CaptureCoachCache = z.infer<typeof CaptureCoachCacheSchema>;

export async function readCaptureCoachCache(): Promise<CaptureCoachCache | null> {
  try {
    const data = await chrome.storage.local.get(
      STORAGE_KEYS.CAPTURE_COACH_CACHE
    );
    const parsed = CaptureCoachCacheSchema.safeParse(
      data[STORAGE_KEYS.CAPTURE_COACH_CACHE]
    );
    return parsed.success ? parsed.data : null;
  } catch {
    // Metadata must not prevent the workout itself being saved.
    return null;
  }
}

async function backfillCaptureCoachLocked(
  owner: CapturedWorkoutOwner
): Promise<void> {
  const map = await readMap();
  let changed = false;
  for (const record of Object.values(map)) {
    if (!record.owner) {
      record.owner = { coachId: owner.coachId, destination: owner.destination };
      changed = true;
    }
  }
  if (changed) await writeMap(map);
}

/** Save first so startup can resume enrichment if the worker stops. */
export async function publishCaptureCoachCache(
  cache: CaptureCoachCache,
  isCurrent: () => Promise<boolean>
): Promise<void> {
  try {
    const validated = CaptureCoachCacheSchema.parse(cache);
    await withCapturedWorkoutsLock(async () => {
      if (!(await isCurrent())) return;
      await chrome.storage.local.set({
        [STORAGE_KEYS.CAPTURE_COACH_CACHE]: validated,
      });
      await backfillCaptureCoachLocked(validated);
    });
  } catch {
    logger.warn(
      'Could not enrich capture coach metadata; capture/import remains available'
    );
  }
}

export async function backfillCachedCaptureCoach(): Promise<void> {
  try {
    await withCapturedWorkoutsLock(async () => {
      const cache = await readCaptureCoachCache();
      if (cache) await backfillCaptureCoachLocked(cache);
    });
  } catch {
    logger.warn('Could not resume capture coach enrichment');
  }
}

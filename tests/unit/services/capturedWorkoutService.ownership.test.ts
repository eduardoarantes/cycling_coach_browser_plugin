/**
 * Ownership, per-destination acknowledgements, the explicit claim and the
 * shared revision counter on captured workouts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  bumpCapturedRevision,
  claimUnlinkedCapturedWorkouts,
  getCapturedRevision,
  getCapturedWorkout,
  getUnlinkedCapturedCount,
  listCapturedWorkouts,
  listImportCandidates,
  removeCapturedWorkouts,
  storeCapture,
  updateCapturedWorkout,
} from '@/services/capturedWorkoutService';
import {
  acknowledgementFor,
  acknowledgementKey,
} from '@/schemas/capturedWorkout.schema';
import type { WorkoutCapturedMessage } from '@/types';
import {
  OWNER,
  capturedRecord,
  seedRecords,
} from '../background/capturedImports/fixtures';

const OTHER_COACH = { ...OWNER, coachId: 'coach-2' };
const STAGING = {
  ...OWNER,
  destination: 'https://staging.app.planmypeak.com',
};

function capture(
  workoutId: number,
  kind: WorkoutCapturedMessage['kind'] = 'create',
  title = 'Sweet Spot'
): WorkoutCapturedMessage {
  const body = {
    athleteId: 1,
    workoutId,
    title,
    workoutDay: '2026-09-20T00:00:00',
    workoutTypeValueId: 2,
  };
  return {
    type: 'WORKOUT_CAPTURED',
    kind,
    athleteId: 1,
    workoutId,
    request: { ...body, workoutId: 0 },
    response: body,
    timestamp: 1_700_000_000_000 + workoutId,
  };
}

describe('capturedWorkoutService ownership', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  describe('storeCapture owner', () => {
    it('should write the owner resolved at capture time on a new record', async () => {
      const record = await storeCapture(capture(1), 'production', OWNER);

      expect(record?.owner).toEqual(OWNER);
    });

    it('should store a record unowned when no owner could be resolved', async () => {
      const record = await storeCapture(capture(1), 'production', null);

      expect(record).not.toBeNull();
      expect(record).not.toHaveProperty('owner');
    });

    it('should never hand an existing record to whoever is signed in on a later edit', async () => {
      await storeCapture(capture(1), 'production', OWNER);

      const edited = await storeCapture(
        capture(1, 'update', 'Edited'),
        'production',
        OTHER_COACH
      );

      expect(edited?.workout.title).toBe('Edited');
      expect(edited?.owner).toEqual(OWNER);
    });

    it('should leave an unowned record unowned on a later edit', async () => {
      await storeCapture(capture(1), 'production', null);

      const edited = await storeCapture(
        capture(1, 'update'),
        'production',
        OWNER
      );

      expect(edited).not.toHaveProperty('owner');
    });
  });

  describe('acknowledge patch', () => {
    it('should record an acknowledgement keyed by destination and coach, stamped now', async () => {
      await seedRecords([capturedRecord(1)]);

      const updated = await updateCapturedWorkout('production:1:1', {
        acknowledge: {
          ...OWNER,
          reason: 'imported',
          libraryName: 'My Library',
        },
      });

      const acknowledgement = updated && acknowledgementFor(updated, OWNER);
      expect(acknowledgement).toMatchObject({
        ...OWNER,
        reason: 'imported',
        libraryName: 'My Library',
      });
      expect(acknowledgement?.at).toBeGreaterThan(0);
      expect(Object.keys(updated?.acknowledgements ?? {})).toEqual([
        acknowledgementKey(OWNER),
      ]);
    });

    it('should keep acknowledgements for other destinations', async () => {
      await seedRecords([capturedRecord(1)]);
      await updateCapturedWorkout('production:1:1', {
        acknowledge: { ...STAGING, reason: 'imported', at: 5 },
      });

      const updated = await updateCapturedWorkout('production:1:1', {
        acknowledge: { ...OWNER, reason: 'already_present', at: 9 },
      });

      expect(updated && acknowledgementFor(updated, STAGING)?.at).toBe(5);
      expect(updated && acknowledgementFor(updated, OWNER)?.reason).toBe(
        'already_present'
      );
    });

    it('should not change status by itself', async () => {
      await seedRecords([capturedRecord(1)]);

      const updated = await updateCapturedWorkout('production:1:1', {
        acknowledge: { ...OWNER, reason: 'imported' },
      });

      expect(updated?.status).toBe('pending');
    });
  });

  describe('listImportCandidates', () => {
    it('should list undismissed, owned records not acknowledged for that owner, newest first', async () => {
      await seedRecords([
        capturedRecord(1),
        capturedRecord(2),
        capturedRecord(3, { status: 'sent' }),
        capturedRecord(4, { status: 'dismissed' }),
        capturedRecord(5, { owner: OTHER_COACH }),
        capturedRecord(6, { owner: STAGING }),
        capturedRecord(7, { owner: undefined }),
        capturedRecord(8, {
          acknowledgements: {
            [acknowledgementKey(OWNER)]: {
              ...OWNER,
              reason: 'imported',
              at: 1,
            },
          },
        }),
        capturedRecord(9, {
          acknowledgements: {
            [acknowledgementKey(STAGING)]: {
              ...STAGING,
              reason: 'imported',
              at: 1,
            },
          },
        }),
      ]);

      const candidates = await listImportCandidates(OWNER);

      // 3 was sent somewhere with no acknowledgement here, so it is checked
      // rather than assumed present; 9 was acknowledged on staging only.
      expect(candidates.map((record) => record.workoutId)).toEqual([
        9, 3, 2, 1,
      ]);
    });
  });

  describe('claimUnlinkedCapturedWorkouts', () => {
    it('should link every unowned record and leave owned ones alone', async () => {
      await seedRecords([
        capturedRecord(1, { owner: undefined }),
        capturedRecord(2, { owner: undefined, status: 'sent' }),
        capturedRecord(3, { owner: OTHER_COACH }),
      ]);

      const claimed = await claimUnlinkedCapturedWorkouts(OWNER);

      expect(claimed).toBe(2);
      expect((await getCapturedWorkout('production:1:1'))?.owner).toEqual(
        OWNER
      );
      expect((await getCapturedWorkout('production:1:2'))?.owner).toEqual(
        OWNER
      );
      expect((await getCapturedWorkout('production:1:3'))?.owner).toEqual(
        OTHER_COACH
      );
      expect(await getUnlinkedCapturedCount()).toBe(0);
    });

    it('should write nothing when there is nothing to link', async () => {
      await seedRecords([capturedRecord(1)]);
      const before = await getCapturedRevision();

      expect(await claimUnlinkedCapturedWorkouts(OWNER)).toBe(0);
      expect(await getCapturedRevision()).toBe(before);
    });
  });

  describe('unlinked count', () => {
    it('should be reported by the list alongside the pending count', async () => {
      await seedRecords([
        capturedRecord(1, { owner: undefined }),
        capturedRecord(2),
      ]);

      expect(await listCapturedWorkouts()).toMatchObject({
        pendingCount: 2,
        unlinkedCount: 1,
      });
      expect(await getUnlinkedCapturedCount()).toBe(1);
    });
  });

  describe('getCapturedWorkout', () => {
    it('should return null for an unknown key', async () => {
      expect(await getCapturedWorkout('production:1:404')).toBeNull();
    });
  });

  describe('revision', () => {
    it('should start at zero', async () => {
      expect(await getCapturedRevision()).toBe(0);
    });

    it('should advance on every write to the records', async () => {
      await storeCapture(capture(1), 'production', OWNER);
      expect(await getCapturedRevision()).toBe(1);

      await updateCapturedWorkout('production:1:1', { status: 'dismissed' });
      expect(await getCapturedRevision()).toBe(2);

      await removeCapturedWorkouts(['dismissed']);
      expect(await getCapturedRevision()).toBe(3);
    });

    it('should not advance when a write changes nothing', async () => {
      await storeCapture(capture(1), 'production', OWNER);

      await updateCapturedWorkout('production:1:404', { status: 'sent' });
      await removeCapturedWorkouts(['dismissed']);
      await storeCapture(capture(2, 'update'), 'production', OWNER);

      expect(await getCapturedRevision()).toBe(1);
    });

    it('should advance through bumpCapturedRevision without touching records', async () => {
      await seedRecords([capturedRecord(1)]);

      expect(await bumpCapturedRevision()).toBe(1);
      expect((await listCapturedWorkouts()).records).toHaveLength(1);
    });

    it.each([-1, 1.5, 'three', null])(
      'should read a corrupt stored value (%j) as zero',
      async (value) => {
        await chrome.storage.local.set({ captured_workouts_revision: value });

        expect(await getCapturedRevision()).toBe(0);
      }
    );
  });
});

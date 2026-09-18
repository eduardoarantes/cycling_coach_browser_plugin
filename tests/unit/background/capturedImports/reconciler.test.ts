import { describe, it, expect, vi } from 'vitest';
import {
  CapturedWorkoutReconciler,
  RECONCILE_CONCURRENCY,
  type ReconcileCandidate,
} from '@/background/capturedImports/reconciler';
import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakWorkoutLibraryItem } from '@/schemas/planMyPeakApi.schema';

type LookupResult = ApiResponse<PlanMyPeakWorkoutLibraryItem | null>;

function workout(id: string): PlanMyPeakWorkoutLibraryItem {
  return {
    id,
    library: { id: 'lib-1', name: 'My Library' },
  } as PlanMyPeakWorkoutLibraryItem;
}

function candidate(
  workoutId: number,
  updatedAt: number = 1000
): ReconcileCandidate {
  return {
    key: `production:1:${workoutId}`,
    providerWorkoutId: `cal:${workoutId}`,
    updatedAt,
  };
}

const absent: LookupResult = { success: true, data: null };

/** A lookup whose calls resolve only when the test says so. */
function deferredLookup(): {
  lookup: (id: string) => Promise<LookupResult>;
  calls: string[];
  resolve: (id: string, result: LookupResult) => void;
} {
  const resolvers = new Map<string, (result: LookupResult) => void>();
  const calls: string[] = [];
  return {
    calls,
    lookup: (id) => {
      calls.push(id);
      return new Promise<LookupResult>((resolve) => {
        resolvers.set(id, resolve);
      });
    },
    resolve: (id, result) => {
      const resolver = resolvers.get(id);
      if (!resolver) throw new Error(`no lookup in flight for ${id}`);
      resolvers.delete(id);
      resolver(result);
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

describe('CapturedWorkoutReconciler', () => {
  describe('reconcile', () => {
    it('should report an absent identity as missing and a found one as present', async () => {
      const lookup = vi.fn(
        async (id: string): Promise<LookupResult> =>
          id === 'cal:1' ? { success: true, data: workout('w-1') } : absent
      );
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      const outcome = await reconciler.reconcile('ctx', [
        candidate(1),
        candidate(2),
      ]);

      expect(outcome.complete).toBe(true);
      expect(outcome.answers.get('production:1:1')).toEqual({
        present: true,
        workout: workout('w-1'),
      });
      expect(outcome.answers.get('production:1:2')).toEqual({ present: false });
      expect(outcome.failures.size).toBe(0);
    });

    it('should report a failed lookup as incomplete and never as an answer', async () => {
      const lookup = vi.fn(
        async (id: string): Promise<LookupResult> =>
          id === 'cal:2'
            ? { success: false, error: { message: 'HTTP 500' } }
            : absent
      );
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      const outcome = await reconciler.reconcile('ctx', [
        candidate(1),
        candidate(2),
      ]);

      expect(outcome.complete).toBe(false);
      expect(outcome.answers.has('production:1:2')).toBe(false);
      expect(outcome.failures.get('production:1:2')).toBe('HTTP 500');
      expect(outcome.answers.get('production:1:1')).toEqual({ present: false });
    });

    it('should turn a lookup that throws into a failure', async () => {
      const reconciler = new CapturedWorkoutReconciler({
        lookup: async () => {
          throw new Error('network down');
        },
      });

      const outcome = await reconciler.reconcile('ctx', [candidate(1)]);

      expect(outcome.complete).toBe(false);
      expect(outcome.failures.get('production:1:1')).toBe('network down');
    });

    it('should not cache a failed lookup', async () => {
      const lookup = vi
        .fn<(id: string) => Promise<LookupResult>>()
        .mockResolvedValueOnce({ success: false, error: { message: 'boom' } })
        .mockResolvedValueOnce(absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      await reconciler.reconcile('ctx', [candidate(1)]);
      const second = await reconciler.reconcile('ctx', [candidate(1)]);

      expect(lookup).toHaveBeenCalledTimes(2);
      expect(second.complete).toBe(true);
    });

    it('should resolve with no lookups for an empty candidate list', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      const outcome = await reconciler.reconcile('ctx', []);

      expect(outcome.complete).toBe(true);
      expect(lookup).not.toHaveBeenCalled();
    });
  });

  describe('cache', () => {
    it('should answer from cache within the TTL and look up again after it', async () => {
      let now = 0;
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({
        lookup,
        now: () => now,
        ttlMs: 1000,
      });

      await reconciler.reconcile('ctx', [candidate(1)]);
      now = 999;
      await reconciler.reconcile('ctx', [candidate(1)]);
      expect(lookup).toHaveBeenCalledTimes(1);

      now = 1000;
      await reconciler.reconcile('ctx', [candidate(1)]);
      expect(lookup).toHaveBeenCalledTimes(2);
    });

    it('should forget an answer when the capture it was about changes', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      await reconciler.reconcile('ctx', [candidate(1, 1000)]);
      await reconciler.reconcile('ctx', [candidate(1, 2000)]);

      expect(lookup).toHaveBeenCalledTimes(2);
    });

    it('should keep answers per context', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });

      await reconciler.reconcile('ctx-a', [candidate(1)]);
      await reconciler.reconcile('ctx-b', [candidate(1)]);

      expect(lookup).toHaveBeenCalledTimes(2);
    });

    it('should forget one context on invalidate(contextId) and keep the others', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });
      await reconciler.reconcile('ctx-a', [candidate(1)]);
      await reconciler.reconcile('ctx-b', [candidate(1)]);

      reconciler.invalidate('ctx-a');
      await reconciler.reconcile('ctx-a', [candidate(1)]);
      await reconciler.reconcile('ctx-b', [candidate(1)]);

      expect(lookup).toHaveBeenCalledTimes(3);
    });

    it('should forget everything on invalidate()', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });
      await reconciler.reconcile('ctx-a', [candidate(1)]);
      await reconciler.reconcile('ctx-b', [candidate(1)]);

      reconciler.invalidate();
      await reconciler.reconcile('ctx-a', [candidate(1)]);
      await reconciler.reconcile('ctx-b', [candidate(1)]);

      expect(lookup).toHaveBeenCalledTimes(4);
    });

    it('should forget one capture in every context on invalidateKey', async () => {
      const lookup = vi.fn(async (): Promise<LookupResult> => absent);
      const reconciler = new CapturedWorkoutReconciler({ lookup });
      await reconciler.reconcile('ctx-a', [candidate(1), candidate(2)]);

      reconciler.invalidateKey('production:1:1');
      await reconciler.reconcile('ctx-a', [candidate(1), candidate(2)]);

      expect(lookup).toHaveBeenCalledTimes(3);
      expect(lookup).toHaveBeenLastCalledWith('cal:1');
    });
  });

  describe('coalescing', () => {
    it('should share one in-flight lookup between concurrent callers', async () => {
      const deferred = deferredLookup();
      const reconciler = new CapturedWorkoutReconciler({
        lookup: deferred.lookup,
      });

      const first = reconciler.reconcile('ctx', [candidate(1)]);
      const second = reconciler.reconcile('ctx', [candidate(1)]);
      await flush();

      expect(deferred.calls).toEqual(['cal:1']);

      deferred.resolve('cal:1', absent);
      const [a, b] = await Promise.all([first, second]);
      expect(a.answers.get('production:1:1')).toEqual({ present: false });
      expect(b.answers.get('production:1:1')).toEqual({ present: false });
    });
  });

  describe('concurrency', () => {
    it('should default to four lookups in flight', () => {
      expect(RECONCILE_CONCURRENCY).toBe(4);
    });

    it('should never exceed the bound, and still attempt every candidate', async () => {
      let active = 0;
      let peak = 0;
      const lookup = async (): Promise<LookupResult> => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return absent;
      };
      const reconciler = new CapturedWorkoutReconciler({
        lookup,
        concurrency: 2,
      });
      const candidates = Array.from({ length: 9 }, (_, i) => candidate(i + 1));

      const outcome = await reconciler.reconcile('ctx', candidates);

      expect(peak).toBe(2);
      expect(outcome.answers.size).toBe(9);
    });
  });
});

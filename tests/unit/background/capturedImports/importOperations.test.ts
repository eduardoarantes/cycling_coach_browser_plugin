import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_OPERATION_ERRORS,
  findOperation,
  getContextOperations,
  hasLiveOperation,
  isOperationLive,
  markOperationDone,
  markOperationLive,
  recordOperationError,
  recoverInterruptedOperations,
  resetLiveOperations,
  saveOperation,
  toOperationRef,
  toOperationStatus,
  type CapturedImportOperation,
} from '@/background/capturedImports/importOperations';
import { getCapturedRevision } from '@/services/capturedWorkoutService';

function operation(
  overrides: Partial<CapturedImportOperation> = {}
): CapturedImportOperation {
  return {
    operationId: 'op-1',
    contextId: 'ctx-a',
    coachId: 'coach-1',
    destination: 'https://portal.planmypeak.com',
    state: 'running',
    startedAt: 1000,
    updatedAt: 1000,
    totalCount: 2,
    processedCount: 0,
    importedCount: 0,
    alreadyPresentCount: 0,
    failedCount: 0,
    errors: [],
    recordKeys: ['production:1:1', 'production:1:2'],
    ...overrides,
  };
}

describe('importOperations', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    resetLiveOperations();
  });

  describe('saveOperation', () => {
    it('should hold a running operation as the active one', async () => {
      await saveOperation(operation());

      const { active, latest } = await getContextOperations('ctx-a');
      expect(active?.operationId).toBe('op-1');
      expect(latest).toBeNull();
    });

    it('should move a finished operation to latest and free the active slot', async () => {
      await saveOperation(operation());
      await saveOperation(operation({ state: 'completed', importedCount: 2 }));

      const { active, latest } = await getContextOperations('ctx-a');
      expect(active).toBeNull();
      expect(latest?.state).toBe('completed');
      expect(latest?.importedCount).toBe(2);
    });

    it('should not free the active slot for a different finished operation', async () => {
      await saveOperation(operation({ operationId: 'op-running' }));
      await saveOperation(
        operation({ operationId: 'op-done', state: 'completed' })
      );

      const { active, latest } = await getContextOperations('ctx-a');
      expect(active?.operationId).toBe('op-running');
      expect(latest?.operationId).toBe('op-done');
    });

    it('should keep only the latest finished operation per context', async () => {
      await saveOperation(
        operation({ operationId: 'op-1', state: 'completed' })
      );
      await saveOperation(
        operation({ operationId: 'op-2', state: 'completed' })
      );

      expect(await findOperation('ctx-a', 'op-1')).toBeNull();
      expect((await findOperation('ctx-a', 'op-2'))?.operationId).toBe('op-2');
    });

    it('should keep contexts apart', async () => {
      await saveOperation(operation());
      await saveOperation(
        operation({ contextId: 'ctx-b', operationId: 'op-b' })
      );

      expect((await getContextOperations('ctx-a')).active?.operationId).toBe(
        'op-1'
      );
      expect((await getContextOperations('ctx-b')).active?.operationId).toBe(
        'op-b'
      );
      expect(await findOperation('ctx-b', 'op-1')).toBeNull();
    });

    it('should advance the shared revision on every save', async () => {
      const before = await getCapturedRevision();

      await saveOperation(operation());
      await saveOperation(operation({ processedCount: 1 }));

      expect(await getCapturedRevision()).toBe(before + 2);
    });
  });

  describe('findOperation', () => {
    it('should find an operation in either slot and nothing else', async () => {
      await saveOperation(
        operation({ operationId: 'op-done', state: 'blocked' })
      );
      await saveOperation(operation({ operationId: 'op-running' }));

      expect((await findOperation('ctx-a', 'op-done'))?.state).toBe('blocked');
      expect((await findOperation('ctx-a', 'op-running'))?.state).toBe(
        'running'
      );
      expect(await findOperation('ctx-a', 'nope')).toBeNull();
      expect(await findOperation('ctx-unknown', 'op-done')).toBeNull();
    });
  });

  describe('liveness', () => {
    it('should track which operations have a loop in this worker', () => {
      expect(hasLiveOperation()).toBe(false);

      markOperationLive('op-1');
      expect(isOperationLive('op-1')).toBe(true);
      expect(hasLiveOperation()).toBe(true);

      markOperationDone('op-1');
      expect(isOperationLive('op-1')).toBe(false);
      expect(hasLiveOperation()).toBe(false);
    });
  });

  describe('recoverInterruptedOperations', () => {
    it('should mark a running operation no loop owns as interrupted', async () => {
      await saveOperation(operation({ processedCount: 1, importedCount: 1 }));

      const recovered = await recoverInterruptedOperations(5000);

      expect(recovered).toBe(1);
      const { active, latest } = await getContextOperations('ctx-a');
      expect(active).toBeNull();
      expect(latest).toMatchObject({
        operationId: 'op-1',
        state: 'interrupted',
        updatedAt: 5000,
        importedCount: 1,
      });
    });

    it('should leave a live operation alone', async () => {
      await saveOperation(operation());
      markOperationLive('op-1');

      expect(await recoverInterruptedOperations()).toBe(0);
      expect((await getContextOperations('ctx-a')).active?.state).toBe(
        'running'
      );
    });

    it('should not write or move the revision when nothing needs recovering', async () => {
      await saveOperation(operation({ state: 'completed' }));
      const before = await getCapturedRevision();

      expect(await recoverInterruptedOperations()).toBe(0);
      expect(await getCapturedRevision()).toBe(before);
    });

    it('should tolerate storage that is not an object', async () => {
      await chrome.storage.local.set({ captured_import_operations: 'garbage' });

      expect(await recoverInterruptedOperations()).toBe(0);
      expect(await getContextOperations('ctx-a')).toEqual({
        active: null,
        latest: null,
      });
    });
  });

  describe('page shapes', () => {
    it('should reduce an operation to an id and a state for a ref', () => {
      expect(toOperationRef(operation())).toEqual({
        operationId: 'op-1',
        state: 'running',
      });
      expect(toOperationRef(null)).toBeNull();
    });

    it('should not carry record keys, the coach or the destination in a status', () => {
      const status = toOperationStatus(
        operation({ state: 'blocked', blockedReason: 'account_changed' })
      );

      expect(status).toEqual({
        operationId: 'op-1',
        contextId: 'ctx-a',
        state: 'blocked',
        totalCount: 2,
        processedCount: 0,
        importedCount: 0,
        alreadyPresentCount: 0,
        failedCount: 0,
        blockedReason: 'account_changed',
        errors: [],
        startedAt: 1000,
        updatedAt: 1000,
      });
    });

    it('should omit blockedReason when there is none', () => {
      expect(toOperationStatus(operation())).not.toHaveProperty(
        'blockedReason'
      );
    });
  });

  describe('recordOperationError', () => {
    it('should stop keeping errors at the bound', () => {
      const target = operation();

      for (let i = 0; i < MAX_OPERATION_ERRORS + 5; i += 1) {
        recordOperationError(target, { title: `w${i}`, message: 'failed' });
      }

      expect(target.errors).toHaveLength(MAX_OPERATION_ERRORS);
      expect(target.errors[0].title).toBe('w0');
    });
  });
});

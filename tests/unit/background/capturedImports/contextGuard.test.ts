import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveRequestContext,
  verifyOperationContext,
} from '@/background/capturedImports/contextGuard';
import * as authRecovery from '@/background/api/planMyPeakAuthRecovery';
import * as identityService from '@/services/planMyPeakIdentityService';
import { STORAGE_KEYS } from '@/utils/constants';

const DESTINATION = 'https://portal.planmypeak.com';

const context: identityService.CaptureContext = {
  coachId: 'coach-1',
  destination: DESTINATION,
  environment: 'production',
  contextId: 'ctx-a',
};

describe('contextGuard', () => {
  let resolveCredential: ReturnType<typeof vi.spyOn>;
  let resolveCaptureContext: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    await chrome.storage.local.clear();
    resolveCredential = vi
      .spyOn(authRecovery, 'resolveCredential')
      .mockResolvedValue({ usable: true, token: 'token-a' });
    resolveCaptureContext = vi
      .spyOn(identityService, 'resolveCaptureContext')
      .mockResolvedValue(context);
  });

  describe('resolveRequestContext', () => {
    it('should resolve the stored context when the page is the configured destination', async () => {
      expect(await resolveRequestContext(DESTINATION)).toEqual({
        ok: true,
        context,
      });
    });

    it('should refuse with connection_disabled first, before looking at the session', async () => {
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONNECTION_ENABLE_PLANMYPEAK]: false,
      });

      expect(await resolveRequestContext(DESTINATION)).toEqual({
        ok: false,
        reason: 'connection_disabled',
        coachId: null,
      });
      expect(resolveCredential).not.toHaveBeenCalled();
      expect(resolveCaptureContext).not.toHaveBeenCalled();
    });

    it('should refuse with signed_out when there is no PlanMyPeak session', async () => {
      resolveCredential.mockResolvedValue({ usable: false, token: null });

      expect(await resolveRequestContext(DESTINATION)).toEqual({
        ok: false,
        reason: 'signed_out',
        coachId: null,
      });
      expect(resolveCaptureContext).not.toHaveBeenCalled();
    });

    it('should refuse with account_unknown when the coach cannot be resolved', async () => {
      resolveCaptureContext.mockResolvedValue(null);

      expect(await resolveRequestContext(DESTINATION)).toEqual({
        ok: false,
        reason: 'account_unknown',
        coachId: null,
      });
    });

    it('should refuse a page that is not the configured destination and still name the coach', async () => {
      expect(
        await resolveRequestContext('https://staging.app.planmypeak.com')
      ).toEqual({
        ok: false,
        reason: 'destination_mismatch',
        coachId: 'coach-1',
      });
    });

    it('should compare the port as part of the origin', async () => {
      resolveCaptureContext.mockResolvedValue({
        ...context,
        destination: 'https://localhost:3002',
        environment: 'local',
      });

      expect((await resolveRequestContext('https://localhost:3002')).ok).toBe(
        true
      );
      expect((await resolveRequestContext('https://localhost:3005')).ok).toBe(
        false
      );
    });

    it.each([null, undefined, ''])(
      'should refuse an absent origin (%s)',
      async (origin) => {
        const resolution = await resolveRequestContext(origin);

        expect(resolution.ok).toBe(false);
        expect(resolution).toMatchObject({ reason: 'destination_mismatch' });
      }
    );
  });

  describe('verifyOperationContext', () => {
    const operation = { coachId: 'coach-1', destination: DESTINATION };

    it('should allow a run whose coach and destination still hold', async () => {
      expect(await verifyOperationContext(operation)).toEqual({ ok: true });
    });

    it('should stop a run when the extension now acts as another coach', async () => {
      resolveCaptureContext.mockResolvedValue({
        ...context,
        coachId: 'coach-2',
      });

      expect(await verifyOperationContext(operation)).toEqual({
        ok: false,
        reason: 'account_changed',
      });
    });

    it('should stop a run when the configured destination moved', async () => {
      resolveCaptureContext.mockResolvedValue({
        ...context,
        destination: 'https://staging.app.planmypeak.com',
        environment: 'staging',
      });

      expect(await verifyOperationContext(operation)).toEqual({
        ok: false,
        reason: 'account_changed',
      });
    });

    it('should report every other refusal as account_changed too', async () => {
      resolveCredential.mockResolvedValue({ usable: false, token: null });

      expect(await verifyOperationContext(operation)).toEqual({
        ok: false,
        reason: 'account_changed',
      });
    });
  });
});

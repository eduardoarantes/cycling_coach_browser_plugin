/**
 * Unit tests for site-control request routing in the background worker.
 *
 * These cover the security boundary: which senders may reach the handlers, what
 * a page is allowed to ask for, and what may never appear in a response.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as trainingPeaksApi from '@/background/api/trainingPeaks';
import * as authService from '@/services/authService';
import * as myPeakAuthService from '@/services/myPeakAuthService';
import type { SiteControlRequestMessage } from '@/types';
import type {
  SiteControlPingResult,
  SiteControlPlanContentsResult,
  SiteControlRequest,
  SiteControlResponse,
} from '@/types/siteControl.types';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';

vi.mock('@/background/api/trainingPeaks');

const ALLOWED_ORIGIN = 'https://portal.planmypeak.com';

function tabSender(origin: string): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    origin,
    tab: { id: 7, url: `${origin}/dashboard` } as chrome.tabs.Tab,
  };
}

function request(
  type: SiteControlRequest['type'],
  payload: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {}
): SiteControlRequestMessage {
  return {
    type: 'SITE_CONTROL_REQUEST',
    request: {
      source: SITE_CONTROL_PAGE_SOURCE,
      version: PLANMYPEAK_SITE_CONTROL_VERSION,
      requestId: 'req-1',
      type,
      payload,
      ...overrides,
    } as SiteControlRequest,
  };
}

async function send(
  message: SiteControlRequestMessage,
  sender: chrome.runtime.MessageSender = tabSender(ALLOWED_ORIGIN)
): Promise<SiteControlResponse> {
  return (await handleMessage(message, sender)) as SiteControlResponse;
}

describe('messageHandler site-control routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authService, 'isAuthenticated').mockResolvedValue(true);
    vi.spyOn(authService, 'isTokenExpired').mockResolvedValue(false);
    vi.spyOn(myPeakAuthService, 'isAuthenticated').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sender authorization', () => {
    it('should dispatch a request from an allowlisted origin', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await send(request('GET_LIBRARIES'));

      expect(response.ok).toBe(true);
      expect(trainingPeaksApi.fetchLibraries).toHaveBeenCalledTimes(1);
    });

    it('should reject a non-allowlisted origin without touching any handler', async () => {
      const response = await send(
        request('GET_LIBRARIES'),
        tabSender('https://evil.test')
      );

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('FORBIDDEN_ORIGIN');
      expect(trainingPeaksApi.fetchLibraries).not.toHaveBeenCalled();
    });

    it('should reject a lookalike origin', async () => {
      const response = await send(
        request('GET_LIBRARIES'),
        tabSender('https://portal.planmypeak.com.evil.test')
      );

      expect(response.ok).toBe(false);
      expect(trainingPeaksApi.fetchLibraries).not.toHaveBeenCalled();
    });

    it('should reject a sender with no tab (extension page or service worker)', async () => {
      const response = await send(request('GET_LIBRARIES'), {
        id: 'test-extension-id',
        origin: ALLOWED_ORIGIN,
      });

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('FORBIDDEN_ORIGIN');
      expect(trainingPeaksApi.fetchLibraries).not.toHaveBeenCalled();
    });

    it('should fall back to the tab url when sender.origin is absent', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await send(request('GET_LIBRARIES'), {
        id: 'test-extension-id',
        tab: {
          id: 7,
          url: `${ALLOWED_ORIGIN}/library/3`,
        } as chrome.tabs.Tab,
      });

      expect(response.ok).toBe(true);
    });

    it('should reject when the tab url origin is not allowlisted', async () => {
      const response = await send(request('GET_LIBRARIES'), {
        id: 'test-extension-id',
        tab: { id: 7, url: 'https://evil.test/x' } as chrome.tabs.Tab,
      });

      expect(response.ok).toBe(false);
      expect(trainingPeaksApi.fetchLibraries).not.toHaveBeenCalled();
    });
  });

  describe('request re-validation in the background', () => {
    it('should reject an unsupported request type reaching the background', async () => {
      const response = await send(
        request('GET_TOKEN' as SiteControlRequest['type'])
      );

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('UNSUPPORTED_REQUEST_TYPE');
    });

    it('should reject a malformed payload reaching the background', async () => {
      const response = await send(
        request('GET_LIBRARY_ITEMS', { libraryId: 'nope' })
      );

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('INVALID_REQUEST');
      expect(trainingPeaksApi.fetchLibraryItems).not.toHaveBeenCalled();
    });

    it('should reject a request carrying an unsupported protocol version', async () => {
      const response = await send(
        request('GET_LIBRARIES', {}, { version: 99 })
      );

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('UNSUPPORTED_VERSION');
    });

    it('should refuse OPEN_IMPORTER in the background', async () => {
      const response = await send(request('OPEN_IMPORTER'));

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PING', () => {
    it('should report readiness for both connections', async () => {
      const response = await send(request('PING'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      const data = response.data as SiteControlPingResult;
      expect(data.protocolVersion).toBe(PLANMYPEAK_SITE_CONTROL_VERSION);
      expect(data.extensionVersion).toBe('1.0.0');
      expect(data.trainingPeaks).toEqual({ authenticated: true });
      expect(data.planMyPeak).toEqual({ authenticated: true });
    });

    it('should report TrainingPeaks as unauthenticated when no token is stored', async () => {
      vi.spyOn(authService, 'isAuthenticated').mockResolvedValue(false);

      const response = await send(request('PING'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(
        (response.data as SiteControlPingResult).trainingPeaks.authenticated
      ).toBe(false);
    });

    it('should report TrainingPeaks as unauthenticated when the token is expired', async () => {
      vi.spyOn(authService, 'isTokenExpired').mockResolvedValue(true);

      const response = await send(request('PING'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(
        (response.data as SiteControlPingResult).trainingPeaks.authenticated
      ).toBe(false);
    });

    it('should report PlanMyPeak as unauthenticated when no token is stored', async () => {
      vi.spyOn(myPeakAuthService, 'isAuthenticated').mockResolvedValue(false);

      const response = await send(request('PING'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(
        (response.data as SiteControlPingResult).planMyPeak.authenticated
      ).toBe(false);
    });

    it('should expose readiness booleans only, never credentials', async () => {
      const response = await send(request('PING'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      const data = response.data as SiteControlPingResult;
      expect(Object.keys(data).sort()).toEqual([
        'extensionVersion',
        'planMyPeak',
        'protocolVersion',
        'trainingPeaks',
      ]);
      expect(Object.keys(data.trainingPeaks)).toEqual(['authenticated']);
      expect(Object.keys(data.planMyPeak)).toEqual(['authenticated']);
    });
  });

  describe('TrainingPeaks reads', () => {
    it('should return libraries', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: [{ exerciseLibraryId: 1, libraryName: 'Base' }] as never,
      });

      const response = await send(request('GET_LIBRARIES'));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.data).toEqual([
        { exerciseLibraryId: 1, libraryName: 'Base' },
      ]);
    });

    it('should return library items for the requested library', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraryItems').mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await send(
        request('GET_LIBRARY_ITEMS', { libraryId: 42 })
      );

      expect(response.ok).toBe(true);
      expect(trainingPeaksApi.fetchLibraryItems).toHaveBeenCalledWith(42);
    });

    it('should return training plans', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchTrainingPlans').mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await send(request('GET_TRAINING_PLANS'));

      expect(response.ok).toBe(true);
    });

    it('should map a NO_TOKEN failure to AUTH_REQUIRED', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: false,
        error: { message: 'Not authenticated', code: 'NO_TOKEN' },
      });

      const response = await send(request('GET_LIBRARIES'));

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('AUTH_REQUIRED');
      expect(response.error.message).toBe('Not authenticated');
    });

    it('should surface an upstream failure as API_ERROR', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: false,
        error: { message: 'TrainingPeaks returned 500', code: 'API_ERROR' },
      });

      const response = await send(request('GET_LIBRARIES'));

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('API_ERROR');
    });
  });

  describe('GET_PLAN_CONTENTS', () => {
    function mockAllLegsSucceed(): void {
      vi.spyOn(trainingPeaksApi, 'fetchPlanWorkouts').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(trainingPeaksApi, 'fetchPlanNotes').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(trainingPeaksApi, 'fetchPlanEvents').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(trainingPeaksApi, 'fetchRxBuilderWorkouts').mockResolvedValue({
        success: true,
        data: [],
      });
    }

    it('should combine all four legs into one result', async () => {
      mockAllLegsSucceed();

      const response = await send(request('GET_PLAN_CONTENTS', { planId: 5 }));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      const data = response.data as SiteControlPlanContentsResult;
      expect(data).toEqual({
        planId: 5,
        workouts: [],
        notes: [],
        events: [],
        rxWorkouts: [],
      });
      expect(trainingPeaksApi.fetchPlanWorkouts).toHaveBeenCalledWith(5);
      expect(trainingPeaksApi.fetchRxBuilderWorkouts).toHaveBeenCalledWith(5);
    });

    it('should fail as a whole when any leg fails', async () => {
      mockAllLegsSucceed();
      vi.spyOn(trainingPeaksApi, 'fetchPlanNotes').mockResolvedValue({
        success: false,
        error: { message: 'notes unavailable', code: 'API_ERROR' },
      });

      const response = await send(request('GET_PLAN_CONTENTS', { planId: 5 }));

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.message).toBe('notes unavailable');
    });

    it('should report AUTH_REQUIRED when a leg fails for lack of a token', async () => {
      mockAllLegsSucceed();
      vi.spyOn(trainingPeaksApi, 'fetchPlanWorkouts').mockResolvedValue({
        success: false,
        error: { message: 'Not authenticated', code: 'NO_TOKEN' },
      });

      const response = await send(request('GET_PLAN_CONTENTS', { planId: 5 }));

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('response hygiene', () => {
    it('should echo the request id on every response', async () => {
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: [],
      });

      const ok = await send(
        request('GET_LIBRARIES', {}, { requestId: 'abc-123' })
      );
      const rejected = await send(
        request('GET_LIBRARIES', {}, { requestId: 'abc-456' }),
        tabSender('https://evil.test')
      );

      expect(ok.requestId).toBe('abc-123');
      expect(rejected.requestId).toBe('abc-456');
    });

    it('should never include credential material in a response', async () => {
      await chrome.storage.local.set({
        auth_token: 'gAAAA-secret-tp-token',
        mypeak_auth_token: 'eyJ-secret-pmp-token',
        mypeak_supabase_api_key: 'eyJ-secret-anon-key',
        intervals_api_key: 'secret-intervals-key',
      });
      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: [],
      });

      const responses = await Promise.all([
        send(request('PING')),
        send(request('GET_LIBRARIES')),
        send(request('GET_LIBRARIES'), tabSender('https://evil.test')),
      ]);

      for (const response of responses) {
        const serialized = JSON.stringify(response);
        expect(serialized).not.toContain('gAAAA-secret-tp-token');
        expect(serialized).not.toContain('eyJ-secret-pmp-token');
        expect(serialized).not.toContain('eyJ-secret-anon-key');
        expect(serialized).not.toContain('secret-intervals-key');
      }
    });
  });
});

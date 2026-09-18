import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COACH_LOOKUP_TIMEOUT_MS,
  buildContextId,
  peekCaptureContext,
  peekPlanMyPeakCoachId,
  primePlanMyPeakIdentity,
  primePlanMyPeakIdentityIfCurrent,
  resetPlanMyPeakIdentityCache,
  resolveCaptureContext,
  resolvePlanMyPeakCoachId,
} from '@/services/planMyPeakIdentityService';
import { STORAGE_KEYS } from '@/utils/constants';

// The coach lookup is `GET /api/backend/coaches/me`; it is faked at `fetch`
// so the real client, its schema and its abort signal are all exercised.
const fetchCoach = vi.fn<typeof fetch>();

async function signIn(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.MYPEAK_AUTH_TOKEN]: token });
}

function coach(id: string): Response {
  return { ok: true, status: 200, json: async () => ({ id }) } as Response;
}

const serverError = {
  ok: false,
  status: 500,
  json: async () => ({ message: 'HTTP 500' }),
} as Response;

describe('planMyPeakIdentityService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    fetchCoach.mockReset();
    global.fetch = fetchCoach;
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'production',
    });
    resetPlanMyPeakIdentityCache();
  });

  describe('resolvePlanMyPeakCoachId', () => {
    it('should be unknown, without a lookup, when there is no token', async () => {
      expect(await resolvePlanMyPeakCoachId()).toBeNull();
      expect(fetchCoach).not.toHaveBeenCalled();
    });

    it('should resolve the coach once per token and answer from cache after', async () => {
      await signIn('token-a');
      fetchCoach.mockResolvedValue(coach('coach-1'));

      expect(await resolvePlanMyPeakCoachId()).toBe('coach-1');
      expect(await resolvePlanMyPeakCoachId()).toBe('coach-1');
      expect(fetchCoach).toHaveBeenCalledTimes(1);
    });

    it('should never answer a new token from the previous coach', async () => {
      await signIn('token-a');
      fetchCoach.mockResolvedValueOnce(coach('coach-1'));
      await resolvePlanMyPeakCoachId();

      await signIn('token-b');
      fetchCoach.mockResolvedValueOnce(coach('coach-2'));

      expect(await resolvePlanMyPeakCoachId()).toBe('coach-2');
    });

    it('should be unknown when the lookup fails, and not cache that', async () => {
      await signIn('token-a');
      fetchCoach.mockResolvedValueOnce(serverError);
      expect(await resolvePlanMyPeakCoachId()).toBeNull();

      fetchCoach.mockResolvedValueOnce(coach('coach-1'));
      expect(await resolvePlanMyPeakCoachId()).toBe('coach-1');
    });

    it('should discard a profile fetched before the session changed, and cache nothing', async () => {
      await signIn('token-a');
      fetchCoach.mockImplementationOnce(async () => {
        // Coach B signs in while A's profile request is in flight.
        await signIn('token-b');
        return coach('coach-a');
      });

      expect(await resolvePlanMyPeakCoachId()).toBeNull();
      expect(await peekPlanMyPeakCoachId()).toBeNull();

      fetchCoach.mockResolvedValueOnce(coach('coach-b'));
      expect(await resolvePlanMyPeakCoachId()).toBe('coach-b');
    });

    it('should be unknown when the lookup throws', async () => {
      await signIn('token-a');
      fetchCoach.mockRejectedValue(new Error('aborted'));

      expect(await resolvePlanMyPeakCoachId()).toBeNull();
    });

    it('should bound the lookup well inside a page detection timeout', async () => {
      await signIn('token-a');
      fetchCoach.mockResolvedValue(coach('coach-1'));

      await resolvePlanMyPeakCoachId();

      expect(COACH_LOOKUP_TIMEOUT_MS).toBeLessThanOrEqual(1500);
      expect(fetchCoach.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('peekPlanMyPeakCoachId', () => {
    it('should never make a request', async () => {
      await signIn('token-a');

      expect(await peekPlanMyPeakCoachId()).toBeNull();
      expect(fetchCoach).not.toHaveBeenCalled();
    });

    it('should answer once another path primed the current token', async () => {
      await signIn('token-a');
      primePlanMyPeakIdentity('token-a', 'coach-1');

      expect(await peekPlanMyPeakCoachId()).toBe('coach-1');
    });

    it('should ignore an identity primed for a different token', async () => {
      await signIn('token-b');
      primePlanMyPeakIdentity('token-a', 'coach-1');

      expect(await peekPlanMyPeakCoachId()).toBeNull();
    });

    it('should be unknown after sign-out even when primed', async () => {
      primePlanMyPeakIdentity('token-a', 'coach-1');

      expect(await peekPlanMyPeakCoachId()).toBeNull();
    });
  });

  describe('primePlanMyPeakIdentityIfCurrent', () => {
    it('should prime when the session is still the one the fetch ran under', async () => {
      await signIn('token-a');

      expect(await primePlanMyPeakIdentityIfCurrent('token-a', 'coach-a')).toBe(
        true
      );
      expect(await peekPlanMyPeakCoachId()).toBe('coach-a');
    });

    it('should refuse to bind a profile to a token it was not fetched with', async () => {
      await signIn('token-b');

      expect(await primePlanMyPeakIdentityIfCurrent('token-a', 'coach-a')).toBe(
        false
      );
      expect(await peekPlanMyPeakCoachId()).toBeNull();
    });

    it('should prime nothing without a token at request time', async () => {
      await signIn('token-a');

      expect(await primePlanMyPeakIdentityIfCurrent(null, 'coach-a')).toBe(
        false
      );
      expect(await peekPlanMyPeakCoachId()).toBeNull();
    });
  });

  describe('resolveCaptureContext', () => {
    it('should pair the coach with the configured destination', async () => {
      await signIn('token-a');
      fetchCoach.mockResolvedValue(coach('coach-1'));

      expect(await resolveCaptureContext()).toEqual({
        coachId: 'coach-1',
        destination: 'https://portal.planmypeak.com',
        environment: 'production',
        contextId: buildContextId({
          coachId: 'coach-1',
          destination: 'https://portal.planmypeak.com',
        }),
      });
    });

    it('should follow the selected environment', async () => {
      await signIn('token-a');
      await chrome.storage.local.set({
        [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'staging',
      });
      fetchCoach.mockResolvedValue(coach('coach-1'));

      expect(await resolveCaptureContext()).toMatchObject({
        destination: 'https://staging.app.planmypeak.com',
        environment: 'staging',
      });
    });

    it('should be null when the coach is unknown', async () => {
      expect(await resolveCaptureContext()).toBeNull();
    });
  });

  describe('peekCaptureContext', () => {
    it('should be null until the coach is cached, then match the resolved context', async () => {
      await signIn('token-a');
      expect(await peekCaptureContext()).toBeNull();

      fetchCoach.mockResolvedValue(coach('coach-1'));
      const resolved = await resolveCaptureContext();

      expect(await peekCaptureContext()).toEqual(resolved);
      expect(fetchCoach).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildContextId', () => {
    const owner = {
      coachId: 'coach-1',
      destination: 'https://portal.planmypeak.com',
    };

    it('should be stable for the same pair', () => {
      expect(buildContextId(owner)).toBe(buildContextId({ ...owner }));
      expect(buildContextId(owner)).toMatch(/^ctx_[0-9a-f]{16}$/);
    });

    it('should differ by coach and by destination', () => {
      const ids = new Set([
        buildContextId(owner),
        buildContextId({ ...owner, coachId: 'coach-2' }),
        buildContextId({
          ...owner,
          destination: 'https://staging.app.planmypeak.com',
        }),
      ]);

      expect(ids.size).toBe(3);
    });

    it('should not embed the coach id or the destination', () => {
      const id = buildContextId(owner);

      expect(id).not.toContain('coach-1');
      expect(id).not.toContain('planmypeak');
    });
  });
});

/**
 * Routing of the three captured-workout site-control requests: which senders
 * reach the handlers, with what origin, and which payloads are refused before
 * a handler sees them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as handlers from '@/background/capturedImports/siteControlHandlers';
import type { SiteControlRequestMessage } from '@/types';
import type {
  SiteControlRequest,
  SiteControlResponse,
} from '@/types/siteControl.types';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';

vi.mock('@/background/api/trainingPeaks');
vi.mock('@/background/api/planMyPeak');

const ALLOWED_ORIGIN = 'https://portal.planmypeak.com';

function tabSender(origin: string): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    origin,
    tab: { id: 7, url: `${origin}/workout-library` } as chrome.tabs.Tab,
  };
}

function request(
  type: SiteControlRequest['type'],
  payload: Record<string, unknown> = {}
): SiteControlRequestMessage {
  return {
    type: 'SITE_CONTROL_REQUEST',
    request: {
      source: SITE_CONTROL_PAGE_SOURCE,
      version: PLANMYPEAK_SITE_CONTROL_VERSION,
      requestId: 'req-1',
      type,
      payload,
    } as SiteControlRequest,
  };
}

async function send(
  message: SiteControlRequestMessage,
  sender: chrome.runtime.MessageSender = tabSender(ALLOWED_ORIGIN)
): Promise<SiteControlResponse> {
  return (await handleMessage(message, sender)) as SiteControlResponse;
}

const ok: SiteControlResponse = {
  ok: true,
  requestId: 'req-1',
  data: {},
} as SiteControlResponse;

describe('messageHandler captured-import routing', () => {
  let summary: ReturnType<typeof vi.spyOn>;
  let start: ReturnType<typeof vi.spyOn>;
  let status: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    summary = vi
      .spyOn(handlers, 'handleCapturedWorkoutSummary')
      .mockResolvedValue(ok);
    start = vi
      .spyOn(handlers, 'handleImportMissingWorkouts')
      .mockResolvedValue(ok);
    status = vi
      .spyOn(handlers, 'handleCapturedWorkoutImportStatus')
      .mockResolvedValue(ok);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should hand each request to its handler with the verified sender origin', async () => {
    const payload = { contextId: 'ctx-a', operationId: 'op-1' };

    await send(request('GET_CAPTURED_WORKOUT_SUMMARY'));
    await send(request('IMPORT_MISSING_WORKOUTS', payload));
    await send(request('GET_CAPTURED_WORKOUT_IMPORT_STATUS', payload));

    expect(summary).toHaveBeenCalledWith('req-1', ALLOWED_ORIGIN);
    expect(start).toHaveBeenCalledWith('req-1', payload, ALLOWED_ORIGIN);
    expect(status).toHaveBeenCalledWith('req-1', payload, ALLOWED_ORIGIN);
  });

  it('should reach no handler from a non-allowlisted origin', async () => {
    const response = await send(
      request('IMPORT_MISSING_WORKOUTS', {
        contextId: 'ctx-a',
        operationId: 'op-1',
      }),
      tabSender('https://evil.test')
    );

    expect(response.ok).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('should reach no handler from an extension page', async () => {
    const response = await send(request('GET_CAPTURED_WORKOUT_SUMMARY'), {
      id: 'test-extension-id',
    });

    expect(response.ok).toBe(false);
    expect(summary).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing operation id', { contextId: 'ctx-a' }],
    ['a missing context id', { operationId: 'op-1' }],
    ['a coach id', { contextId: 'ctx-a', operationId: 'op-1', coachId: 'c-2' }],
    [
      'a library id',
      { contextId: 'ctx-a', operationId: 'op-1', libraryId: 'lib-9' },
    ],
    [
      'a destination',
      {
        contextId: 'ctx-a',
        operationId: 'op-1',
        destination: 'https://evil.test',
      },
    ],
  ])(
    'should refuse an import start carrying %s before any handler runs',
    async (_label, payload) => {
      const response = await send(request('IMPORT_MISSING_WORKOUTS', payload));

      expect(response.ok).toBe(false);
      expect(start).not.toHaveBeenCalled();
    }
  );

  it('should refuse a status request carrying an extra key', async () => {
    const response = await send(
      request('GET_CAPTURED_WORKOUT_IMPORT_STATUS', {
        contextId: 'ctx-a',
        operationId: 'op-1',
        coachId: 'c-2',
      })
    );

    expect(response.ok).toBe(false);
    expect(status).not.toHaveBeenCalled();
  });
});

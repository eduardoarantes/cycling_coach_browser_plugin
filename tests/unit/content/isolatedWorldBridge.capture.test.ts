/**
 * Workout-capture relay in the isolated-world bridge.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const MAIN_SOURCE = 'trainingpeaks-extension-main';

function post(data: unknown, source: MessageEventSource | null = window): void {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function capture(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: 'TP_WORKOUT_CREATED',
    kind: 'create',
    athleteId: 4830660,
    workoutId: 555,
    request: { title: 'Sweet Spot', workoutId: 0 },
    response: { title: 'Sweet Spot', workoutId: 555 },
    timestamp: 1700000000000,
    source: MAIN_SOURCE,
    ...overrides,
  };
}

describe('isolatedWorldBridge workout capture relay', () => {
  beforeAll(async () => {
    await import('@/content/isolatedWorldBridge');
  });

  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true });
  });

  it('forwards a create capture as WORKOUT_CAPTURED', async () => {
    post(capture());
    await flush();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'WORKOUT_CAPTURED',
      kind: 'create',
      athleteId: 4830660,
      workoutId: 555,
      request: { title: 'Sweet Spot', workoutId: 0 },
      response: { title: 'Sweet Spot', workoutId: 555 },
      timestamp: 1700000000000,
    });
  });

  it('forwards an update capture with kind update', async () => {
    post(capture({ type: 'TP_WORKOUT_UPDATED', kind: 'update' }));
    await flush();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'WORKOUT_CAPTURED', kind: 'update' })
    );
  });

  it('never forwards anything but the documented fields', async () => {
    post(capture({ headers: { authorization: 'Bearer gAAAA' } }));
    await flush();

    const [message] = vi.mocked(chrome.runtime.sendMessage).mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(Object.keys(message).sort()).toEqual(
      [
        'athleteId',
        'kind',
        'request',
        'response',
        'timestamp',
        'type',
        'workoutId',
      ].sort()
    );
  });

  it('ignores messages from another source marker', async () => {
    post(capture({ source: 'someone-else' }));
    await flush();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores messages not sent by this window', async () => {
    post(capture(), null);
    await flush();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores unrelated message types', async () => {
    post(capture({ type: 'TP_WORKOUT_DELETED' }));
    post({ source: MAIN_SOURCE, type: 'GET_CAPTURED_WORKOUTS' });
    await flush();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('logs and swallows a sendMessage rejection', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
      new Error('Receiving end does not exist')
    );

    expect(() => post(capture())).not.toThrow();
    await flush();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

/**
 * Workout-write capture in the main-world interceptor.
 *
 * The module patches `window.fetch` and `XMLHttpRequest` on import, so every
 * test installs its own fakes and imports a fresh module scope.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CREATE_URL =
  'https://tpapi.trainingpeaks.com/fitness/v6/athletes/4830660/workouts';
const UPDATE_URL = `${CREATE_URL}/555`;

const requestBody = {
  athleteId: 4830660,
  workoutId: 0,
  title: 'Sweet Spot',
  workoutDay: '2026-09-20T00:00:00',
  workoutTypeValueId: 2,
  structure:
    '{"structure":[],"polyline":[[0,0]],"primaryLengthMetric":"duration","primaryIntensityMetric":"percentOfFtp"}',
};

const responseBody = { ...requestBody, workoutId: 555 };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A minimal Response stand-in whose clone body resolves on demand. */
function fakeResponse(options: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  clone?: () => unknown;
}): Response {
  const json = options.json ?? (async () => responseBody);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 201,
    clone: options.clone ?? (() => ({ json })),
    json,
  } as unknown as Response;
}

class FakeXHR extends EventTarget {
  status = 0;
  responseType = '';
  responseText = '';
  response: unknown = null;
  open(): void {}
  setRequestHeader(): void {}
  send(): void {}
}

const originalFetch = window.fetch;
const originalXHR = globalThis.XMLHttpRequest;

async function loadInterceptor(
  fetchImpl: (...args: unknown[]) => Promise<Response>
): Promise<{
  fetchMock: ReturnType<typeof vi.fn>;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
}> {
  const fetchMock = vi.fn(fetchImpl);
  window.fetch = fetchMock as unknown as typeof fetch;
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  vi.resetModules();
  await import('@/content/mainWorldInterceptor');

  return { fetchMock, postMessageSpy };
}

function capturePosts(
  spy: ReturnType<typeof vi.spyOn>
): Array<Record<string, unknown>> {
  return spy.mock.calls
    .map((call) => call[0] as Record<string, unknown>)
    .filter(
      (message) =>
        message.type === 'TP_WORKOUT_CREATED' ||
        message.type === 'TP_WORKOUT_UPDATED'
    );
}

describe('mainWorldInterceptor workout capture (fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
  });

  it('settles the caller before the response clone has been parsed or posted', async () => {
    const body = deferred<unknown>();
    const response = fakeResponse({ json: () => body.promise });
    const { postMessageSpy } = await loadInterceptor(async () => response);

    const result = await window.fetch(CREATE_URL, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    expect(result).toBe(response);
    expect(capturePosts(postMessageSpy)).toEqual([]);

    body.resolve(responseBody);
    await flush();

    const [posted] = capturePosts(postMessageSpy);
    expect(posted).toMatchObject({
      type: 'TP_WORKOUT_CREATED',
      kind: 'create',
      athleteId: 4830660,
      workoutId: 555,
      request: requestBody,
      response: responseBody,
      source: 'trainingpeaks-extension-main',
    });
    expect(typeof posted.timestamp).toBe('number');
  });

  it('dispatches a Request input synchronously and does not wait for its body', async () => {
    const text = deferred<string>();
    const request = new Request(CREATE_URL, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const realClone = request.clone.bind(request);
    request.clone = () => {
      const clone = realClone();
      clone.text = () => text.promise;
      return clone;
    };

    const response = fakeResponse({});
    const { fetchMock, postMessageSpy } = await loadInterceptor(
      async () => response
    );

    const pending = window.fetch(request);
    // Dispatched during the call itself, before any await in the wrapper.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(request);

    await expect(pending).resolves.toBe(response);
    expect(capturePosts(postMessageSpy)).toEqual([]);

    text.resolve(JSON.stringify(requestBody));
    await flush();

    expect(capturePosts(postMessageSpy)).toHaveLength(1);
    expect(capturePosts(postMessageSpy)[0].request).toEqual(requestBody);
  });

  it('still resolves the caller when the clone path throws', async () => {
    const response = fakeResponse({
      clone: () => {
        throw new Error('clone exploded');
      },
    });
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await expect(
      window.fetch(CREATE_URL, { method: 'POST', body: '{}' })
    ).resolves.toBe(response);
    await flush();

    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('swallows a rejected clone body without rejecting anything', async () => {
    const response = fakeResponse({
      json: () => Promise.reject(new Error('not json')),
    });
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await expect(
      window.fetch(CREATE_URL, { method: 'POST', body: '{}' })
    ).resolves.toBe(response);
    await flush();

    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('does not capture a non-2xx response', async () => {
    const response = fakeResponse({ ok: false, status: 400 });
    const cloneSpy = vi.spyOn(response, 'clone');
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await window.fetch(CREATE_URL, { method: 'POST', body: '{}' });
    await flush();

    expect(cloneSpy).not.toHaveBeenCalled();
    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('leaves unrelated requests untouched', async () => {
    const response = fakeResponse({});
    const cloneSpy = vi.spyOn(response, 'clone');
    const { fetchMock, postMessageSpy } = await loadInterceptor(
      async () => response
    );

    await window.fetch(`${CREATE_URL}/555/comments`, {
      method: 'POST',
      body: '{}',
    });
    await window.fetch(CREATE_URL, { method: 'GET' });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cloneSpy).not.toHaveBeenCalled();
    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('posts an update capture with the id from the URL', async () => {
    const response = fakeResponse({ status: 200 });
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await window.fetch(UPDATE_URL, {
      method: 'PUT',
      body: JSON.stringify({ ...requestBody, workoutId: 555 }),
    });
    await flush();

    expect(capturePosts(postMessageSpy)[0]).toMatchObject({
      type: 'TP_WORKOUT_UPDATED',
      kind: 'update',
      workoutId: 555,
    });
  });

  it('skips a create whose response carries no workout id', async () => {
    const response = fakeResponse({ json: async () => ({ title: 'x' }) });
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await window.fetch(CREATE_URL, { method: 'POST', body: '{}' });
    await flush();

    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('never includes request headers or the bearer token in the capture', async () => {
    const token = 'gAAAA-secret-token-value';
    const response = fakeResponse({});
    const { postMessageSpy } = await loadInterceptor(async () => response);

    await window.fetch(CREATE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(requestBody),
    });
    await flush();

    const [posted] = capturePosts(postMessageSpy);
    expect(Object.keys(posted).sort()).toEqual(
      [
        'athleteId',
        'kind',
        'request',
        'response',
        'source',
        'timestamp',
        'type',
        'workoutId',
      ].sort()
    );
    expect(JSON.stringify(posted)).not.toContain(token);
  });
});

describe('mainWorldInterceptor workout capture (XHR)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
  });

  function loadedXhr(
    method: string,
    url: string,
    body: unknown,
    status: number,
    responseText: string
  ): FakeXHR {
    const xhr = new XMLHttpRequest() as unknown as FakeXHR;
    (xhr as unknown as XMLHttpRequest).open(method, url);
    (xhr as unknown as XMLHttpRequest).send(body as never);
    xhr.status = status;
    xhr.responseText = responseText;
    xhr.dispatchEvent(new Event('load'));
    return xhr;
  }

  it('captures a create sent as a string body on a 2xx load', async () => {
    const { postMessageSpy } = await loadInterceptor(async () =>
      fakeResponse({})
    );

    loadedXhr(
      'POST',
      CREATE_URL,
      JSON.stringify(requestBody),
      201,
      JSON.stringify(responseBody)
    );

    const [posted] = capturePosts(postMessageSpy);
    expect(posted).toMatchObject({
      type: 'TP_WORKOUT_CREATED',
      kind: 'create',
      athleteId: 4830660,
      workoutId: 555,
      request: requestBody,
      response: responseBody,
    });
  });

  it('captures an update with the id from the URL', async () => {
    const { postMessageSpy } = await loadInterceptor(async () =>
      fakeResponse({})
    );

    loadedXhr(
      'PUT',
      UPDATE_URL,
      JSON.stringify({ ...requestBody, workoutId: 555 }),
      200,
      JSON.stringify(responseBody)
    );

    expect(capturePosts(postMessageSpy)[0]).toMatchObject({
      type: 'TP_WORKOUT_UPDATED',
      workoutId: 555,
    });
  });

  it('does not capture a non-2xx load, an unrelated URL, or an unreadable response', async () => {
    const { postMessageSpy } = await loadInterceptor(async () =>
      fakeResponse({})
    );

    loadedXhr('POST', CREATE_URL, '{}', 500, JSON.stringify(responseBody));
    loadedXhr(
      'POST',
      `${CREATE_URL}/555/comments`,
      '{}',
      201,
      JSON.stringify(responseBody)
    );
    loadedXhr('POST', CREATE_URL, '{}', 201, 'not json');

    expect(capturePosts(postMessageSpy)).toEqual([]);
  });

  it('skips a non-string body but still posts the response', async () => {
    const { postMessageSpy } = await loadInterceptor(async () =>
      fakeResponse({})
    );

    loadedXhr(
      'POST',
      CREATE_URL,
      new FormData(),
      201,
      JSON.stringify(responseBody)
    );

    const [posted] = capturePosts(postMessageSpy);
    expect(posted.request).toBeUndefined();
    expect(posted.response).toEqual(responseBody);
  });
});

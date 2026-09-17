import { describe, it, expect } from 'vitest';
import {
  matchTrainingPeaksWorkoutWrite,
  readJsonBody,
  readWorkoutIdFromResponse,
  safeParseJson,
  takeRequestBodyHandle,
} from '@/content/workoutCaptureDetection';
import { extractRequestMethod } from '@/content/requestInfo';

const PROD = 'https://tpapi.trainingpeaks.com';
const SANDBOX = 'https://tpapi.sandbox.trainingpeaks.com';

describe('matchTrainingPeaksWorkoutWrite', () => {
  it('matches a workout create on the production host', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        `${PROD}/fitness/v6/athletes/4830660/workouts`
      )
    ).toEqual({
      kind: 'create',
      athleteId: 4830660,
      workoutId: null,
      environment: 'production',
    });
  });

  it('matches a workout update and reads the workout id', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'put',
        `${PROD}/fitness/v6/athletes/4830660/workouts/987`
      )
    ).toEqual({
      kind: 'update',
      athleteId: 4830660,
      workoutId: 987,
      environment: 'production',
    });
  });

  it('tags the sandbox host', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        `${SANDBOX}/fitness/v6/athletes/1/workouts`
      )?.environment
    ).toBe('sandbox');
  });

  it('does not match sibling routes under a workout id', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        `${PROD}/fitness/v6/athletes/4830660/workouts/123/comments`
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite(
        'PUT',
        `${PROD}/fitness/v6/athletes/4830660/workouts/123/details`
      )
    ).toBeNull();
  });

  it('does not match a GET or a DELETE', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'GET',
        `${PROD}/fitness/v6/athletes/4830660/workouts`
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite(
        'DELETE',
        `${PROD}/fitness/v6/athletes/4830660/workouts/1`
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite(
        undefined,
        `${PROD}/fitness/v6/athletes/4830660/workouts`
      )
    ).toBeNull();
  });

  it('does not match other hosts, lookalikes, or relative URLs', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        'https://portal.planmypeak.com/fitness/v6/athletes/1/workouts'
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        'https://tpapi.trainingpeaks.com.evil.test/fitness/v6/athletes/1/workouts'
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite('POST', '/fitness/v6/athletes/1/workouts')
    ).toBeNull();
  });

  it('does not match a PUT on the collection or a POST on an item', () => {
    expect(
      matchTrainingPeaksWorkoutWrite(
        'PUT',
        `${PROD}/fitness/v6/athletes/1/workouts`
      )
    ).toBeNull();
    expect(
      matchTrainingPeaksWorkoutWrite(
        'POST',
        `${PROD}/fitness/v6/athletes/1/workouts/5`
      )
    ).toBeNull();
  });
});

describe('body helpers', () => {
  it('parses a string body', async () => {
    await expect(readJsonBody('{"title":"x"}')).resolves.toEqual({
      title: 'x',
    });
  });

  it('parses a Request body', async () => {
    const request = new Request(`${PROD}/fitness/v6/athletes/1/workouts`, {
      method: 'POST',
      body: JSON.stringify({ title: 'from request' }),
    });
    await expect(readJsonBody(request)).resolves.toEqual({
      title: 'from request',
    });
  });

  it('skips a FormData body and other non-string bodies', async () => {
    await expect(readJsonBody(new FormData())).resolves.toBeUndefined();
    await expect(readJsonBody(new Blob(['{}']))).resolves.toBeUndefined();
    await expect(readJsonBody(undefined)).resolves.toBeUndefined();
  });

  it('yields undefined for invalid JSON', async () => {
    expect(safeParseJson('not json')).toBeUndefined();
    await expect(readJsonBody('{oops')).resolves.toBeUndefined();
  });

  it('takes a string body from init and clones a Request otherwise', () => {
    expect(takeRequestBodyHandle('https://x', { body: '{"a":1}' })).toBe(
      '{"a":1}'
    );
    expect(
      takeRequestBodyHandle('https://x', { body: new FormData() })
    ).toBeUndefined();

    const request = new Request(`${PROD}/fitness/v6/athletes/1/workouts`, {
      method: 'POST',
      body: '{"b":2}',
    });
    const handle = takeRequestBodyHandle(request);
    expect(handle).toBeInstanceOf(Request);
    expect(handle).not.toBe(request);
    // The original is still readable: only the clone will be consumed.
    expect(request.bodyUsed).toBe(false);
  });

  it('prefers init.body over a Request body', () => {
    const request = new Request(`${PROD}/fitness/v6/athletes/1/workouts`, {
      method: 'POST',
      body: '{"b":2}',
    });
    expect(takeRequestBodyHandle(request, { body: '{"c":3}' })).toBe('{"c":3}');
  });

  it('reads a numeric workout id from a response body', () => {
    expect(readWorkoutIdFromResponse({ workoutId: 42 })).toBe(42);
    expect(readWorkoutIdFromResponse({ workoutId: '42' })).toBeNull();
    expect(readWorkoutIdFromResponse(null)).toBeNull();
  });
});

describe('extractRequestMethod', () => {
  it('reads init.method, a Request method, and defaults to GET', () => {
    expect(extractRequestMethod('https://x', { method: 'post' })).toBe('POST');
    expect(
      extractRequestMethod(new Request('https://x', { method: 'PUT' }))
    ).toBe('PUT');
    expect(
      extractRequestMethod(new Request('https://x', { method: 'PUT' }), {
        method: 'POST',
      })
    ).toBe('POST');
    expect(extractRequestMethod('https://x')).toBe('GET');
  });
});

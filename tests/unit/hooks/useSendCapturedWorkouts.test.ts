import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  providerIdNamespaceFor,
  useSendCapturedWorkouts,
} from '@/hooks/useSendCapturedWorkouts';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';
import type { PlanMyPeakWorkout } from '@/types/planMyPeak.types';

const structure = {
  structure: [
    {
      type: 'step',
      length: { unit: 'repetition', value: 1 },
      steps: [
        {
          name: 'Work',
          intensityClass: 'active',
          length: { unit: 'second', value: 600 },
          openDuration: false,
          targets: [{ minValue: 88, maxValue: 93 }],
        },
      ],
    },
  ],
  primaryLengthMetric: 'duration',
  primaryIntensityMetric: 'percentOfFtp',
};

function record(
  workoutId: number,
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  const environment = overrides.environment ?? 'production';
  return {
    key: `${environment}:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment,
    capturedAt: workoutId,
    updatedAt: workoutId,
    status: 'pending',
    workout: {
      title: 'Intervals',
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure,
      totalTimePlanned: 1,
      tssPlanned: 60,
      ifPlanned: 0.8,
      distancePlanned: null,
      caloriesPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
      userTags: null,
      lastModifiedDate: null,
    },
    ...overrides,
  };
}

const library = {
  id: 'lib-default',
  name: 'My Library',
  description: null,
  isDefault: true,
  workoutCount: 0,
  createdAt: '2026-02-27T00:00:00.000Z',
  updatedAt: '2026-02-27T00:00:00.000Z',
};

interface MockOptions {
  /** provider ids that should fail to upload, with their message */
  failing?: Record<string, string>;
  /** fail library lookup entirely */
  libraryError?: string;
}

function mockBackground(
  options: MockOptions = {}
): Array<Record<string, unknown>> {
  const sent: Array<Record<string, unknown>> = [];
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    async (message: unknown) => {
      const typed = message as Record<string, unknown>;
      sent.push(typed);

      if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
        if (options.libraryError) {
          return { success: false, error: { message: options.libraryError } };
        }
        return { success: true, data: [library] };
      }

      if (typed.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY') {
        const workouts = typed.workouts as PlanMyPeakWorkout[];
        const failing = options.failing ?? {};
        const results = workouts
          .filter((w) => !(w.provider_workout_id in failing))
          .map((w, index) => ({
            workout: {
              id: `pmp-${index + 1}`,
              name: w.name,
              workoutType: 'bike',
              library: { id: library.id, name: library.name },
              providerWorkoutId: w.provider_workout_id,
            },
            created: true,
            filedElsewhere: false,
          }));
        const failures = workouts
          .filter((w) => w.provider_workout_id in failing)
          .map((w) => ({
            providerWorkoutId: w.provider_workout_id,
            name: w.name,
            message: failing[w.provider_workout_id],
          }));
        return {
          success: true,
          data: {
            results,
            createdCount: results.length,
            updatedCount: 0,
            destinationEmpty: false,
            failures,
          },
        };
      }

      if (typed.type === 'UPDATE_CAPTURED_WORKOUT') {
        return { success: true, data: null };
      }

      return { success: false, error: { message: `unhandled ${typed.type}` } };
    }
  );
  return sent;
}

function exportMessages(
  sent: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return sent.filter((m) => m.type === 'EXPORT_WORKOUTS_TO_PLANMYPEAK_LIBRARY');
}

function updateMessages(
  sent: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return sent.filter((m) => m.type === 'UPDATE_CAPTURED_WORKOUT');
}

describe('useSendCapturedWorkouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps environments to provider-id namespaces', () => {
    expect(providerIdNamespaceFor('production')).toBe('cal');
    expect(providerIdNamespaceFor('sandbox')).toBe('cal-sandbox');
  });

  it('sends through the default library with namespaced ids and captured keys', async () => {
    const sent = mockBackground();
    const records = [record(10), record(11)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let summary;
    await act(async () => {
      summary = await result.current.sendAllPending();
    });

    const [message] = exportMessages(sent);
    expect(message.libraryId).toBe('lib-default');
    expect(message.capturedKeys).toEqual({
      'cal:10': 'production:1:10',
      'cal:11': 'production:1:11',
    });
    const workouts = message.workouts as PlanMyPeakWorkout[];
    expect(workouts.map((w) => w.provider_workout_id)).toEqual([
      'cal:10',
      'cal:11',
    ]);
    expect(workouts[0].source_file).toBe('workout_cal_10.json');

    // No library is created or named: the default is resolved by flag.
    expect(sent.some((m) => m.type === 'CREATE_PLANMYPEAK_LIBRARY')).toBe(
      false
    );

    expect(summary).toMatchObject({ sent: 2, failed: 0, skipped: 0 });
    expect(result.current.outcomes['production:1:10']).toMatchObject({
      status: 'sent',
      remoteId: 'pmp-1',
      libraryName: 'My Library',
    });
  });

  it('runs one export per environment with the right namespace', async () => {
    const sent = mockBackground();
    const records = [record(7), record(7, { environment: 'sandbox' })];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    await act(async () => {
      await result.current.sendAllPending();
    });

    const messages = exportMessages(sent);
    expect(messages).toHaveLength(2);
    const ids = messages.map(
      (m) => (m.workouts as PlanMyPeakWorkout[])[0].provider_workout_id
    );
    expect(ids.sort()).toEqual(['cal-sandbox:7', 'cal:7']);
    expect(messages.map((m) => m.capturedKeys)).toEqual(
      expect.arrayContaining([
        { 'cal:7': 'production:1:7' },
        { 'cal-sandbox:7': 'sandbox:1:7' },
      ])
    );
  });

  it('does not write send outcomes itself; only the background does', async () => {
    const sent = mockBackground({ failing: { 'cal:11': 'nope' } });
    const records = [record(10), record(11)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    await act(async () => {
      await result.current.sendAllPending();
    });

    expect(updateMessages(sent)).toEqual([]);
    expect(result.current.outcomes['production:1:10'].status).toBe('sent');
    expect(result.current.outcomes['production:1:11']).toMatchObject({
      status: 'failed',
      error: 'nope',
    });
  });

  it('attributes identically named workouts by provider id', async () => {
    const sent = mockBackground({ failing: { 'cal:11': 'rejected' } });
    const records = [record(10), record(11)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let summary;
    await act(async () => {
      summary = await result.current.send([
        'production:1:10',
        'production:1:11',
      ]);
    });

    expect(summary).toMatchObject({ sent: 1, failed: 1 });
    expect(result.current.outcomes['production:1:10'].status).toBe('sent');
    expect(result.current.outcomes['production:1:11'].error).toBe('rejected');
    expect(exportMessages(sent)).toHaveLength(1);
  });

  it('records a transform-time skip as lastSendError and keeps sending the rest', async () => {
    const sent = mockBackground();
    // A bike workout with no structure cannot be imported: the adapter skips it.
    const records = [
      record(10),
      record(12, { workout: { ...record(12).workout, structure: null } }),
    ];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let summary;
    await act(async () => {
      summary = await result.current.sendAllPending();
    });

    expect(updateMessages(sent)).toEqual([
      expect.objectContaining({
        type: 'UPDATE_CAPTURED_WORKOUT',
        key: 'production:1:12',
        lastSendError: expect.stringContaining('Skipped'),
      }),
    ]);
    const [message] = exportMessages(sent);
    expect(
      (message.workouts as PlanMyPeakWorkout[]).map(
        (w) => w.provider_workout_id
      )
    ).toEqual(['cal:10']);
    expect(summary).toMatchObject({ sent: 1, skipped: 1, failed: 0 });
    expect(result.current.outcomes['production:1:12'].status).toBe('skipped');
  });

  it('reports a run-level error when the library cannot be resolved', async () => {
    mockBackground({ libraryError: 'PlanMyPeak unavailable' });
    const records = [record(10)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let summary;
    await act(async () => {
      summary = await result.current.sendAllPending();
    });

    expect(summary).toMatchObject({ sent: 0, failed: 1 });
    expect(result.current.lastSummary?.errors).toEqual([
      'PlanMyPeak unavailable',
    ]);
    expect(result.current.outcomes['production:1:10']).toMatchObject({
      status: 'failed',
      error: 'PlanMyPeak unavailable',
    });
  });

  it('sends only pending records with sendAllPending and nothing when none are', async () => {
    const sent = mockBackground();
    const records = [
      record(10, { status: 'sent' }),
      record(11, { status: 'dismissed' }),
    ];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let summary;
    await act(async () => {
      summary = await result.current.sendAllPending();
    });

    expect(summary).toMatchObject({ sent: 0, failed: 0, skipped: 0 });
    expect(exportMessages(sent)).toEqual([]);
  });

  it('exposes sendingKeys while a send is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (message: unknown) => {
        const typed = message as Record<string, unknown>;
        if (typed.type === 'GET_PLANMYPEAK_LIBRARIES') {
          await gate;
          return { success: true, data: [library] };
        }
        return {
          success: true,
          data: {
            results: [],
            createdCount: 0,
            updatedCount: 0,
            destinationEmpty: false,
            failures: [],
          },
        };
      }
    );
    const records = [record(10)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.send(['production:1:10']);
    });
    expect(result.current.isSending).toBe(true);
    expect([...result.current.sendingKeys]).toEqual(['production:1:10']);

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.isSending).toBe(false);
  });

  it('never sends a TrainingPeaks request', async () => {
    const sent = mockBackground();
    const records = [record(10)];
    const { result } = renderHook(() => useSendCapturedWorkouts(records));

    await act(async () => {
      await result.current.sendAllPending();
    });

    const types = sent.map((m) => m.type as string);
    expect(types).not.toContain('GET_LIBRARY_ITEMS');
    expect(types).not.toContain('GET_PLAN_WORKOUTS');
    expect(types.every((type) => !type.startsWith('GET_TRAINING'))).toBe(true);
  });
});

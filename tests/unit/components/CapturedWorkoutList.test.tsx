import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { CapturedWorkoutList } from '@/popup/components/CapturedWorkoutList';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';

const useCapturedWorkoutsMock = vi.fn();
const useSendCapturedWorkoutsMock = vi.fn();
const useMyPeakAuthMock = vi.fn();
const useConnectionSettingsMock = vi.fn();
const useAccountMatchMock = vi.fn();

vi.mock('@/hooks/useCapturedWorkouts', () => ({
  useCapturedWorkouts: (): unknown => useCapturedWorkoutsMock(),
}));
vi.mock('@/hooks/useSendCapturedWorkouts', () => ({
  useSendCapturedWorkouts: (records: unknown): unknown =>
    useSendCapturedWorkoutsMock(records),
}));
vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: (): unknown => useMyPeakAuthMock(),
}));
vi.mock('@/hooks/useConnectionSettings', () => ({
  useConnectionSettings: (): unknown => useConnectionSettingsMock(),
}));
vi.mock('@/hooks/usePlanMyPeakAccountMatch', () => ({
  usePlanMyPeakAccountMatch: (): unknown => useAccountMatchMock(),
}));
vi.mock('@/hooks/usePlanMyPeakEnvironment', () => ({
  usePlanMyPeakEnvironment: (): unknown => ({
    hostLabel: 'portal.planmypeak.com',
  }),
}));

function record(
  workoutId: number,
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  return {
    key: `production:1:${workoutId}`,
    athleteId: 1,
    workoutId,
    environment: 'production',
    capturedAt: workoutId * 100,
    updatedAt: workoutId * 100,
    status: 'pending',
    workout: {
      title: `Workout ${workoutId}`,
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure: null,
      totalTimePlanned: null,
      tssPlanned: null,
      ifPlanned: null,
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

const dismiss = vi.fn();
const clearFinished = vi.fn();
const claim = vi.fn();
const send = vi.fn();
const sendAllPending = vi.fn();

function mockList(overrides: Record<string, unknown> = {}): void {
  const records = (overrides.records as
    | CapturedWorkoutRecord[]
    | undefined) ?? [
    record(2),
    record(1, { status: 'sent', planMyPeakLibraryName: 'My Library' }),
  ];
  useCapturedWorkoutsMock.mockReturnValue({
    records,
    pendingCount: records.filter((r) => r.status === 'pending').length,
    unlinkedCount: 0,
    isLoading: false,
    error: null,
    claim,
    dismiss,
    clearFinished,
    refresh: vi.fn(),
    ...overrides,
  });
}

function mockSend(overrides: Record<string, unknown> = {}): void {
  useSendCapturedWorkoutsMock.mockReturnValue({
    send,
    sendAllPending,
    sendingKeys: new Set<string>(),
    isSending: false,
    lastSummary: null,
    outcomes: {},
    ...overrides,
  });
}

function mockGates(
  overrides: {
    authenticated?: boolean;
    enabled?: boolean;
    match?: 'matched' | 'mismatch' | 'not-linked' | 'unknown';
  } = {}
): void {
  useMyPeakAuthMock.mockReturnValue({
    isAuthenticated: overrides.authenticated ?? true,
  });
  useConnectionSettingsMock.mockReturnValue({
    isPlanMyPeakEnabled: overrides.enabled ?? true,
  });
  useAccountMatchMock.mockReturnValue({
    status: overrides.match ?? 'matched',
    hasMismatch: overrides.match === 'mismatch',
  });
}

describe('CapturedWorkoutList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList();
    mockSend();
    mockGates();
  });

  it('renders rows in the order the hook provides (newest first)', () => {
    render(<CapturedWorkoutList />);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Workout 2');
    expect(rows[1]).toHaveTextContent('Workout 1');
    expect(screen.getByText('2 captured · 1 pending')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is captured', () => {
    mockList({ records: [] });
    render(<CapturedWorkoutList />);

    expect(screen.getByText('No new workouts yet')).toBeInTheDocument();
    expect(screen.getByText(/will appear here/)).toBeInTheDocument();
  });

  it('shows a spinner while loading and the error when loading fails', () => {
    mockList({ isLoading: true, records: [] });
    const { unmount } = render(<CapturedWorkoutList />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();

    mockList({ error: 'boom', records: [] });
    render(<CapturedWorkoutList />);
    expect(
      screen.getByText(/Could not load captured workouts: boom/)
    ).toBeInTheDocument();
  });

  it('sends one row and all pending through the hooks', () => {
    render(<CapturedWorkoutList />);

    fireEvent.click(
      screen.getByRole('button', { name: /send to planmypeak/i })
    );
    expect(send).toHaveBeenCalledWith(['production:1:2']);

    fireEvent.click(screen.getByRole('button', { name: /send all pending/i }));
    expect(sendAllPending).toHaveBeenCalledTimes(1);
  });

  it('dismisses a row and clears finished rows through the hooks', () => {
    render(<CapturedWorkoutList />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismiss).toHaveBeenCalledWith('production:1:2');

    fireEvent.click(
      screen.getByRole('button', { name: /clear sent & dismissed/i })
    );
    expect(clearFinished).toHaveBeenCalledTimes(1);
  });

  it('disables Send actions with a hint when PlanMyPeak is not authenticated', () => {
    mockGates({ authenticated: false });
    render(<CapturedWorkoutList />);

    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /send to planmypeak/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/Connect PlanMyPeak in Settings/)
    ).toBeInTheDocument();
    // Dismiss is not gated.
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeEnabled();
  });

  it('disables Send actions when the PlanMyPeak connection is off', () => {
    mockGates({ enabled: false });
    render(<CapturedWorkoutList />);

    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/Enable the PlanMyPeak connection/)
    ).toBeInTheDocument();
  });

  it('blocks Send actions on a confirmed account mismatch', () => {
    mockGates({ match: 'mismatch' });
    render(<CapturedWorkoutList />);

    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /send to planmypeak/i })
    ).toBeDisabled();
    expect(screen.getByText(/accounts do not match/)).toBeInTheDocument();
  });

  it('does not block on an unknown match state', () => {
    mockGates({ match: 'unknown' });
    render(<CapturedWorkoutList />);

    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeEnabled();
  });

  it('disables Send all when nothing is pending and Clear when nothing is finished', () => {
    mockList({ records: [record(1, { status: 'sent' })] });
    const { unmount } = render(<CapturedWorkoutList />);
    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /clear sent & dismissed/i })
    ).toBeEnabled();
    unmount();

    mockList({ records: [record(1)] });
    render(<CapturedWorkoutList />);
    expect(
      screen.getByRole('button', { name: /send all pending/i })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /clear sent & dismissed/i })
    ).toBeDisabled();
  });

  it('disables actions and shows the sending state while a send runs', () => {
    mockSend({ isSending: true, sendingKeys: new Set(['production:1:2']) });
    render(<CapturedWorkoutList />);

    expect(screen.getByRole('button', { name: /sending…/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /clear sent & dismissed/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
    // The button label and the sending row's status chip both read Sending…
    expect(
      within(screen.getByTestId('captured-row-production:1:2')).getByText(
        'Sending…'
      )
    ).toBeInTheDocument();
  });

  it('reports the last send summary and per-row outcomes', () => {
    mockSend({
      lastSummary: {
        sent: 1,
        failed: 1,
        skipped: 0,
        outcomes: {},
        errors: [],
      },
      outcomes: {
        'production:1:2': {
          key: 'production:1:2',
          status: 'failed',
          error: 'rejected',
        },
      },
    });
    render(<CapturedWorkoutList />);

    expect(screen.getByTestId('captured-send-summary')).toHaveTextContent(
      'Last send: 1 sent, 1 failed'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('rejected');
  });

  describe('unlinked captures banner', () => {
    it('should not show when every capture has an owner', () => {
      render(<CapturedWorkoutList />);

      expect(
        screen.queryByTestId('captured-unlinked-banner')
      ).not.toBeInTheDocument();
    });

    it('should say how many captures are unlinked and where they would go', () => {
      mockList({ unlinkedCount: 3 });

      render(<CapturedWorkoutList />);

      const banner = screen.getByTestId('captured-unlinked-banner');
      expect(banner).toHaveTextContent(
        "3 captured workouts aren't linked to a PlanMyPeak account yet"
      );
      expect(
        within(banner).getByRole('button', {
          name: 'Link to my portal.planmypeak.com account',
        })
      ).toBeEnabled();
    });

    it('should use the singular for one capture', () => {
      mockList({ unlinkedCount: 1 });

      render(<CapturedWorkoutList />);

      expect(screen.getByTestId('captured-unlinked-banner')).toHaveTextContent(
        "1 captured workout isn't linked"
      );
    });

    it('should claim when the button is clicked', async () => {
      claim.mockResolvedValue(null);
      mockList({ unlinkedCount: 2 });
      render(<CapturedWorkoutList />);

      fireEvent.click(screen.getByRole('button', { name: /^Link to my/ }));

      await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show the reason when the background refuses the claim', async () => {
      claim.mockResolvedValue('Sign in to PlanMyPeak in the extension first.');
      mockList({ unlinkedCount: 2 });
      render(<CapturedWorkoutList />);

      fireEvent.click(screen.getByRole('button', { name: /^Link to my/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Sign in to PlanMyPeak in the extension first.'
      );
    });

    it.each([
      ['PlanMyPeak is not authenticated', { authenticated: false }],
      ['the PlanMyPeak connection is off', { enabled: false }],
    ])('should disable linking when %s', (_label, gates) => {
      mockGates(gates);
      mockList({ unlinkedCount: 2 });

      render(<CapturedWorkoutList />);

      expect(
        screen.getByRole('button', { name: /^Link to my/ })
      ).toBeDisabled();
    });
  });
});

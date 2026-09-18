/**
 * ExportDialog and PlanMyPeak authentication: the dialog does not gate Export
 * on a stale credential, starts one recovery run before the duplicate check,
 * ends it on every way out, and shows the sign-in gate only after recovery
 * failed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ExportDialog } from '@/popup/components/export/ExportDialog';
import { PLANMYPEAK_AUTH_MESSAGES } from '@/utils/uiStrings';

const refresh = vi.fn();
const validateAuth = vi.fn();
let isPlanMyPeakAuthenticated = false;

vi.mock('@/hooks/useConnectionSettings', () => ({
  useConnectionSettings: () => ({
    isPlanMyPeakEnabled: true,
    isIntervalsEnabled: true,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: () => ({
    isAuthenticated: isPlanMyPeakAuthenticated,
    validateAuth,
  }),
}));

vi.mock('@/hooks/useProviderAuthRefresh', () => ({
  useProviderAuthRefresh: () => ({
    status: 'idle',
    isRefreshing: false,
    message: null,
    refresh,
    reset: vi.fn(),
  }),
}));

type Message = { type: string; [key: string]: unknown };

let sent: Message[];
let librariesResponse: unknown;
let runCounter: number;

function mockBackground(): void {
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(
    async (message: unknown) => {
      const typed = message as Message;
      sent.push(typed);
      switch (typed.type) {
        case 'BEGIN_PLANMYPEAK_AUTH_RUN':
          runCounter += 1;
          return { authRunId: `run-${runCounter}` };
        case 'GET_PLANMYPEAK_LIBRARIES':
          return librariesResponse;
        case 'HAS_INTERVALS_API_KEY':
          return { hasKey: true };
        default:
          return { success: true };
      }
    }
  );
}

function renderDialog(
  onExport = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn()
): { onExport: typeof onExport; onClose: typeof onClose } {
  render(
    <ExportDialog
      isOpen
      onClose={onClose}
      onExport={onExport}
      itemCount={4}
      exportScope="libraries"
      libraryCount={2}
      sourceLibraryNames={['Base', 'Build']}
    />
  );
  return { onExport, onClose };
}

function acknowledge(): void {
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/i }));
}

function exportButton(): HTMLElement {
  return screen.getByRole('button', { name: /^Export$|Checking|Exporting/ });
}

function sentOfType(type: string): Message[] {
  return sent.filter((message) => message.type === type);
}

describe('ExportDialog PlanMyPeak authentication', () => {
  beforeEach(() => {
    // jsdom has no element scrolling; the dialog scrolls banners into view.
    Element.prototype.scrollTo = vi.fn();
    sent = [];
    runCounter = 0;
    isPlanMyPeakAuthenticated = false;
    librariesResponse = { success: true, data: [] };
    refresh.mockReset();
    validateAuth.mockReset();
    mockBackground();
  });

  it('should keep Export available when the stored credential is expired or missing', () => {
    renderDialog();
    acknowledge();

    expect(exportButton()).toBeEnabled();
  });

  it('should begin a run before the duplicate check and carry it through the export', async () => {
    const { onExport } = renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });

    await waitFor(() => expect(onExport).toHaveBeenCalled());
    const typesInOrder = sent.map((message) => message.type);
    expect(typesInOrder.indexOf('BEGIN_PLANMYPEAK_AUTH_RUN')).toBeLessThan(
      typesInOrder.indexOf('GET_PLANMYPEAK_LIBRARIES')
    );
    expect(sentOfType('GET_PLANMYPEAK_LIBRARIES')[0].authRunId).toBe('run-1');
    expect(onExport.mock.calls[0][0]).toMatchObject({ authRunId: 'run-1' });
  });

  it('should end the run when the export completes', async () => {
    const { onExport } = renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });

    await waitFor(() => expect(onExport).toHaveBeenCalled());
    await waitFor(() =>
      expect(sentOfType('END_PLANMYPEAK_AUTH_RUN')).toContainEqual({
        type: 'END_PLANMYPEAK_AUTH_RUN',
        authRunId: 'run-1',
      })
    );
  });

  it('should show the sign-in gate, not the generic banner, when recovery fails at the duplicate check', async () => {
    librariesResponse = {
      success: false,
      error: { message: 'PlanMyPeak sign-in required.', code: 'NO_TOKEN' },
    };
    const { onExport } = renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });

    expect(
      await screen.findByRole('button', {
        name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Unable to validate existing PlanMyPeak libraries')
    ).not.toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
    expect(onExport).not.toHaveBeenCalled();
    expect(sentOfType('END_PLANMYPEAK_AUTH_RUN')).toContainEqual({
      type: 'END_PLANMYPEAK_AUTH_RUN',
      authRunId: 'run-1',
    });
  });

  it('should keep the generic banner for a genuine API error', async () => {
    librariesResponse = {
      success: false,
      error: { message: 'Internal Server Error', status: 500 },
    };
    renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });

    expect(
      await screen.findByText(
        'Unable to validate existing PlanMyPeak libraries'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
      })
    ).not.toBeInTheDocument();
  });

  it('should wire the gate action to a refresh followed by re-validation', async () => {
    librariesResponse = {
      success: false,
      error: { message: 'PlanMyPeak sign-in required.', code: 'NO_TOKEN' },
    };
    refresh.mockResolvedValue({ outcome: 'refreshed' });
    renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });
    const gateAction = await screen.findByRole('button', {
      name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
    });

    await act(async () => {
      fireEvent.click(gateAction);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(validateAuth).toHaveBeenCalled();
    await waitFor(() => expect(exportButton()).toBeEnabled());
  });

  it('should keep other destinations usable while PlanMyPeak needs sign-in', async () => {
    librariesResponse = {
      success: false,
      error: { message: 'PlanMyPeak sign-in required.', code: 'NO_TOKEN' },
    };
    renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });
    await screen.findByRole('button', {
      name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
    });

    fireEvent.click(screen.getByRole('radio', { name: /Intervals\.icu/ }));

    expect(
      screen.queryByRole('button', {
        name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
      })
    ).not.toBeInTheDocument();
  });

  it('should keep one run open across the duplicate decision', async () => {
    librariesResponse = {
      success: true,
      data: [
        {
          id: 'lib-1',
          name: 'Base',
          description: null,
          isDefault: false,
          workoutCount: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const { onExport } = renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });
    const append = await screen.findByRole('button', { name: /Append/ });
    expect(sentOfType('END_PLANMYPEAK_AUTH_RUN')).toHaveLength(0);

    await act(async () => {
      fireEvent.click(append);
    });

    await waitFor(() => expect(onExport).toHaveBeenCalled());
    expect(onExport.mock.calls[0][0]).toMatchObject({ authRunId: 'run-1' });
    expect(sentOfType('BEGIN_PLANMYPEAK_AUTH_RUN')).toHaveLength(1);
  });

  it('should end the run on Ignore Upload so the next export starts a fresh one', async () => {
    librariesResponse = {
      success: true,
      data: [
        {
          id: 'lib-1',
          name: 'Base',
          description: null,
          isDefault: false,
          workoutCount: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    const { onClose } = renderDialog();
    acknowledge();

    await act(async () => {
      fireEvent.click(exportButton());
    });
    const ignore = await screen.findByRole('button', { name: /Ignore/ });

    await act(async () => {
      fireEvent.click(ignore);
    });

    expect(onClose).toHaveBeenCalled();
    expect(sentOfType('END_PLANMYPEAK_AUTH_RUN')).toContainEqual({
      type: 'END_PLANMYPEAK_AUTH_RUN',
      authRunId: 'run-1',
    });
  });
});

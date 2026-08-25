/**
 * Overlay gating: what the coach can and cannot do from the panel.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ImportOverlay } from '@/content/overlay/ImportOverlay';

const authState = { isAuthenticated: true, isLoading: false };
const planMyPeakAuthState = { isAuthenticated: true };
const accountMatchState: { status: string } = { status: 'matched' };

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    ...authState,
    error: null,
    token: null,
    tokenAge: null,
    refreshAuth: vi.fn(),
    clearAuth: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: () => ({
    ...planMyPeakAuthState,
    isLoading: false,
    error: null,
    token: null,
    tokenAge: null,
    refreshAuth: vi.fn(),
    validateAuth: vi.fn(),
    clearAuth: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePlanMyPeakAccountMatch', () => ({
  usePlanMyPeakAccountMatch: () => ({
    status: accountMatchState.status,
    hasMismatch: accountMatchState.status !== 'matched',
    tpUserId: '111',
    linkedTpId: '222',
    tpUserName: 'Coach A',
    coachName: 'Coach B',
  }),
}));

vi.mock('@/hooks/useLibraries', () => ({
  useLibraries: () => ({
    data: [
      {
        exerciseLibraryId: 1,
        libraryName: 'Base Training',
        ownerId: 9,
        ownerName: 'Coach',
        imageUrl: null,
        isDefaultContent: false,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTrainingPlans', () => ({
  useTrainingPlans: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAthleteGroups', () => ({
  useAthleteGroups: () => ({
    data: [
      {
        id: 5,
        coachId: 9,
        name: 'Squad A',
        athleteIds: [1, 2],
        isDefault: false,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    rawResponse: null,
  }),
}));

function renderOverlay(onClose = vi.fn()): { onClose: () => void } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = (children: ReactElement): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  render(
    wrapper(
      <ImportOverlay
        focusNonce={0}
        preselectedLibraryId={null}
        preselectedPlanId={null}
        preselectGroups={false}
        onClose={onClose}
      />
    )
  );

  return { onClose };
}

describe('ImportOverlay', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    planMyPeakAuthState.isAuthenticated = true;
    accountMatchState.status = 'matched';
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      success: true,
      data: [],
    } as never);
  });

  it('should disable Import while nothing is selected', () => {
    renderOverlay();

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(screen.getByText('Nothing selected yet')).toBeInTheDocument();
  });

  it('should enable Import once a library is selected', () => {
    renderOverlay();

    fireEvent.click(screen.getByLabelText('Select library Base Training'));

    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('should block the import when TrainingPeaks is not authenticated', () => {
    authState.isAuthenticated = false;
    renderOverlay();

    expect(
      screen.getByText('TrainingPeaks sign-in required')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('should block the import when PlanMyPeak is not authenticated', () => {
    planMyPeakAuthState.isAuthenticated = false;
    renderOverlay();

    expect(screen.getByText('PlanMyPeak sign-in required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('should not show a connection warning when both are authenticated', () => {
    renderOverlay();

    expect(
      screen.queryByText('TrainingPeaks sign-in required')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('PlanMyPeak sign-in required')
    ).not.toBeInTheDocument();
  });

  it('should close when the close control is used', () => {
    const { onClose } = renderOverlay();

    fireEvent.click(screen.getByLabelText('Close importer'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on Escape', () => {
    const { onClose } = renderOverlay();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should block the import when the accounts do not match', () => {
    accountMatchState.status = 'mismatch';
    renderOverlay();

    fireEvent.click(screen.getByLabelText('Select library Base Training'));

    // The upload would succeed against the wrong account rather than fail, so
    // nothing downstream would catch this — the overlay has to stop it.
    expect(screen.getByText('Account mismatch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('should not block a coach whose PlanMyPeak profile has no linked TrainingPeaks account', () => {
    accountMatchState.status = 'not-linked';
    renderOverlay();

    fireEvent.click(screen.getByLabelText('Select library Base Training'));

    // A setup state, not evidence of the wrong account. Matches the popup.
    expect(screen.queryByText('Account mismatch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('should not warn about accounts when they match', () => {
    renderOverlay();

    expect(screen.queryByText('Account mismatch')).not.toBeInTheDocument();
  });

  it('should let the coach select athlete groups', () => {
    renderOverlay();

    fireEvent.click(screen.getByRole('button', { name: 'Athlete Groups' }));
    fireEvent.click(screen.getByLabelText('Select athlete group Squad A'));

    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
    expect(
      screen.getByText('1 athlete group (2 athletes)')
    ).toBeInTheDocument();
  });

  it('should show a selection made on another tab', () => {
    renderOverlay();

    fireEvent.click(screen.getByLabelText('Select library Base Training'));
    fireEvent.click(screen.getByRole('button', { name: /^Training Plans/ }));

    // Import acts on every tab's selection, so the library picked on the
    // Libraries tab has to stay visible from the Training Plans tab.
    expect(
      screen.getByRole('button', { name: 'Libraries, 1 selected' })
    ).toBeInTheDocument();
  });

  it('should not label a tab with a count when nothing is selected on it', () => {
    renderOverlay();

    expect(
      screen.getByRole('button', { name: 'Libraries' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Athlete Groups' })
    ).toBeInTheDocument();
  });
});

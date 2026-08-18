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
});

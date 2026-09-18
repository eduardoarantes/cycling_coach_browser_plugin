/**
 * An export that PlanMyPeak refused for authentication offers sign-in in the
 * result modal, which is the surface the coach sees once the dialog has
 * closed — including for failures after the duplicate check or with no check
 * at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExportResult } from '@/popup/components/export/ExportResult';
import { MultiExportResult } from '@/popup/components/export/MultiExportResult';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';
import { PLANMYPEAK_AUTH_MESSAGES } from '@/utils/uiStrings';

const refresh = vi.fn();
const validateAuth = vi.fn();

vi.mock('@/hooks/useProviderAuthRefresh', () => ({
  useProviderAuthRefresh: () => ({
    status: 'idle',
    isRefreshing: false,
    message: null,
    refresh,
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: () => ({ validateAuth }),
}));

function result(overrides: Partial<ExportResultType> = {}): ExportResultType {
  return {
    success: false,
    fileName: 'Base',
    format: 'api',
    itemsExported: 0,
    warnings: [],
    errors: ['PlanMyPeak sign-in required.'],
    ...overrides,
  };
}

function signInButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', {
    name: PLANMYPEAK_AUTH_MESSAGES.GATE_ACTION,
  });
}

describe('export result sign-in action', () => {
  beforeEach(() => {
    refresh.mockReset().mockResolvedValue({ outcome: 'refreshed' });
    validateAuth.mockReset();
  });

  it('should offer sign-in for an upload that failed authentication', async () => {
    render(
      <ExportResult
        result={result({ authFailure: { reason: 'sign_in_required' } })}
        onClose={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(signInButtons()[0]);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(validateAuth).toHaveBeenCalled();
  });

  it('should offer sign-in on a partial success that ended in an auth failure', () => {
    render(
      <ExportResult
        result={result({
          success: true,
          itemsExported: 5,
          errors: undefined,
          authFailure: { reason: 'sign_in_required' },
        })}
        onClose={vi.fn()}
      />
    );

    expect(signInButtons()).toHaveLength(1);
  });

  it('should not offer sign-in for a failure that is not about authentication', () => {
    render(
      <ExportResult
        result={result({ errors: ['Internal Server Error'] })}
        onClose={vi.fn()}
      />
    );

    expect(signInButtons()).toHaveLength(0);
  });

  it('should offer sign-in once for a batch that stopped on an auth failure', () => {
    render(
      <MultiExportResult
        results={[
          result({ success: true, itemsExported: 12, errors: undefined }),
          result({
            fileName: 'Build',
            authFailure: { reason: 'sign_in_required' },
          }),
          result({
            fileName: 'Peak',
            authFailure: { reason: 'sign_in_required' },
          }),
        ]}
        onClose={vi.fn()}
      />
    );

    expect(signInButtons()).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlanMyPeakLibraries } from '@/hooks/usePlanMyPeakLibraries';

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePlanMyPeakLibraries', () => {
  it('should stay passive: the idle list query never carries a recovery run', async () => {
    // This query runs whenever the popup opens. A run id here would let simply
    // opening the popup open a sign-in tab; the export path carries its own.
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => usePlanMyPeakLibraries(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const messages = vi
      .mocked(chrome.runtime.sendMessage)
      .mock.calls.map((call) => call[0] as Record<string, unknown>);
    expect(messages).toContainEqual({ type: 'GET_PLANMYPEAK_LIBRARIES' });
    expect(messages.every((m) => !('authRunId' in m))).toBe(true);
  });
});

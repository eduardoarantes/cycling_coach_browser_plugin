import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlanMyPeakEnvironment } from '@/hooks/usePlanMyPeakEnvironment';
import { STORAGE_KEYS } from '@/utils/constants';

describe('usePlanMyPeakEnvironment', () => {
  beforeEach(async () => {
    await chrome.storage.local.remove([
      STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT,
      STORAGE_KEYS.PLANMYPEAK_APP_PORT,
    ]);
  });

  it('should load the stored environment and its host label', async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]: 'staging',
    });

    const { result } = renderHook(() => usePlanMyPeakEnvironment());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.environment).toBe('staging');
    expect(result.current.hostLabel).toBe('staging.app.planmypeak.com');
    expect(result.current.isLocalEnvironment).toBe(false);
  });

  it('should persist a new selection', async () => {
    const { result } = renderHook(() => usePlanMyPeakEnvironment());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setEnvironment('staging');
    });

    expect(result.current.environment).toBe('staging');
    const stored = await chrome.storage.local.get(
      STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT
    );
    expect(stored[STORAGE_KEYS.PLANMYPEAK_ENVIRONMENT]).toBe('staging');
  });

  it('should expose staging alongside the other reachable environments', async () => {
    const { result } = renderHook(() => usePlanMyPeakEnvironment());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.availableEnvironments).toContain('staging');
    expect(result.current.availableEnvironments).toContain('production');
  });
});

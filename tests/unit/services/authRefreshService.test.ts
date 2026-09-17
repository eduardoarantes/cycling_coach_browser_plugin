/**
 * The quiet auth refresh: a temporary background tab that is closed once the
 * token lands, surfaced when the coach has to sign in, and never a reload of
 * an existing tab.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_REFRESH_TIMEOUT_MS,
  refreshProviderAuth,
} from '@/services/authRefreshService';
import { STORAGE_KEYS } from '@/utils/constants';
import { getPlanMyPeakAppUrl } from '@/services/planMyPeakConfigService';

type StorageListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void;
type TabRemovedListener = (tabId: number) => void;

function latestStorageListener(): StorageListener {
  const calls = vi.mocked(chrome.storage.onChanged.addListener).mock.calls;
  return calls[calls.length - 1][0] as StorageListener;
}

function latestTabRemovedListener(): TabRemovedListener {
  const calls = vi.mocked(chrome.tabs.onRemoved.addListener).mock.calls;
  return calls[calls.length - 1][0] as TabRemovedListener;
}

// Fake timers are on, so flushing pending promises means ticking the clock.
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

async function startRefresh(
  provider: 'trainingpeaks' | 'planmypeak' = 'trainingpeaks'
): Promise<{
  result: ReturnType<typeof refreshProviderAuth>;
  tabId: number;
}> {
  const result = refreshProviderAuth(provider);
  await flush();
  const created = vi.mocked(chrome.tabs.create).mock.results.at(-1);
  const tab = (await created?.value) as { id: number };
  return { result, tabId: tab.id };
}

function deliverToken(
  tokenKey: string,
  timestampKey: string,
  writtenAt: number
): void {
  latestStorageListener()(
    {
      [tokenKey]: { newValue: 'gAAAA-fresh' },
      [timestampKey]: { newValue: writtenAt },
    },
    'local'
  );
}

describe('refreshProviderAuth', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await chrome.storage.local.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a background tab, closes it once the token lands, and reports refreshed', async () => {
    const { result, tabId } = await startRefresh();

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://app.trainingpeaks.com',
      active: false,
    });
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(chrome.windows.update).not.toHaveBeenCalled();

    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );

    await expect(result).resolves.toEqual({ outcome: 'refreshed' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId);
    expect(chrome.tabs.update).not.toHaveBeenCalled();
  });

  it("never touches the coach's existing tabs", async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([
      { id: 5, url: 'https://app.trainingpeaks.com/#calendar' } as never,
    ]);

    const { result } = await startRefresh();
    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );
    await result;

    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(chrome.tabs.update).not.toHaveBeenCalledWith(5, expect.anything());
    expect(chrome.tabs.remove).not.toHaveBeenCalledWith(5);
  });

  it('ignores a token written before the tab was opened', async () => {
    const { result, tabId } = await startRefresh();

    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now() - 60_000
    );
    await flush();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();

    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );
    await expect(result).resolves.toEqual({ outcome: 'refreshed' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId);
  });

  it("ignores the other provider's token and other storage areas", async () => {
    const { result } = await startRefresh();

    deliverToken(
      STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
      STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
      Date.now()
    );
    latestStorageListener()(
      { [STORAGE_KEYS.AUTH_TOKEN]: { newValue: 'gAAAA' } },
      'sync'
    );
    await flush();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTH_REFRESH_TIMEOUT_MS);
    await expect(result).resolves.toMatchObject({
      outcome: 'sign_in_required',
    });
  });

  it('leaves the tab open and brings it forward when no token arrives', async () => {
    const { result, tabId } = await startRefresh();

    await vi.advanceTimersByTimeAsync(AUTH_REFRESH_TIMEOUT_MS);

    await expect(result).resolves.toEqual({
      outcome: 'sign_in_required',
      tabId,
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('reports cancelled when the coach closes the tab first', async () => {
    const { result, tabId } = await startRefresh();

    latestTabRemovedListener()(tabId);

    await expect(result).resolves.toEqual({ outcome: 'cancelled' });
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    expect(chrome.tabs.update).not.toHaveBeenCalled();
  });

  it('ignores removal of some other tab', async () => {
    const { result, tabId } = await startRefresh();

    latestTabRemovedListener()(tabId + 1);
    await flush();
    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );

    await expect(result).resolves.toEqual({ outcome: 'refreshed' });
  });

  it('shares one tab between concurrent requests for the same provider', async () => {
    const first = refreshProviderAuth('trainingpeaks');
    const second = refreshProviderAuth('trainingpeaks');
    await flush();

    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);

    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );

    await expect(first).resolves.toEqual({ outcome: 'refreshed' });
    await expect(second).resolves.toEqual({ outcome: 'refreshed' });
    expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
  });

  it('removes its listeners once settled', async () => {
    const { result } = await startRefresh();
    const storageListener = latestStorageListener();
    const tabListener = latestTabRemovedListener();

    deliverToken(
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
      Date.now()
    );
    await result;

    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(
      storageListener
    );
    expect(chrome.tabs.onRemoved.removeListener).toHaveBeenCalledWith(
      tabListener
    );
  });

  it('reports an error when the tab cannot be created', async () => {
    vi.mocked(chrome.tabs.create).mockRejectedValueOnce(
      new Error('No browser window')
    );

    await expect(refreshProviderAuth('trainingpeaks')).resolves.toEqual({
      outcome: 'error',
      error: 'No browser window',
    });
  });

  it('uses the PlanMyPeak app URL and token keys for planmypeak', async () => {
    const { result, tabId } = await startRefresh('planmypeak');

    // Environment-aware: the portal in production builds, the configured
    // local app in local-target builds (which is what Vitest runs as).
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: await getPlanMyPeakAppUrl(),
      active: false,
    });

    deliverToken(
      STORAGE_KEYS.MYPEAK_AUTH_TOKEN,
      STORAGE_KEYS.MYPEAK_TOKEN_TIMESTAMP,
      Date.now()
    );

    await expect(result).resolves.toEqual({ outcome: 'refreshed' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId);
  });
});

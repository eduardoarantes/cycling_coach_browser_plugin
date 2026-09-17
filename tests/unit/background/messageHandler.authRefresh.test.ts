/**
 * REFRESH_PROVIDER_AUTH opens a tab, so only the extension's own pages and
 * the PlanMyPeak overlay may ask for it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as authRefreshService from '@/services/authRefreshService';
import type { RefreshProviderAuthMessage } from '@/types';

vi.mock('@/services/authRefreshService', () => ({
  refreshProviderAuth: vi.fn(),
}));

const message: RefreshProviderAuthMessage = {
  type: 'REFRESH_PROVIDER_AUTH',
  provider: 'trainingpeaks',
};

function tabSender(origin: string): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    origin,
    tab: { id: 3, url: `${origin}/page` } as chrome.tabs.Tab,
  };
}

describe('messageHandler REFRESH_PROVIDER_AUTH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authRefreshService.refreshProviderAuth).mockResolvedValue({
      outcome: 'refreshed',
    });
  });

  it('runs the refresh for the popup', async () => {
    const result = await handleMessage(message, { id: 'test-extension-id' });

    expect(result).toEqual({ outcome: 'refreshed' });
    expect(authRefreshService.refreshProviderAuth).toHaveBeenCalledWith(
      'trainingpeaks'
    );
  });

  it('runs the refresh for the PlanMyPeak overlay', async () => {
    const result = await handleMessage(
      { ...message, provider: 'planmypeak' },
      tabSender('https://portal.planmypeak.com')
    );

    expect(result).toEqual({ outcome: 'refreshed' });
    expect(authRefreshService.refreshProviderAuth).toHaveBeenCalledWith(
      'planmypeak'
    );
  });

  it('refuses a foreign tab without opening anything', async () => {
    const result = await handleMessage(message, tabSender('https://evil.test'));

    expect(result).toMatchObject({ outcome: 'error' });
    expect(authRefreshService.refreshProviderAuth).not.toHaveBeenCalled();
  });

  it('refuses an unknown provider', async () => {
    const result = await handleMessage(
      { ...message, provider: 'strava' as never },
      { id: 'test-extension-id' }
    );

    expect(result).toMatchObject({ outcome: 'error' });
    expect(authRefreshService.refreshProviderAuth).not.toHaveBeenCalled();
  });
});

/**
 * Unit tests for AthleteGroupList
 *
 * Focused on the source-JSON viewer affordance, which must stay reachable in
 * the empty and no-search-results states: an unexpectedly empty group list is
 * exactly the case a user needs to inspect the raw TrainingPeaks payload for.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AthleteGroupList } from '@/popup/components/AthleteGroupList';
import type { AthleteGroup } from '@/types/api.types';

const useAthleteGroupsMock = vi.fn();

vi.mock('@/hooks/useAthleteGroups', () => ({
  useAthleteGroups: (): unknown => useAthleteGroupsMock(),
}));

vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: (): unknown => ({ isAuthenticated: true }),
}));

vi.mock('@/hooks/usePlanMyPeakGroupImport', () => ({
  usePlanMyPeakGroupImport: (): unknown => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
    error: null,
  }),
}));

vi.mock('@/utils/myPeakTab', () => ({ openMyPeakTab: vi.fn() }));

const rawPayload = [{ id: 1, coachId: 2, name: 'Squad', athleteIds: [7] }];

const groups: AthleteGroup[] = [
  { id: 1, coachId: 2, name: 'Squad', athleteIds: [7] },
];

function mockQuery(overrides: Record<string, unknown> = {}): void {
  useAthleteGroupsMock.mockReturnValue({
    data: groups,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    rawResponse: rawPayload,
    ...overrides,
  });
}

const sourceJsonButton = /view source json from trainingpeaks/i;

describe('AthleteGroupList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should offer the source JSON viewer when groups are present', () => {
    mockQuery();
    render(<AthleteGroupList />);

    expect(
      screen.getByRole('button', { name: sourceJsonButton })
    ).toBeInTheDocument();
  });

  it('should offer the source JSON viewer when the response contained no groups', () => {
    mockQuery({ data: [], rawResponse: [] });
    render(<AthleteGroupList />);

    expect(screen.getByText('No Athlete Groups Found')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: sourceJsonButton })
    ).toBeInTheDocument();
  });

  it('should offer the source JSON viewer when a search matches nothing', async () => {
    mockQuery();
    render(<AthleteGroupList />);

    fireEvent.change(screen.getByPlaceholderText('Search groups...'), {
      target: { value: 'no-such-group' },
    });

    // SearchBar debounces its onChange by 300ms.
    expect(await screen.findByText(/No groups match/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: sourceJsonButton })
    ).toBeInTheDocument();
  });

  it('should open the source JSON modal from the empty state', () => {
    mockQuery({ data: [], rawResponse: [] });
    render(<AthleteGroupList />);

    fireEvent.click(screen.getByRole('button', { name: sourceJsonButton }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('pre')?.textContent).toBe(
      JSON.stringify([], null, 2)
    );
  });

  it('should hide the source JSON viewer when no raw payload was captured', () => {
    mockQuery({ data: [], rawResponse: undefined });
    render(<AthleteGroupList />);

    expect(
      screen.queryByRole('button', { name: sourceJsonButton })
    ).not.toBeInTheDocument();
  });
});

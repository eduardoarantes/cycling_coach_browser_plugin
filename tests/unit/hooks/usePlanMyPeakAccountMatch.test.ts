import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlanMyPeakAccountMatch } from '@/hooks/usePlanMyPeakAccountMatch';

const useUserMock = vi.fn();
const useCoachMock = vi.fn();
const useEnvironmentMock = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: (): unknown => ({ isAuthenticated: true }),
}));
vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: (): unknown => ({ isAuthenticated: true }),
}));
vi.mock('@/hooks/useUser', () => ({
  useUser: (): unknown => useUserMock(),
}));
vi.mock('@/hooks/usePlanMyPeakCoach', () => ({
  usePlanMyPeakCoach: (): unknown => useCoachMock(),
}));
vi.mock('@/hooks/usePlanMyPeakEnvironment', () => ({
  usePlanMyPeakEnvironment: (): unknown => useEnvironmentMock(),
}));
vi.mock('@/schemas/planMyPeakApi.schema', () => ({
  getCoachTrainingPeaksExternalId: (coach: { linkedTpId: string | null }) =>
    coach.linkedTpId,
}));

const tpUser = { userId: 111, firstName: 'Ada', lastName: 'Coach' };

function coach(linkedTpId: string | null): unknown {
  return { firstName: 'Ada', lastName: 'Coach', linkedTpId };
}

function environment(
  name: 'production' | 'staging' | 'local',
  isLoading = false
): void {
  useEnvironmentMock.mockReturnValue({ environment: name, isLoading });
}

describe('usePlanMyPeakAccountMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserMock.mockReturnValue({ data: tpUser });
    environment('production');
  });

  it('reports a mismatch on production when the linked account differs', () => {
    useCoachMock.mockReturnValue({ data: coach('222') });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current).toMatchObject({
      status: 'mismatch',
      hasMismatch: true,
      tpUserId: '111',
      linkedTpId: '222',
    });
  });

  it('reports a match on production when the linked account is the same', () => {
    useCoachMock.mockReturnValue({ data: coach('111') });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current.status).toBe('matched');
    expect(result.current.hasMismatch).toBe(false);
  });

  it('reports not-linked on production when the coach has no TrainingPeaks link', () => {
    useCoachMock.mockReturnValue({ data: coach(null) });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current.status).toBe('not-linked');
    expect(result.current.hasMismatch).toBe(true);
  });

  it.each(['staging', 'local'] as const)(
    'does not enforce the comparison on %s',
    (name) => {
      environment(name);
      useCoachMock.mockReturnValue({ data: coach('222') });

      const { result } = renderHook(() => usePlanMyPeakAccountMatch());

      expect(result.current.status).toBe('not-enforced');
      expect(result.current.hasMismatch).toBe(false);
      // The ids are still reported for anything that wants to show them.
      expect(result.current.tpUserId).toBe('111');
      expect(result.current.linkedTpId).toBe('222');
    }
  );

  it('does not enforce a missing link off production either', () => {
    environment('local');
    useCoachMock.mockReturnValue({ data: coach(null) });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current.status).toBe('not-enforced');
    expect(result.current.hasMismatch).toBe(false);
  });

  it('stays unknown while the environment is still loading', () => {
    environment('production', true);
    useCoachMock.mockReturnValue({ data: coach('222') });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current.status).toBe('unknown');
    expect(result.current.hasMismatch).toBe(false);
  });

  it('stays unknown until both profiles are loaded', () => {
    useCoachMock.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => usePlanMyPeakAccountMatch());

    expect(result.current.status).toBe('unknown');
  });
});

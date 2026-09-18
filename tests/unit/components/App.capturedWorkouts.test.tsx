import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '@/popup/App';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    refreshAuth: vi.fn(),
  }),
}));
vi.mock('@/hooks/useMyPeakAuth', () => ({
  useMyPeakAuth: () => ({ isAuthenticated: false }),
}));
vi.mock('@/hooks/useIntervalsConnection', () => ({
  useIntervalsConnection: () => ({ isAuthenticated: false }),
}));
vi.mock('@/hooks/useConnectionSettings', () => ({
  useConnectionSettings: () => ({
    isPlanMyPeakEnabled: true,
    isIntervalsEnabled: false,
  }),
}));
vi.mock('@/hooks/useLibraries', () => ({
  useLibraries: () => ({ data: undefined }),
}));
vi.mock('@/hooks/usePlanMyPeakEnvironment', () => ({
  usePlanMyPeakEnvironment: () => ({
    environment: 'production',
    hostLabel: 'portal.planmypeak.com',
  }),
}));
vi.mock('@/hooks/useCapturedWorkouts', () => ({
  useCapturedWorkouts: () => ({ pendingCount: 2 }),
}));
vi.mock('@/hooks/useProviderAuthRefresh', () => ({
  useProviderAuthRefresh: () => ({ isRefreshing: false, refresh: vi.fn() }),
}));
vi.mock('@/popup/components/LibraryList', () => ({ LibraryList: () => null }));
vi.mock('@/popup/components/LibraryDetails', () => ({
  LibraryDetails: () => null,
}));
vi.mock('@/popup/components/TrainingPlanList', () => ({
  TrainingPlanList: () => null,
}));
vi.mock('@/popup/components/AthleteGroupList', () => ({
  AthleteGroupList: () => null,
}));
vi.mock('@/popup/components/PlanCalendar', () => ({
  PlanCalendar: () => null,
}));
vi.mock('@/popup/components/SettingsPage', () => ({
  SettingsPage: () => null,
}));
vi.mock('@/popup/components/ConnectionHealthSummary', () => ({
  ConnectionHealthSummary: () => null,
}));
vi.mock('@/popup/components/PlanMyPeakEnvironmentIndicator', () => ({
  PlanMyPeakEnvironmentIndicator: () => null,
}));
vi.mock('@/popup/components/ExportProgressBanner', () => ({
  ExportProgressBanner: () => null,
}));
vi.mock('@/popup/components/AccountMismatchBanner', () => ({
  AccountMismatchBanner: () => null,
}));
vi.mock('@/popup/components/CapturedWorkoutList', () => ({
  CapturedWorkoutList: () => <p>Locally saved workouts</p>,
}));

describe('popup capture availability', () => {
  it('opens New Workouts without either provider token', () => {
    chrome.runtime.getURL = vi.fn(
      (path: string) => `chrome-extension://test/${path}`
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Workouts/ }));
    expect(screen.getByText('Locally saved workouts')).toBeVisible();
    expect(
      screen.queryByText(/TrainingPeaks authentication is required/)
    ).not.toBeInTheDocument();
  });
});

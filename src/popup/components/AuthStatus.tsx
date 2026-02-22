/**
 * AuthStatus component
 *
 * Displays current authentication status with user info in a compact format
 */

import type { ReactElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

/**
 * Refresh TrainingPeaks tab or open a new one
 * Helps users get authenticated by ensuring they're on TrainingPeaks
 */
async function refreshTrainingPeaksTab(): Promise<void> {
  // Find all TrainingPeaks tabs
  const tabs = await chrome.tabs.query({
    url: 'https://app.trainingpeaks.com/*',
  });

  if (tabs.length > 0 && tabs[0].id) {
    // Refresh the first TrainingPeaks tab
    await chrome.tabs.reload(tabs[0].id);
    // Focus the tab so user sees it
    await chrome.tabs.update(tabs[0].id, { active: true });
  } else {
    // No TrainingPeaks tab open - open one
    await chrome.tabs.create({
      url: 'https://app.trainingpeaks.com',
      active: true,
    });
  }
}

/**
 * Format token age for display
 */
const formatTokenAge = (age: number | null): string => {
  if (age === null) return 'Unknown';
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
};

export function AuthStatus(): ReactElement {
  const { isAuthenticated, isLoading, error, tokenAge, refreshAuth } =
    useAuth();
  const { data: user } = useUser({ enabled: isAuthenticated });

  if (isLoading) {
    return (
      <div className="mb-3 p-2 bg-gray-100 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
            <p className="text-xs font-medium text-red-800 truncate">
              Authentication Error
            </p>
          </div>
          <button
            onClick={refreshAuth}
            className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
            title="Retry authentication"
            aria-label="Retry authentication"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const handleRefreshClick = async (): Promise<void> => {
      // Refresh TrainingPeaks tab to help user log in
      await refreshTrainingPeaksTab();
      // Wait a moment for the page to load, then check auth again
      setTimeout(() => {
        refreshAuth();
      }, 2000);
    };

    return (
      <div className="mb-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
            <p className="text-xs font-medium text-yellow-800 truncate">
              Not Authenticated
            </p>
          </div>
          <button
            onClick={handleRefreshClick}
            className="ml-2 text-yellow-600 hover:text-yellow-800 flex-shrink-0"
            title="Open/refresh TrainingPeaks and check authentication"
            aria-label="Refresh authentication"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - show user info inline
  const fullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Authenticated User';
  const tooltipText = user
    ? `${user.email}\nToken obtained ${formatTokenAge(tokenAge)}`
    : `Token obtained ${formatTokenAge(tokenAge)}`;

  return (
    <div
      className="mb-3 p-2 bg-green-50 rounded-lg border border-green-200"
      title={tooltipText}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
          <p className="text-xs font-medium text-green-800 truncate">
            {fullName}
          </p>
        </div>
        <button
          onClick={refreshAuth}
          className="ml-2 text-green-600 hover:text-green-800 flex-shrink-0"
          title="Refresh authentication status"
          aria-label="Refresh authentication"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

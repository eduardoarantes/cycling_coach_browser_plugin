/**
 * AuthRow component
 *
 * Reusable authentication status row component used across AuthStatus and SettingsPage.
 * Displays provider authentication state with color-coded indicators.
 */

import type { ReactElement } from 'react';

/**
 * RefreshIcon component
 *
 * SVG icon for refresh/sync actions
 */
export function RefreshIcon(): ReactElement {
  return (
    <svg
      className="h-4 w-4"
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
  );
}

/**
 * Color scheme for auth status states
 */
interface AuthRowColorScheme {
  container: string;
  dot: string;
  text: string;
  subtitle: string;
  button: string;
}

/**
 * Get color scheme based on authentication state
 */
function getAuthRowColors(
  isLoading: boolean,
  isAuthenticated: boolean,
  error: string | null
): AuthRowColorScheme {
  if (isLoading) {
    return {
      container: 'bg-gray-50 border-gray-200',
      dot: 'bg-gray-400',
      text: 'text-gray-700',
      subtitle: 'text-gray-600',
      button: 'text-gray-600 hover:text-gray-800',
    };
  }

  if (error) {
    return {
      container: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      text: 'text-red-800',
      subtitle: 'text-red-700',
      button: 'text-red-600 hover:text-red-800',
    };
  }

  if (isAuthenticated) {
    return {
      container: 'bg-green-50 border-green-200',
      dot: 'bg-green-500',
      text: 'text-green-800',
      subtitle: 'text-green-700',
      button: 'text-green-600 hover:text-green-800',
    };
  }

  return {
    container: 'bg-yellow-50 border-yellow-200',
    dot: 'bg-yellow-500',
    text: 'text-yellow-900',
    subtitle: 'text-yellow-800',
    button: 'text-yellow-700 hover:text-yellow-900',
  };
}

export interface AuthRowProps {
  /** Display label for the provider (e.g., "TrainingPeaks: Authenticated") */
  label: string;
  /** Secondary text displayed below label */
  subtitle: string;
  /** Whether the provider is authenticated */
  isAuthenticated: boolean;
  /** Whether authentication check is in progress */
  isLoading: boolean;
  /** Error message to display, if any */
  error: string | null;
  /** Tooltip text for the row */
  title?: string;
  /** Callback when refresh button is clicked */
  onRefresh?: () => Promise<void>;
}

/**
 * AuthRow component
 *
 * Displays authentication status for a single provider with:
 * - Color-coded background based on state
 * - Status indicator dot (or spinner when loading)
 * - Label and subtitle text
 * - Optional refresh button
 * - Error message display
 */
export function AuthRow({
  label,
  subtitle,
  isAuthenticated,
  isLoading,
  error,
  title,
  onRefresh,
}: AuthRowProps): ReactElement {
  const colors = getAuthRowColors(isLoading, isAuthenticated, error);

  return (
    <div className={`rounded-lg border p-2 ${colors.container}`} title={title}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {isLoading ? (
            <div className="mt-1 h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <span
              className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${colors.dot}`}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <p className={`truncate text-xs font-semibold ${colors.text}`}>
              {label}
            </p>
            <p className={`text-[11px] ${colors.subtitle}`}>{subtitle}</p>
            {error ? (
              <p className="mt-1 text-[11px] text-red-700">{error}</p>
            ) : null}
          </div>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className={`shrink-0 ${colors.button}`}
            title={`Refresh ${label.split(':')[0]} authentication`}
            aria-label={`Refresh ${label.split(':')[0]} authentication`}
            onClick={() => {
              void onRefresh();
            }}
          >
            <RefreshIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

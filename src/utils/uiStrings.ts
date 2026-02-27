/**
 * UI string constants
 *
 * Centralized strings for UI components to enable consistency and easier maintenance.
 * This also prepares the codebase for potential i18n/localization in the future.
 */

/**
 * Connection health summary status messages
 */
export const CONNECTION_HEALTH_MESSAGES = {
  ALL_AUTHENTICATED: 'All enabled connections authenticated',
  SOME_NOT_AUTHENTICATED: 'Some enabled connections are not authenticated',
  NONE_AUTHENTICATED: 'No enabled connections authenticated',
  MANAGE_SETTINGS_SUFFIX: 'Manage optional providers in Settings.',
  authenticatedCount: (authenticated: number, enabled: number): string =>
    `Authenticated ${authenticated}/${enabled} enabled connections. ${CONNECTION_HEALTH_MESSAGES.MANAGE_SETTINGS_SUFFIX}`,
} as const;

/**
 * Settings page strings
 */
export const SETTINGS_STRINGS = {
  TITLE: 'Settings',
  SUBTITLE: 'Manage provider connections',
  TRAINING_PEAKS_REQUIRED: 'TrainingPeaks (Required)',
  TRAINING_PEAKS_DESCRIPTION:
    'This connection is mandatory for loading workouts and training plans.',
  PLANMYPEAK_OPTIONAL: 'PlanMyPeak (Optional)',
  PLANMYPEAK_DESCRIPTION:
    'Enable if you want to export directly to PlanMyPeak.',
  INTERVALS_OPTIONAL: 'Intervals.icu (Optional)',
  INTERVALS_DESCRIPTION: 'Enable if you want Intervals.icu export options.',
  CONNECTION_DISABLED:
    'Connection disabled. Enable to configure authentication.',
  ENABLED: 'Enabled',
  DISABLED: 'Disabled',
} as const;

/**
 * Auth status display strings
 */
export const AUTH_STATUS_STRINGS = {
  CHECKING: 'Checking...',
  AUTHENTICATED: 'Authenticated',
  NOT_AUTHENTICATED: 'Not Authenticated',
  CONNECTED: 'Connected',
  NOT_CONNECTED: 'Not Connected',
  VALIDATION_NEEDED: 'Validation Needed',
  ERROR: 'Error',
  TOKEN_AGE_PREFIX: 'Token',
  API_KEY_CONFIGURED: 'API key configured',
  // Provider-specific
  TRAINING_PEAKS: {
    LABEL: 'TrainingPeaks',
    OPEN_TO_CAPTURE: 'Open TrainingPeaks to capture a token',
    REQUIRED_PREFIX: 'Required connection. ',
  },
  PLANMYPEAK: {
    LABEL: 'PlanMyPeak',
    OPEN_TO_SIGN_IN: 'Open localhost:3006 and sign in',
    SUPABASE_SUFFIX: '(Supabase)',
  },
  INTERVALS: {
    LABEL: 'Intervals.icu',
    ADD_API_KEY: 'Add your Intervals.icu API key below.',
  },
} as const;

/**
 * Export dialog strings
 */
export const EXPORT_DIALOG_STRINGS = {
  NO_DESTINATIONS_ENABLED: 'No export destinations enabled',
  OPEN_SETTINGS_GUIDANCE:
    'Open Settings and enable PlanMyPeak and/or Intervals.icu',
} as const;

/**
 * Error boundary strings
 */
export const ERROR_BOUNDARY_STRINGS = {
  TITLE: 'Something went wrong',
  DEFAULT_MESSAGE: 'An unexpected error occurred.',
  TRY_AGAIN: 'Try again',
} as const;

/**
 * Format token age for display
 * @param age - Token age in milliseconds
 * @returns Formatted string like "2h 30m ago" or "15m ago"
 */
export function formatTokenAge(age: number | null): string {
  if (age === null) return 'Unknown';
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
}

/**
 * Build provider status label
 * @param provider - Provider name
 * @param isLoading - Whether auth check is in progress
 * @param isAuthenticated - Whether provider is authenticated
 * @param error - Error message if any
 * @param userName - Optional user name for display
 */
export function buildProviderStatusLabel(
  provider: 'TrainingPeaks' | 'PlanMyPeak' | 'Intervals.icu',
  isLoading: boolean,
  isAuthenticated: boolean,
  error: string | null,
  userName?: string
): string {
  if (isLoading) {
    return `${provider}: ${AUTH_STATUS_STRINGS.CHECKING}`;
  }
  if (error) {
    return provider === 'PlanMyPeak'
      ? `${provider}: ${AUTH_STATUS_STRINGS.VALIDATION_NEEDED}`
      : `${provider}: ${AUTH_STATUS_STRINGS.ERROR}`;
  }
  if (isAuthenticated) {
    if (provider === 'Intervals.icu') {
      return `${provider}: ${AUTH_STATUS_STRINGS.CONNECTED}`;
    }
    const displayName = userName?.trim() ?? AUTH_STATUS_STRINGS.AUTHENTICATED;
    return `${provider}: ${displayName}`;
  }
  if (provider === 'Intervals.icu') {
    return `${provider}: ${AUTH_STATUS_STRINGS.NOT_CONNECTED}`;
  }
  return `${provider}: ${AUTH_STATUS_STRINGS.NOT_AUTHENTICATED}`;
}

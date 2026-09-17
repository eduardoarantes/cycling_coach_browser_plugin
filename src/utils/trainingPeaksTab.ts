/**
 * TrainingPeaks auth-refresh helpers for the popup, plus the shared
 * error-classification helpers used by every error screen.
 */

import type { AuthRefreshResult, RefreshProviderAuthMessage } from '@/types';
import { logger } from './logger';

/**
 * Ask the background to refresh the TrainingPeaks token.
 *
 * The background opens a temporary background tab on TrainingPeaks, waits for
 * the page's own authenticated request to be captured, and closes the tab.
 * The coach's existing TrainingPeaks tab is never reloaded or focused. When no
 * token arrives (the coach is signed out), the tab is left open and brought
 * forward so they can sign in, and the result says so.
 */
export async function requestTrainingPeaksAuthRefresh(): Promise<AuthRefreshResult> {
  try {
    return await chrome.runtime.sendMessage<
      RefreshProviderAuthMessage,
      AuthRefreshResult
    >({ type: 'REFRESH_PROVIDER_AUTH', provider: 'trainingpeaks' });
  } catch (error) {
    logger.error('Failed to request TrainingPeaks auth refresh:', error);
    return {
      outcome: 'error',
      error: error instanceof Error ? error.message : 'Auth refresh failed',
    };
  }
}
/**
 * Check if an error is a 401 authentication error
 */
export function is401Error(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('not authenticated') ||
    message.includes('no_token')
  );
}

/**
 * Check if an error is a 403 forbidden/permission error
 */
export function is403Error(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('403') || message.includes('forbidden');
}

/**
 * Extract HTTP status code from error message
 * Returns null if no status code found
 */
export function extractHttpStatus(error: Error): number | null {
  const match = error.message.match(/HTTP\s+(\d{3})/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get user-friendly error message based on error type
 * Returns formatted message with HTTP status in parentheses if available
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  const httpStatus = extractHttpStatus(error);
  const statusSuffix = httpStatus ? ` (HTTP ${httpStatus})` : '';

  // Check for specific error types
  if (is403Error(error)) {
    return `You are not allowed to access this content${statusSuffix}`;
  }

  if (is401Error(error)) {
    return `Authentication required${statusSuffix}`;
  }

  if (error.message.toLowerCase().includes('network')) {
    return `Network error - check your internet connection${statusSuffix}`;
  }

  if (error.message.toLowerCase().includes('no_token')) {
    return `Not authenticated - please visit TrainingPeaks${statusSuffix}`;
  }

  // Default: use original message with status code
  const baseMessage = error.message.replace(/HTTP\s+\d{3}/i, '').trim();
  return `${baseMessage}${statusSuffix}`;
}

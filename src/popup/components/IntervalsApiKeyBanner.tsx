/**
 * Intervals.icu API Key Configuration Banner
 *
 * Collapsible banner that shows connection status and allows users
 * to configure their Intervals.icu API key for workout export.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type {
  ClearIntervalsApiKeyMessage,
  SetIntervalsApiKeyMessage,
  HasIntervalsApiKeyMessage,
} from '@/types';
import { logger } from '@/utils/logger';

/**
 * Check if Intervals.icu API key is configured
 */
async function checkHasApiKey(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage<
      HasIntervalsApiKeyMessage,
      { hasKey: boolean }
    >({ type: 'HAS_INTERVALS_API_KEY' });
    return response.hasKey;
  } catch (error) {
    logger.error('Failed to check API key:', error);
    return false;
  }
}

/**
 * Save Intervals.icu API key to storage
 */
async function saveApiKey(apiKey: string): Promise<void> {
  const response = await chrome.runtime.sendMessage<
    SetIntervalsApiKeyMessage,
    { success: boolean; error?: string }
  >({
    type: 'SET_INTERVALS_API_KEY',
    apiKey,
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to save API key');
  }
}

/**
 * Remove Intervals.icu API key from storage
 */
async function clearApiKey(): Promise<void> {
  const response = await chrome.runtime.sendMessage<
    ClearIntervalsApiKeyMessage,
    { success: boolean; error?: string }
  >({
    type: 'CLEAR_INTERVALS_API_KEY',
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to clear API key');
  }
}

/**
 * Intervals.icu API Key Banner Component
 *
 * Shows connection status and provides UI for configuring API key.
 * Collapsible to save space when not in use.
 */
export function IntervalsApiKeyBanner(): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if API key exists on mount
  useEffect(() => {
    checkHasApiKey().then(setHasKey);
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!apiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await saveApiKey(apiKey);
      setSuccess(true);
      setHasKey(true);
      setApiKey('');

      // Auto-collapse after successful save
      setTimeout(() => {
        setExpanded(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
      logger.error('Failed to save Intervals.icu API key:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await clearApiKey();
      setHasKey(false);
      setApiKey('');
      setSuccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear API key');
      logger.error('Failed to clear Intervals.icu API key:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (): void => {
    setExpanded(!expanded);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={handleToggle}
        className="w-full p-3 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🚴‍♂️</span>
          <span className="text-sm font-semibold text-gray-800">
            Intervals.icu Integration
          </span>
          {hasKey ? (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
              ✓ Connected
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full font-medium">
              Setup Required
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="mb-3">
            <label
              htmlFor="intervals-api-key"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              API Key
            </label>
            <input
              id="intervals-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Intervals.icu API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Your API key is stored securely and only used for workout export.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              type="button"
            >
              {isLoading ? 'Saving...' : 'Save API Key'}
            </button>
            {hasKey && (
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-3">
            <a
              href="https://intervals.icu/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            >
              <span>Get your API key from Intervals.icu Settings</span>
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ API key saved successfully!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

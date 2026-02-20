/**
 * Content script for intercepting bearer tokens from TrainingPeaks requests
 *
 * This script runs on app.trainingpeaks.com and intercepts fetch/XHR requests
 * to extract the bearer token from Authorization headers.
 */

// Store original fetch for interception
const originalFetch = window.fetch;

/**
 * Intercepts fetch requests and extracts bearer tokens
 */
window.fetch = async function (...args) {
  const [_url, options] = args;

  // Check if the request has an Authorization header
  if (options && options.headers) {
    const headers = new Headers(options.headers);
    const authHeader = headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Send token to background script
      chrome.runtime
        .sendMessage({
          type: 'TOKEN_FOUND',
          token: token,
          timestamp: Date.now(),
        })
        .catch((error) => {
          console.error('Failed to send token to background script:', error);
        });

      console.log('TrainingPeaks Extension: Bearer token intercepted');
    }
  }

  // Call original fetch
  return originalFetch.apply(this, args);
};

/**
 * Intercept XMLHttpRequest for older API calls
 */
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

// Store headers set on XHR instance
const xhrHeaders = new WeakMap<XMLHttpRequest, Map<string, string>>();

XMLHttpRequest.prototype.setRequestHeader = function (
  header: string,
  value: string
) {
  // Store headers for this XHR instance
  if (!xhrHeaders.has(this)) {
    xhrHeaders.set(this, new Map());
  }
  xhrHeaders.get(this)!.set(header.toLowerCase(), value);

  return originalXHRSetRequestHeader.apply(this, [header, value]);
};

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
) {
  // Add load event listener to check for auth header
  this.addEventListener('loadstart', function () {
    const headers = xhrHeaders.get(this);
    if (headers) {
      const authHeader = headers.get('authorization');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        chrome.runtime
          .sendMessage({
            type: 'TOKEN_FOUND',
            token: token,
            timestamp: Date.now(),
          })
          .catch((error) => {
            console.error('Failed to send token to background script:', error);
          });

        console.log('TrainingPeaks Extension: Bearer token intercepted (XHR)');
      }
    }
  });

  return originalXHROpen.call(
    this,
    method,
    url,
    async ?? true,
    username,
    password
  );
};

console.log('TrainingPeaks Extension: Token interceptor loaded');

export {};

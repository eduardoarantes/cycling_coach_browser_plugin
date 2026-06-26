/**
 * Main world interceptor - runs in page's JavaScript context
 *
 * This script runs with world: "MAIN" in Manifest V3, bypassing CSP restrictions.
 * It intercepts fetch/XHR and uses postMessage to send tokens to the isolated world.
 */

import { isMyPeakSupabaseRequest } from './mypeakAuthDetection';
import { extractRequestInfo, toAbsoluteUrl } from './requestInfo';

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log('[TP Extension - MAIN World]', ...args);
};

function maybePostMyPeakSupabaseAuth(
  url: string,
  headers: Headers,
  context: 'fetch' | 'xhr'
): void {
  if (!isMyPeakSupabaseRequest(url)) {
    return;
  }

  const authHeader = headers.get('authorization');
  const apiKey = headers.get('apikey');
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

  // Supabase login requests often use Authorization: Bearer <anon apikey>.
  // We only store a MyPeak user token when it differs from the anon key, or
  // when the request is clearly a user validation endpoint.
  const isUserEndpoint = url.includes('/auth/v1/user');
  const isUserToken =
    !!bearerToken &&
    (isUserEndpoint || (apiKey ? bearerToken !== apiKey : true));

  if (!apiKey && !isUserToken) {
    return;
  }

  log('  🧩 MyPeak/Supabase auth headers detected:', context, url);
  log('  🔑 apikey present:', !!apiKey);
  log('  🎫 user bearer present:', !!isUserToken);

  window.postMessage(
    {
      type: 'MY_PEAK_AUTH_FOUND',
      token: isUserToken ? bearerToken : null,
      apiKey: apiKey || null,
      timestamp: Date.now(),
      source: 'trainingpeaks-extension-main',
    },
    '*'
  );

  log('  ✅ Posted MyPeak auth details to isolated world');
}

log('🚀 Main world interceptor loading...');

// Store original fetch
const originalFetch = window.fetch;
let fetchCount = 0;

// Intercept fetch
window.fetch = async function (...args) {
  fetchCount++;
  const { urlStr: rawUrl, headers } = extractRequestInfo(args[0], args[1]);
  // Resolve relative URLs (e.g. fetch('/api/backend/...')) against the page
  // origin so host-based detection can match them.
  const urlStr = toAbsoluteUrl(rawUrl, document.baseURI);

  log('📡 Fetch request #' + fetchCount + ':', urlStr);

  const authHeader = headers.get('authorization');

  log('  ✓ Authorization:', authHeader ? 'present' : 'none');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Only capture TrainingPeaks encrypted tokens (start with "gAAAA")
    // NOT JWT tokens (start with "eyJ")
    const isEncryptedToken = token.startsWith('gAAAA');
    const isApiCall = urlStr.includes('tpapi.trainingpeaks.com');

    log('  🎫 Bearer token detected', {
      length: token.length,
      tokenType: isEncryptedToken ? 'encrypted' : 'jwt',
      isApiCall,
    });

    if (isEncryptedToken && isApiCall) {
      log('  ✅ Valid TrainingPeaks API token! Posting to isolated world...');

      // Send token to isolated world content script via postMessage
      window.postMessage(
        {
          type: 'TP_TOKEN_FOUND',
          token: token,
          timestamp: Date.now(),
          source: 'trainingpeaks-extension-main',
        },
        '*'
      );

      log('  ✅ Token posted');
    } else {
      log('  ⏭️ Skipping non-TrainingPeaks token candidate');
    }
  }

  maybePostMyPeakSupabaseAuth(urlStr, headers, 'fetch');

  return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const xhrHeaders = new WeakMap<XMLHttpRequest, Map<string, string>>();
let xhrCount = 0;

XMLHttpRequest.prototype.setRequestHeader = function (
  header: string,
  value: string
) {
  if (!xhrHeaders.has(this)) {
    xhrHeaders.set(this, new Map());
  }
  xhrHeaders.get(this)!.set(header.toLowerCase(), value);

  if (header.toLowerCase() === 'authorization') {
    log('  🔑 XHR Authorization header set');
  }

  return originalXHRSetRequestHeader.apply(this, [header, value]);
};

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
) {
  xhrCount++;
  const xhrUrlAbs = toAbsoluteUrl(url.toString(), document.baseURI);
  log('📡 XHR request #' + xhrCount + ':', method, xhrUrlAbs);

  this.addEventListener('loadstart', function () {
    const headers = xhrHeaders.get(this);
    if (headers) {
      maybePostMyPeakSupabaseAuth(
        xhrUrlAbs,
        new Headers(Array.from(headers.entries())),
        'xhr'
      );

      const authHeader = headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Only capture TrainingPeaks encrypted tokens (start with "gAAAA")
        // NOT JWT tokens (start with "eyJ")
        const isEncryptedToken = token.startsWith('gAAAA');
        const isApiCall = url.toString().includes('tpapi.trainingpeaks.com');

        log('  🎫 BEARER TOKEN FOUND (XHR)! Length:', token.length);
        log(
          '  🔍 Token type:',
          isEncryptedToken ? 'Encrypted (gAAAA)' : 'JWT (eyJ)'
        );
        log('  🌐 API call:', isApiCall ? 'YES' : 'NO');

        if (isEncryptedToken && isApiCall) {
          log('  ✅ Valid TrainingPeaks API token! Posting...');

          window.postMessage(
            {
              type: 'TP_TOKEN_FOUND',
              token: token,
              timestamp: Date.now(),
              source: 'trainingpeaks-extension-main',
            },
            '*'
          );

          log('  ✅ Token posted (XHR)');
        } else {
          log('  ⏭️ Skipping non-TrainingPeaks token candidate');
        }
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

log('✅ Interceptors installed in MAIN world (bypassed CSP)');

export {};

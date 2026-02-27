/**
 * Main world interceptor - runs in page's JavaScript context
 *
 * This script runs with world: "MAIN" in Manifest V3, bypassing CSP restrictions.
 * It intercepts fetch/XHR and uses postMessage to send tokens to the isolated world.
 */

const DEBUG = true;
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log('[TP Extension - MAIN World]', ...args);
};

const MYPEAK_SUPABASE_HOSTS = ['127.0.0.1:54361', 'localhost:54361'];

function isMyPeakSupabaseRequest(url: string): boolean {
  return MYPEAK_SUPABASE_HOSTS.some((host) => url.includes(host));
}

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
  const [url, options] = args;
  const urlStr = typeof url === 'string' ? url : url.toString();

  log('📡 Fetch request #' + fetchCount + ':', urlStr);

  // Check for Authorization header
  if (options && options.headers) {
    const headers = new Headers(options.headers);
    const authHeader = headers.get('authorization');

    log('  ✓ Has headers, Authorization:', authHeader ? 'present' : 'none');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Only capture TrainingPeaks encrypted tokens (start with "gAAAA")
      // NOT JWT tokens (start with "eyJ")
      const isEncryptedToken = token.startsWith('gAAAA');
      const isApiCall = urlStr.includes('tpapi.trainingpeaks.com');

      log('  🎫 BEARER TOKEN FOUND! Length:', token.length);
      log(
        '  🔍 Token type:',
        isEncryptedToken ? 'Encrypted (gAAAA)' : 'JWT (eyJ)'
      );
      log('  🌐 API call:', isApiCall ? 'YES' : 'NO');

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
        log(
          '  ⏭️ Skipping token (not encrypted API token):',
          token.substring(0, 20) + '...'
        );
      }
    }

    maybePostMyPeakSupabaseAuth(urlStr, headers, 'fetch');
  } else {
    log('  ℹ️  No headers');
  }

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
  log('📡 XHR request #' + xhrCount + ':', method, url.toString());

  this.addEventListener('loadstart', function () {
    const headers = xhrHeaders.get(this);
    if (headers) {
      maybePostMyPeakSupabaseAuth(
        url.toString(),
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
          log(
            '  ⏭️ Skipping token (not encrypted API token):',
            token.substring(0, 20) + '...'
          );
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
console.log('TrainingPeaks Extension: Token interceptor loaded in MAIN world');

export {};

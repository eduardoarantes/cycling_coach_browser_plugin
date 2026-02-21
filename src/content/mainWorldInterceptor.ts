/**
 * Main world interceptor - runs in page's JavaScript context
 *
 * This script runs with world: "MAIN" in Manifest V3, bypassing CSP restrictions.
 * It intercepts fetch/XHR and uses postMessage to send tokens to the isolated world.
 */

const DEBUG = true;
const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[TP Extension - MAIN World]', ...args);
};

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
      log('  🎫 BEARER TOKEN FOUND! Length:', token.length);
      log('  📤 Posting token to isolated world...');

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
    }
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
      const authHeader = headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        log('  🎫 BEARER TOKEN FOUND (XHR)! Length:', token.length);

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

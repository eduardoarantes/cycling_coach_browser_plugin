/**
 * Content script for intercepting bearer tokens from TrainingPeaks requests
 *
 * This script injects code into the page's main world to intercept fetch/XHR,
 * then uses message passing to send tokens to the background worker.
 *
 * Manifest V3 content scripts run in an isolated world, so we need to inject
 * a script element to access the page's actual fetch/XHR.
 */

console.log('[TP Extension - Content] 🚀 Content script initializing...');

/**
 * Inject interceptor into page's main world
 * This script runs in the page context and can intercept the real fetch/XHR
 */
function injectInterceptor(): void {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const DEBUG = true;
      const log = (...args) => {
        if (DEBUG) console.log('[TP Extension - Injected]', ...args);
      };

      log('🚀 Injected script running in main world');

      // Store original fetch
      const originalFetch = window.fetch;
      let fetchCount = 0;

      // Intercept fetch
      window.fetch = async function(...args) {
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
            log('  📤 Posting token to content script...');

            // Send token to content script via postMessage
            window.postMessage({
              type: 'TP_TOKEN_FOUND',
              token: token,
              timestamp: Date.now(),
              source: 'trainingpeaks-extension'
            }, '*');

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
      const xhrHeaders = new WeakMap();
      let xhrCount = 0;

      XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (!xhrHeaders.has(this)) {
          xhrHeaders.set(this, new Map());
        }
        xhrHeaders.get(this).set(header.toLowerCase(), value);

        if (header.toLowerCase() === 'authorization') {
          log('  🔑 XHR Authorization header set');
        }

        return originalXHRSetRequestHeader.apply(this, [header, value]);
      };

      XMLHttpRequest.prototype.open = function(method, url, async, username, password) {
        xhrCount++;
        log('📡 XHR request #' + xhrCount + ':', method, url.toString());

        this.addEventListener('loadstart', function() {
          const headers = xhrHeaders.get(this);
          if (headers) {
            const authHeader = headers.get('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
              const token = authHeader.substring(7);
              log('  🎫 BEARER TOKEN FOUND (XHR)! Length:', token.length);

              window.postMessage({
                type: 'TP_TOKEN_FOUND',
                token: token,
                timestamp: Date.now(),
                source: 'trainingpeaks-extension'
              }, '*');

              log('  ✅ Token posted (XHR)');
            }
          }
        });

        return originalXHROpen.call(this, method, url, async ?? true, username, password);
      };

      log('✅ Interceptors installed in main world');
      console.log('TrainingPeaks Extension: Token interceptor loaded');
    })();
  `;

  // Inject at document_start to run before page scripts
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up

  console.log(
    '[TP Extension - Content] ✅ Interceptor script injected into page'
  );
}

/**
 * Listen for messages from the injected script
 */
window.addEventListener('message', (event) => {
  // Only accept messages from same window and our extension
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'trainingpeaks-extension') return;
  if (event.data.type !== 'TP_TOKEN_FOUND') return;

  console.log(
    '[TP Extension - Content] 📨 Received token from injected script'
  );
  console.log(
    '[TP Extension - Content] 🎫 Token length:',
    event.data.token.length
  );

  // Forward to background worker
  console.log('[TP Extension - Content] 📤 Forwarding to background worker...');

  chrome.runtime
    .sendMessage({
      type: 'TOKEN_FOUND',
      token: event.data.token,
      timestamp: event.data.timestamp,
    })
    .then(() => {
      console.log(
        '[TP Extension - Content] ✅ Token sent to background successfully'
      );
    })
    .catch((error) => {
      console.error(
        '[TP Extension - Content] ❌ Failed to send to background:',
        error
      );
    });
});

// Inject the interceptor
injectInterceptor();

// Log environment info
console.log('[TP Extension - Content] 🔍 Environment check:');
console.log('[TP Extension - Content]   - URL:', window.location.href);
console.log(
  '[TP Extension - Content]   - chrome.runtime available:',
  typeof chrome?.runtime !== 'undefined'
);
console.log(
  '[TP Extension - Content]   - Extension ID:',
  chrome?.runtime?.id || 'UNKNOWN'
);
console.log(
  '[TP Extension - Content]   - Can send messages:',
  typeof chrome?.runtime?.sendMessage === 'function'
);
console.log('[TP Extension - Content] ✅ Content script fully loaded');

export {};

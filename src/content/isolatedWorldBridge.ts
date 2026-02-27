/**
 * Isolated world bridge - runs in extension's isolated context
 *
 * This script runs with world: "ISOLATED" (default) in Manifest V3.
 * It receives postMessage events from the main world interceptor
 * and forwards them to the background worker via chrome.runtime.
 */

console.log('[TP Extension - ISOLATED World] 🚀 Bridge initializing...');

/**
 * Listen for messages from the main world interceptor
 */
window.addEventListener('message', (event) => {
  // Only accept messages from same window and our extension
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'trainingpeaks-extension-main')
    return;
  if (
    event.data.type !== 'TP_TOKEN_FOUND' &&
    event.data.type !== 'MY_PEAK_AUTH_FOUND'
  )
    return;

  if (event.data.type === 'MY_PEAK_AUTH_FOUND') {
    console.log(
      '[TP Extension - ISOLATED World] 📨 Received MyPeak auth details from MAIN world'
    );

    chrome.runtime
      .sendMessage({
        type: 'MY_PEAK_AUTH_FOUND',
        token: event.data.token ?? null,
        apiKey: event.data.apiKey ?? null,
        timestamp: event.data.timestamp,
      })
      .then(() => {
        console.log(
          '[TP Extension - ISOLATED World] ✅ MyPeak auth details sent to background successfully'
        );
      })
      .catch((error) => {
        console.error(
          '[TP Extension - ISOLATED World] ❌ Failed to send MyPeak auth details to background:',
          error
        );
      });

    return;
  }

  console.log(
    '[TP Extension - ISOLATED World] 📨 Received token from MAIN world'
  );
  console.log(
    '[TP Extension - ISOLATED World] 🎫 Token length:',
    event.data.token.length
  );

  // Forward to background worker
  console.log(
    '[TP Extension - ISOLATED World] 📤 Forwarding to background worker...'
  );

  chrome.runtime
    .sendMessage({
      type: 'TOKEN_FOUND',
      token: event.data.token,
      timestamp: event.data.timestamp,
    })
    .then(() => {
      console.log(
        '[TP Extension - ISOLATED World] ✅ Token sent to background successfully'
      );
    })
    .catch((error) => {
      console.error(
        '[TP Extension - ISOLATED World] ❌ Failed to send to background:',
        error
      );
    });
});

// Log environment info
console.log('[TP Extension - ISOLATED World] 🔍 Environment check:');
console.log('[TP Extension - ISOLATED World]   - URL:', window.location.href);
console.log(
  '[TP Extension - ISOLATED World]   - chrome.runtime available:',
  typeof chrome?.runtime !== 'undefined'
);
console.log(
  '[TP Extension - ISOLATED World]   - Extension ID:',
  chrome?.runtime?.id || 'UNKNOWN'
);
console.log(
  '[TP Extension - ISOLATED World]   - Can send messages:',
  typeof chrome?.runtime?.sendMessage === 'function'
);
console.log(
  '[TP Extension - ISOLATED World] ✅ Bridge fully loaded, listening for tokens'
);

export {};

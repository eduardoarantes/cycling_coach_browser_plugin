/**
 * Isolated world bridge - runs in extension's isolated context
 *
 * This script runs with world: "ISOLATED" (default) in Manifest V3.
 * It receives postMessage events from the main world interceptor
 * and forwards them to the background worker via chrome.runtime.
 */

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) {
    console.log('[TP Extension - ISOLATED World]', ...args);
  }
};

const logError = (...args: unknown[]): void => {
  if (DEBUG) {
    console.error('[TP Extension - ISOLATED World]', ...args);
  }
};

log('🚀 Bridge initializing...');

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
    event.data.type !== 'MY_PEAK_AUTH_FOUND' &&
    event.data.type !== 'TP_WORKOUT_CREATED' &&
    event.data.type !== 'TP_WORKOUT_UPDATED'
  )
    return;

  if (
    event.data.type === 'TP_WORKOUT_CREATED' ||
    event.data.type === 'TP_WORKOUT_UPDATED'
  ) {
    log('📨 Received workout capture from MAIN world:', event.data.kind);

    // Relayed as-is: the background validates and normalizes it. No schema is
    // imported here so the always-injected bridge stays dependency-light.
    chrome.runtime
      .sendMessage({
        type: 'WORKOUT_CAPTURED',
        kind: event.data.type === 'TP_WORKOUT_CREATED' ? 'create' : 'update',
        athleteId: event.data.athleteId,
        workoutId: event.data.workoutId,
        request: event.data.request,
        response: event.data.response,
        timestamp: event.data.timestamp,
      })
      .then(() => {
        log('✅ Workout capture sent to background successfully');
      })
      .catch((error) => {
        logError('❌ Failed to send workout capture to background:', error);
      });

    return;
  }

  if (event.data.type === 'MY_PEAK_AUTH_FOUND') {
    log('📨 Received MyPeak auth details from MAIN world');

    chrome.runtime
      .sendMessage({
        type: 'MY_PEAK_AUTH_FOUND',
        token: event.data.token ?? null,
        apiKey: event.data.apiKey ?? null,
        timestamp: event.data.timestamp,
      })
      .then(() => {
        log('✅ MyPeak auth details sent to background successfully');
      })
      .catch((error) => {
        logError('❌ Failed to send MyPeak auth details to background:', error);
      });

    return;
  }

  log('📨 Received TrainingPeaks token from MAIN world');

  // Forward to background worker
  log('📤 Forwarding token to background worker');

  chrome.runtime
    .sendMessage({
      type: 'TOKEN_FOUND',
      token: event.data.token,
      timestamp: event.data.timestamp,
    })
    .then(() => {
      log('✅ Token sent to background successfully');
    })
    .catch((error) => {
      logError('❌ Failed to send token to background:', error);
    });
});

log('✅ Bridge loaded');

export {};

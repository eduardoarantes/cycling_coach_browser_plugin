/**
 * Background service worker entry point
 *
 * Handles messages from content scripts and popup UI
 *
 * DEBUG MODE: Enhanced logging to troubleshoot message handling
 */

import { resumeCaptureCoachEnrichment } from '@/services/captureCoachRefreshService';
import { handleMessage } from './messageHandler';
import { refreshBadge } from '@/services/badgeService';
import { recoverInterruptedOperations } from './capturedImports/importOperations';

const DEBUG = import.meta.env.DEV;
const logDebug = (...args: unknown[]): void => {
  if (DEBUG) {
    console.log('[TP Extension - Background]', ...args);
  }
};

logDebug('🚀 Background service worker loaded');

// A captured-workout import runs inside this worker and cannot outlive it. On
// every start, anything storage still calls running is marked interrupted so a
// PlanMyPeak page polling it is told to retry rather than left waiting.
void recoverInterruptedOperations();
// Started now; the capture and PlanMyPeak-auth handlers await the same promise,
// so it finishes inside a tracked event even if nothing else keeps us alive.
void resumeCaptureCoachEnrichment();

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  logDebug('📦 Extension installed/updated, reason:', details.reason);
  // Badge text does not survive a restart or reload; recompute it from
  // stored state (export progress, pending captured workouts).
  void refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  logDebug('🔁 Browser started');
  void refreshBadge();
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logDebug('📨 Message received:', {
    type: message?.type,
    from: sender.tab ? `tab ${sender.tab.id}` : 'popup',
    url: sender.tab?.url || sender.url,
  });

  // Handle message asynchronously
  handleMessage(message, sender)
    .then((response) => {
      logDebug('✅ Message handled successfully, response:', response);
      sendResponse(response);
    })
    .catch((error) => {
      logDebug('❌ Error handling message:', error);
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll send a response asynchronously
  return true;
});

export {};

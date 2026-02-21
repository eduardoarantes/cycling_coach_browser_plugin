/**
 * Background service worker entry point
 *
 * Handles messages from content scripts and popup UI
 *
 * DEBUG MODE: Enhanced logging to troubleshoot message handling
 */

import { handleMessage } from './messageHandler';

const DEBUG = true;
const logDebug = (...args: unknown[]): void => {
  if (DEBUG) {
    console.log('[TP Extension - Background]', ...args);
  }
};

logDebug('🚀 Background service worker loaded');
console.log('TrainingPeaks Extension: Background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  logDebug('📦 Extension installed/updated, reason:', details.reason);
  console.log('TrainingPeaks Extension installed');
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

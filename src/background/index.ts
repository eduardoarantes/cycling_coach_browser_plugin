/**
 * Background service worker entry point
 *
 * Handles messages from content scripts and popup UI
 */

import { handleMessage } from './messageHandler';

console.log('TrainingPeaks Extension: Background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('TrainingPeaks Extension installed');
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message asynchronously
  handleMessage(message, sender)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll send a response asynchronously
  return true;
});

export {};

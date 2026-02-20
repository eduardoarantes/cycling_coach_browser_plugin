// Background service worker entry point
console.log('TrainingPeaks Extension: Background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('TrainingPeaks Extension installed');
});

export {};

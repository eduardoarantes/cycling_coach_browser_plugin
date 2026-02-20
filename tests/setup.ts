/**
 * Vitest setup file
 *
 * Mocks Chrome extension APIs for testing
 */

import { vi } from 'vitest';

// Create a storage map to simulate chrome.storage.local
const storageMap = new Map<string, unknown>();

// Mock chrome.storage.local
const mockStorage = {
  get: vi.fn((keys: string | string[]) => {
    if (typeof keys === 'string') {
      return Promise.resolve({ [keys]: storageMap.get(keys) });
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      keys.forEach((key) => {
        const value = storageMap.get(key);
        if (value !== undefined) {
          result[key] = value;
        }
      });
      return Promise.resolve(result);
    }
    return Promise.resolve({});
  }),

  set: vi.fn((items: Record<string, unknown>) => {
    Object.entries(items).forEach(([key, value]) => {
      storageMap.set(key, value);
    });
    return Promise.resolve();
  }),

  remove: vi.fn((keys: string | string[]) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach((key) => storageMap.delete(key));
    return Promise.resolve();
  }),

  clear: vi.fn(() => {
    storageMap.clear();
    return Promise.resolve();
  }),
};

// Mock chrome.runtime
const mockRuntime = {
  sendMessage: vi.fn(() => Promise.resolve({ success: true })),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Set up global chrome object
global.chrome = {
  storage: {
    local: mockStorage,
  },
  runtime: mockRuntime,
} as never;

// Clear storage before each test
beforeEach(() => {
  storageMap.clear();
  vi.clearAllMocks();
});

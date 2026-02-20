/**
 * Logging utility
 *
 * Provides structured logging that respects environment mode
 */

import { EXTENSION_NAME } from './constants';

const isDev = import.meta.env.DEV;

/**
 * Logger instance for the extension
 */
export const logger = {
  /**
   * Log informational messages (development only)
   */
  info: (message: string, ...args: unknown[]): void => {
    if (isDev) {
      console.log(`[${EXTENSION_NAME}] ${message}`, ...args);
    }
  },

  /**
   * Log error messages (always logged)
   */
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[${EXTENSION_NAME} ERROR] ${message}`, ...args);
  },

  /**
   * Log warning messages (development only)
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (isDev) {
      console.warn(`[${EXTENSION_NAME} WARN] ${message}`, ...args);
    }
  },

  /**
   * Log debug messages (development only)
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDev) {
      console.debug(`[${EXTENSION_NAME} DEBUG] ${message}`, ...args);
    }
  },
};

/**
 * Type definitions for the extension
 */

/**
 * Message types for chrome.runtime messaging
 */
export interface TokenFoundMessage {
  type: 'TOKEN_FOUND';
  token: string;
  timestamp: number;
}

export interface GetTokenMessage {
  type: 'GET_TOKEN';
}

export interface ClearTokenMessage {
  type: 'CLEAR_TOKEN';
}

export type RuntimeMessage =
  | TokenFoundMessage
  | GetTokenMessage
  | ClearTokenMessage;

/**
 * Token storage structure
 */
export interface TokenStorage {
  auth_token: string | null;
  token_timestamp: number | null;
}

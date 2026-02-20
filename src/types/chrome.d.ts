/**
 * Type augmentation for chrome.runtime.sendMessage
 * Enables type-safe message passing with generics
 *
 * This augmentation allows us to specify the message type being sent
 * and the expected response type, providing full type safety for
 * communication between the popup and background worker.
 *
 * @example
 * ```typescript
 * // Type-safe message passing
 * const response = await chrome.runtime.sendMessage<
 *   GetUserMessage,
 *   ApiResponse<UserProfile>
 * >({ type: 'GET_USER' });
 *
 * // TypeScript knows response is ApiResponse<UserProfile>
 * if (response.success) {
 *   console.log(response.data.userId); // ✅ Type-safe
 * }
 * ```
 */

declare namespace chrome.runtime {
  /**
   * Send a message to the background worker with type safety
   * @template TMessage - The message type being sent
   * @template TResponse - The expected response type
   * @param message - The message object to send
   * @returns Promise that resolves with the typed response
   */
  function sendMessage<TMessage = unknown, TResponse = unknown>(
    message: TMessage
  ): Promise<TResponse>;

  /**
   * Send a message to a specific extension with type safety
   * @template TMessage - The message type being sent
   * @template TResponse - The expected response type
   * @param extensionId - The ID of the extension to send the message to
   * @param message - The message object to send
   * @returns Promise that resolves with the typed response
   */
  function sendMessage<TMessage = unknown, TResponse = unknown>(
    extensionId: string,
    message: TMessage
  ): Promise<TResponse>;

  /**
   * Send a message with a callback (legacy callback-based API)
   * @template TMessage - The message type being sent
   * @template TResponse - The expected response type
   * @param message - The message object to send
   * @param responseCallback - Callback invoked with the typed response
   */
  function sendMessage<TMessage = unknown, TResponse = unknown>(
    message: TMessage,
    responseCallback: (response: TResponse) => void
  ): void;

  /**
   * Send a message to a specific extension with a callback
   * @template TMessage - The message type being sent
   * @template TResponse - The expected response type
   * @param extensionId - The ID of the extension to send the message to
   * @param message - The message object to send
   * @param responseCallback - Callback invoked with the typed response
   */
  function sendMessage<TMessage = unknown, TResponse = unknown>(
    extensionId: string,
    message: TMessage,
    responseCallback: (response: TResponse) => void
  ): void;
}

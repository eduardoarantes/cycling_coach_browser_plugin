/**
 * cURL Command Generator Utility
 *
 * Generates cURL commands from fetch request parameters for debugging
 * and testing API calls in Postman or command line
 */

/**
 * Generate a cURL command from fetch request parameters
 *
 * @param url - Request URL
 * @param options - Fetch options (method, headers, body)
 * @returns Formatted cURL command string
 */
export function generateCurlCommand(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): string {
  const { method = 'GET', headers = {}, body } = options;

  // Start with base curl command
  const curlParts: string[] = ['curl'];

  // Add method
  if (method !== 'GET') {
    curlParts.push(`-X ${method}`);
  }

  // Add headers
  const headersObj =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : (headers as Record<string, string>);

  Object.entries(headersObj).forEach(([key, value]) => {
    curlParts.push(`-H "${key}: ${value}"`);
  });

  // Add body
  if (body) {
    const bodyString =
      typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    // Escape single quotes in body for shell safety
    const escapedBody = bodyString.replace(/'/g, "'\\''");
    curlParts.push(`-d '${escapedBody}'`);
  }

  // Add URL (quoted for safety)
  curlParts.push(`"${url}"`);

  // Join with line continuations for readability
  return curlParts.join(' \\\n  ');
}

/**
 * Format cURL command for console output with syntax highlighting
 *
 * @param curlCommand - The cURL command string
 * @returns Formatted command with console styling
 */
export function formatCurlForConsole(curlCommand: string): string {
  return `
╭─────────────────────────────────────────────────────────╮
│  cURL Command (Copy to Postman/Terminal)                │
╰─────────────────────────────────────────────────────────╯

${curlCommand}

`;
}

/**
 * Copy text to clipboard (works in extension context)
 *
 * @param text - Text to copy
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Clipboard access denied');
  }
}

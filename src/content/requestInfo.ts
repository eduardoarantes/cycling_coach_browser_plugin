/**
 * Pure helper to extract the URL and headers from fetch() arguments,
 * regardless of how the caller passed them.
 *
 * Extracted from the main-world interceptor so it can be unit tested without
 * triggering the interceptor's fetch/XHR patching side effects.
 *
 * Handles every fetch call shape:
 *  - fetch(urlString, init)
 *  - fetch(URL, init)
 *  - fetch(Request)            ← headers live on the Request, not on init
 *  - fetch(Request, init)      ← init.headers override/augment the Request's
 *
 * The Request-object form is the important one: apps (and fetch wrappers)
 * frequently build a Request, so the `Authorization` header is on the Request
 * itself. Reading only `init.headers` would miss it entirely.
 */
export function extractRequestInfo(
  input: RequestInfo | URL,
  init?: RequestInit
): { urlStr: string; headers: Headers } {
  let urlStr = '';
  let headers = new Headers();

  if (typeof Request !== 'undefined' && input instanceof Request) {
    urlStr = input.url;
    headers = new Headers(input.headers);
  } else {
    urlStr = typeof input === 'string' ? input : input.toString();
  }

  // init.headers (when provided) augments/overrides the Request's headers.
  if (init && init.headers) {
    const initHeaders = new Headers(init.headers);
    initHeaders.forEach((value, key) => headers.set(key, value));
  }

  return { urlStr, headers };
}

/**
 * Resolve a possibly-relative request URL to an absolute URL against `base`.
 *
 * Apps call `fetch('/api/backend/...')` with a relative URL, which has no host —
 * so host-based detection would miss it. Resolving against the page origin
 * (`document.baseURI`) yields e.g. `https://portal.planmypeak.com/api/backend/...`
 * so host matching works. Returns the input unchanged if it cannot be parsed.
 */
export function toAbsoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

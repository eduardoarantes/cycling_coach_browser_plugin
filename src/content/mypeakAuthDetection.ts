/**
 * Pure detection helpers for PlanMyPeak auth-bearing requests.
 *
 * Extracted from the main-world interceptor so the URL matching logic can be
 * unit tested without triggering the interceptor's fetch/XHR patching side
 * effects.
 */

/**
 * Known Supabase hosts for PlanMyPeak auth detection.
 * Includes the production cloud Supabase project and common local development ports.
 */
export const MYPEAK_SUPABASE_HOSTS = [
  '127.0.0.1:54361',
  'localhost:54361',
  '127.0.0.1:54341',
  'localhost:54341',
  'nwvtltfibnkdogdeeluh.supabase.co',
];

/**
 * PlanMyPeak origins that carry the user's Supabase access token as a Bearer
 * header on API requests (e.g. `portal.planmypeak.com/api/backend/*`).
 * Capturing here ensures the user token is detected even though app data calls
 * do not go through Supabase directly.
 */
export const MYPEAK_APP_HOSTS = ['portal.planmypeak.com'];

/**
 * Check if a URL is a PlanMyPeak auth-bearing request.
 * Matches the Supabase project hosts, the PlanMyPeak portal app origin, and any
 * localhost Supabase auth endpoint (for local development).
 */
export function isMyPeakSupabaseRequest(url: string): boolean {
  // Check known Supabase project hosts first
  if (MYPEAK_SUPABASE_HOSTS.some((host) => url.includes(host))) {
    return true;
  }

  // PlanMyPeak portal API requests carry the user access token as a Bearer header
  if (MYPEAK_APP_HOSTS.some((host) => url.includes(host))) {
    return true;
  }

  // Also detect any localhost/127.0.0.1 Supabase auth endpoints
  // This allows flexible port configuration in local development
  const isLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
  const isSupabaseAuthPath =
    url.includes('/auth/v1/') || url.includes('/rest/v1/');

  return isLocalhost && isSupabaseAuthPath;
}

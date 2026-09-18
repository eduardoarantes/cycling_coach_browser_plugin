/**
 * PlanMyPeak authentication failure codes.
 *
 * UI-free and dependency-free so the background API client, the export
 * adapter and the popup classify a failure the same way.
 */

/** Codes the API client sets when a request failed for authentication. */
export type PlanMyPeakAuthErrorCode =
  | 'NO_TOKEN'
  | 'UNAUTHORIZED'
  | 'ENVIRONMENT_MISMATCH';

/** Why an export could not authenticate. */
export type PlanMyPeakAuthFailure = {
  reason: 'sign_in_required' | 'environment_mismatch';
};

const AUTH_ERROR_CODES: ReadonlySet<string> = new Set<PlanMyPeakAuthErrorCode>([
  'NO_TOKEN',
  'UNAUTHORIZED',
  'ENVIRONMENT_MISMATCH',
]);

export function isPlanMyPeakAuthErrorCode(
  code: string | null | undefined
): code is PlanMyPeakAuthErrorCode {
  return typeof code === 'string' && AUTH_ERROR_CODES.has(code);
}

/** The structured failure for an auth error code, or null for any other code. */
export function planMyPeakAuthFailureFromCode(
  code: string | null | undefined
): PlanMyPeakAuthFailure | null {
  if (!isPlanMyPeakAuthErrorCode(code)) {
    return null;
  }

  return {
    reason:
      code === 'ENVIRONMENT_MISMATCH'
        ? 'environment_mismatch'
        : 'sign_in_required',
  };
}

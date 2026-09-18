/**
 * PlanMyPeak duplicate-library preflight
 *
 * UI-free lookup shared by the popup export dialog and the in-page import
 * overlay, so `Replace` / `Append` / `Ignore Upload` cannot mean different
 * things on the two surfaces.
 */

import type { GetPlanMyPeakLibrariesMessage } from '@/types';
import type { ApiResponse } from '@/types/api.types';
import type { PlanMyPeakLibrary } from '@/schemas/planMyPeakApi.schema';
import {
  planMyPeakAuthFailureFromCode,
  type PlanMyPeakAuthFailure,
} from '@/utils/planMyPeakAuthErrors';
import { authRunField } from './transport';

/**
 * What the coach chose when a destination container already exists.
 * `ignore` cancels the upload entirely.
 */
export type PlanMyPeakDuplicateAction = 'replace' | 'append' | 'ignore';

export type PlanMyPeakDuplicateCheckResult =
  | { ok: true; conflicts: PlanMyPeakLibrary[] }
  | {
      ok: false;
      message: string;
      /**
       * Set when the check failed because the credential could not be used or
       * recovered, so a surface can offer sign-in rather than a generic error.
       */
      authFailure?: PlanMyPeakAuthFailure;
    };

/**
 * Trim, drop empties, and de-duplicate a set of candidate library names.
 */
export function normalizeTargetLibraryNames(
  names: ReadonlyArray<string | null | undefined>
): string[] {
  return Array.from(
    new Set(
      names.map((name) => name?.trim() ?? '').filter((name) => name.length > 0)
    )
  );
}

/**
 * Find the coach's existing PlanMyPeak libraries that collide with the target
 * names.
 *
 * Matching is case-insensitive on the trimmed name, and system libraries are
 * excluded because the coach cannot replace them.
 */
export async function findExistingPlanMyPeakLibraries(
  targetNames: ReadonlyArray<string>,
  options: { authRunId?: string } = {}
): Promise<PlanMyPeakDuplicateCheckResult> {
  if (targetNames.length === 0) {
    return { ok: true, conflicts: [] };
  }

  const response = await chrome.runtime.sendMessage<
    GetPlanMyPeakLibrariesMessage,
    ApiResponse<PlanMyPeakLibrary[]>
  >({
    type: 'GET_PLANMYPEAK_LIBRARIES',
    // The preflight is the export's first request, so it is where recovery
    // has to be able to happen: when it fails, the export never starts.
    ...authRunField(options.authRunId),
  });

  if (!response.success) {
    const authFailure = planMyPeakAuthFailureFromCode(response.error.code);
    return {
      ok: false,
      message:
        response.error.message ||
        'Failed to check existing PlanMyPeak libraries',
      ...(authFailure ? { authFailure } : {}),
    };
  }

  // Every library belongs to the coach now — there is no system-owned kind to
  // exclude — so a name collision against any of them is a real collision.
  const conflicts: PlanMyPeakLibrary[] = [];

  for (const targetName of targetNames) {
    const existing = response.data.find(
      (library) =>
        library.name.trim().toLowerCase() === targetName.toLowerCase()
    );
    if (existing) {
      conflicts.push(existing);
    }
  }

  return { ok: true, conflicts };
}

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

/**
 * What the coach chose when a destination container already exists.
 * `ignore` cancels the upload entirely.
 */
export type PlanMyPeakDuplicateAction = 'replace' | 'append' | 'ignore';

export type PlanMyPeakDuplicateCheckResult =
  | { ok: true; conflicts: PlanMyPeakLibrary[] }
  | { ok: false; message: string };

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
  targetNames: ReadonlyArray<string>
): Promise<PlanMyPeakDuplicateCheckResult> {
  if (targetNames.length === 0) {
    return { ok: true, conflicts: [] };
  }

  const response = await chrome.runtime.sendMessage<
    GetPlanMyPeakLibrariesMessage,
    ApiResponse<PlanMyPeakLibrary[]>
  >({ type: 'GET_PLANMYPEAK_LIBRARIES' });

  if (!response.success) {
    return {
      ok: false,
      message:
        response.error.message ||
        'Failed to check existing PlanMyPeak libraries',
    };
  }

  const userLibraries = response.data.filter((library) => !library.is_system);
  const conflicts: PlanMyPeakLibrary[] = [];

  for (const targetName of targetNames) {
    const existing = userLibraries.find(
      (library) =>
        library.name.trim().toLowerCase() === targetName.toLowerCase()
    );
    if (existing) {
      conflicts.push(existing);
    }
  }

  return { ok: true, conflicts };
}

/**
 * Duplicate destination warning.
 *
 * Mirrors the export dialog's amber panel and its button order
 * (Replace / Append / Ignore Upload) so the two surfaces cannot drift.
 */

import type { ReactElement } from 'react';
import type { PlanMyPeakLibrary } from '@/schemas/planMyPeakApi.schema';
import type { PlanMyPeakDuplicateAction } from '@/export/adapters/planMyPeak/duplicatePreflight';

export interface DuplicatePanelProps {
  conflicts: PlanMyPeakLibrary[];
  isBusy: boolean;
  onAction: (action: PlanMyPeakDuplicateAction) => void;
}

export function DuplicatePanel({
  conflicts,
  isBusy,
  onAction,
}: DuplicatePanelProps): ReactElement {
  const isBatch = conflicts.length > 1;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">
        {isBatch
          ? `${conflicts.length} PlanMyPeak libraries already exist with these names`
          : 'A PlanMyPeak library already exists with this name'}
      </p>
      <ul className="mt-1 list-disc pl-5 text-xs">
        {conflicts.map((library) => (
          <li key={library.id}>{library.name}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        {isBatch
          ? 'Choose how to handle all duplicates in this batch:'
          : 'Choose how to handle this duplicate:'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onAction('replace')}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBatch ? 'Replace Existing Libraries' : 'Replace Existing Library'}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onAction('append')}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBatch
            ? 'Append to Existing Libraries (may duplicate workouts)'
            : 'Append to Existing Library (may duplicate workouts)'}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onAction('ignore')}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Ignore Upload
        </button>
      </div>
    </div>
  );
}

/**
 * NoteCard component
 *
 * Displays a calendar note with title and description
 */

import type { ReactElement } from 'react';
import type { CalendarNote } from '@/types/api.types';

export interface NoteCardProps {
  note: CalendarNote;
}

export function NoteCard({ note }: NoteCardProps): ReactElement {
  return (
    <div
      aria-label={`Note: ${note.title}`}
      className="p-2 bg-yellow-50 rounded-md border border-yellow-200"
    >
      <div className="flex items-start space-x-2">
        <span className="text-base flex-shrink-0" role="img" aria-label="note">
          📝
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-900 truncate">
            {note.title}
          </p>
          {note.description && (
            <p className="text-xs text-yellow-700 mt-1 line-clamp-2">
              {note.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

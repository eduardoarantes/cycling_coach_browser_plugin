import type { ReactElement } from 'react';
import type { Library } from '@/types/api.types';

export interface LibraryCardProps {
  library: Library;
  onClick: (libraryId: number) => void;
}

export function LibraryCard({
  library,
  onClick,
}: LibraryCardProps): ReactElement {
  return (
    <button
      onClick={() => onClick(library.exerciseLibraryId)}
      className="w-full p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left"
    >
      <h3 className="text-base font-semibold text-gray-900 truncate">
        {library.libraryName}
      </h3>
      <p className="text-sm text-gray-600 mt-1">by {library.ownerName}</p>
    </button>
  );
}

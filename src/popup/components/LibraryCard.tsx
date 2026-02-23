import type { ReactElement } from 'react';
import type { Library } from '@/types/api.types';

export interface LibraryCardProps {
  library: Library;
  onClick: (libraryId: number) => void;
  /** Whether selection mode is enabled */
  selectionMode?: boolean;
  /** Whether this library is selected */
  isSelected?: boolean;
  /** Callback when library selection changes */
  onSelectionChange?: (libraryId: number, selected: boolean) => void;
}

export function LibraryCard({
  library,
  onClick,
  selectionMode = false,
  isSelected = false,
  onSelectionChange,
}: LibraryCardProps): ReactElement {
  const handleClick = (): void => {
    if (selectionMode && onSelectionChange) {
      onSelectionChange(library.exerciseLibraryId, !isSelected);
    } else {
      onClick(library.exerciseLibraryId);
    }
  };

  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(library.exerciseLibraryId, e.target.checked);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={`View ${library.libraryName} library by ${library.ownerName}`}
      className={`w-full p-4 bg-white rounded-lg border transition-all text-left ${
        selectionMode && isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            aria-label={`Select ${library.libraryName}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {library.libraryName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">by {library.ownerName}</p>
        </div>
      </div>
    </button>
  );
}

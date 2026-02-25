/**
 * Export Button Component
 *
 * Triggers the export dialog for library or workout export
 */
import type { ReactElement } from 'react';

interface ExportButtonProps {
  /** Callback when export button is clicked */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Number of items to export (for display) */
  itemCount?: number;
  /** Button variant */
  variant?: 'primary' | 'secondary';
  /** Full width button */
  fullWidth?: boolean;
  /** Custom button label */
  label?: string;
  /** Optional title tooltip */
  title?: string;
}

export function ExportButton({
  onClick,
  disabled = false,
  itemCount,
  variant = 'secondary',
  fullWidth = false,
  label = 'Export Workouts',
  title,
}: ExportButtonProps): ReactElement {
  const baseClasses =
    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md',
    secondary:
      'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 active:bg-blue-100',
  };

  const widthClass = fullWidth ? 'w-full justify-center' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass}`}
      aria-label={
        itemCount && label === 'Export Workouts'
          ? `Export ${itemCount} workout${itemCount !== 1 ? 's' : ''}`
          : label
      }
    >
      {/* Export icon */}
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 17L17 7m0 0H9m8 0v8M7 7h4M5 11v8a1 1 0 001 1h8"
        />
      </svg>

      <span>
        {label}
        {itemCount !== undefined && itemCount > 0 && (
          <span className="ml-1 opacity-80">({itemCount})</span>
        )}
      </span>
    </button>
  );
}

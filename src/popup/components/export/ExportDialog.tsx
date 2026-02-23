/**
 * Export Dialog Component
 *
 * Modal dialog for configuring and executing workout export
 */
import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { PlanMyPeakExportConfig } from '@/types/planMyPeak.types';
import {
  EXPORT_DESTINATIONS,
  type ExportDestination,
} from '@/types/export.types';

interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when export is confirmed */
  onExport: (config: PlanMyPeakExportConfig) => void;
  /** Number of items to be exported */
  itemCount: number;
  /** Whether export is in progress */
  isExporting?: boolean;
}

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  itemCount,
  isExporting = false,
}: ExportDialogProps): ReactElement | null {
  const [fileName, setFileName] = useState('planmypeak_export');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [destination, setDestination] =
    useState<ExportDestination>('planmypeak');

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setHasAcknowledged(false);
      setDestination('planmypeak');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedDestination = EXPORT_DESTINATIONS.find(
    (d) => d.id === destination
  );

  const handleExport = (): void => {
    const config: PlanMyPeakExportConfig = {
      fileName,
      includeMetadata: true,
    };
    onExport(config);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Export Workouts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Exporting {itemCount} workout{itemCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Destination Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Destination
            </label>
            <div className="space-y-2">
              {EXPORT_DESTINATIONS.map((dest) => (
                <label
                  key={dest.id}
                  className={`flex items-start gap-3 p-3 border rounded-md transition-colors ${
                    dest.available
                      ? 'cursor-pointer hover:bg-gray-50'
                      : 'cursor-not-allowed bg-gray-50 opacity-60'
                  } ${
                    destination === dest.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="destination"
                    value={dest.id}
                    checked={destination === dest.id}
                    onChange={(e) =>
                      setDestination(e.target.value as ExportDestination)
                    }
                    disabled={!dest.available}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {dest.name}
                      </p>
                      {!dest.available && (
                        <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {dest.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* File Name */}
          <div>
            <label
              htmlFor="fileName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              File Name
            </label>
            <input
              id="fileName"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="planmypeak_export"
            />
            <p className="mt-1 text-xs text-gray-500">
              File will be saved as {fileName}.json
            </p>
          </div>

          {/* Info Box - PlanMyPeak specific */}
          {destination === 'planmypeak' && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Automatic Classification</p>
                  <p className="text-xs">
                    Each workout will be automatically classified based on its
                    Intensity Factor (IF) and TSS values. Workout type,
                    intensity level, and suitable training phases are determined
                    individually for each workout.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              What will be exported?
            </h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span>
                  All {itemCount} workout{itemCount !== 1 ? 's' : ''} from this
                  library
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span>Workout structure and intervals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span>Training metrics (TSS, IF, duration)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">✓</span>
                <span>Descriptions and coach comments</span>
              </li>
            </ul>
          </div>

          {/* Authorization Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 mb-2">
                  Authorization Required
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcknowledged}
                    onChange={(e) => setHasAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-amber-900">
                    I confirm that I am the owner of this content or have been
                    authorized by the owner to export it
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={
              isExporting ||
              !fileName.trim() ||
              !hasAcknowledged ||
              !selectedDestination?.available
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <span>Export</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

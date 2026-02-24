/**
 * MultiLibraryExportDialog Component
 *
 * Modal dialog for configuring and executing multi-library workout export
 */
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { Library } from '@/types/api.types';
import type {
  MultiLibraryExportConfig,
  ExportStrategy,
} from '@/hooks/useMultiLibraryExport';
import {
  EXPORT_DESTINATIONS,
  type ExportDestination,
} from '@/types/export.types';

interface MultiLibraryExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when export is confirmed */
  onExport: (config: MultiLibraryExportConfig) => void;
  /** Libraries to be exported */
  libraries: Library[];
  /** Whether export is in progress */
  isExporting?: boolean;
  /** Export progress (0-100) */
  progress?: number;
  /** Current status message */
  statusMessage?: string;
}

export function MultiLibraryExportDialog({
  isOpen,
  onClose,
  onExport,
  libraries,
  isExporting = false,
  progress = 0,
  statusMessage = '',
}: MultiLibraryExportDialogProps): ReactElement | null {
  const [fileName, setFileName] = useState('combined_export');
  const [strategy, setStrategy] = useState<ExportStrategy>('separate');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [destination, setDestination] =
    useState<ExportDestination>('planmypeak');

  // Calculate total workout count (if available)
  // Note: Library type doesn't include itemCount, so we estimate
  const libraryCount = libraries.length;

  // Note: Dialog state is reset via key prop in parent component
  // This approach is more React-idiomatic than setState in useEffect

  if (!isOpen) return null;

  const selectedDestination = EXPORT_DESTINATIONS.find(
    (d) => d.id === destination
  );

  const handleExport = (): void => {
    const config: MultiLibraryExportConfig = {
      fileName,
      includeMetadata: true,
      strategy,
    };
    onExport(config);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={isExporting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Export Multiple Libraries
            </h2>
            {!isExporting && (
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
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {libraryCount} {libraryCount === 1 ? 'library' : 'libraries'}{' '}
            selected
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Export in progress */}
          {isExporting ? (
            <div className="py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {statusMessage}
                  </p>
                  <div className="mt-4 w-64 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{progress}%</p>
                </div>
              </div>
            </div>
          ) : (
            <>
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

              {/* Export Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Strategy
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="strategy"
                      value="separate"
                      checked={strategy === 'separate'}
                      onChange={(e) =>
                        setStrategy(e.target.value as ExportStrategy)
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Separate Files
                      </p>
                      <p className="text-xs text-gray-600">
                        One JSON file per library ({libraries.length} files)
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="strategy"
                      value="combined"
                      checked={strategy === 'combined'}
                      onChange={(e) =>
                        setStrategy(e.target.value as ExportStrategy)
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Combined File
                      </p>
                      <p className="text-xs text-gray-600">
                        All workouts in one JSON file
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* File Name */}
              <div>
                <label
                  htmlFor="fileName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {strategy === 'separate' ? 'File Name Prefix' : 'File Name'}
                </label>
                <input
                  id="fileName"
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    strategy === 'separate'
                      ? 'planmypeak_export'
                      : 'combined_export'
                  }
                />
                <p className="mt-1 text-xs text-gray-500">
                  {strategy === 'separate'
                    ? 'Each library will use its name as the filename'
                    : `File will be saved as ${fileName}.json`}
                </p>
              </div>

              {/* Libraries List */}
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200 max-h-40 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Libraries to Export
                </h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  {libraries.map((lib) => (
                    <li
                      key={lib.exerciseLibraryId}
                      className="flex items-start gap-2"
                    >
                      <span className="text-blue-600 mt-0.5">✓</span>
                      <span>{lib.libraryName}</span>
                    </li>
                  ))}
                </ul>
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
                      <p className="font-medium mb-1">
                        Automatic Classification
                      </p>
                      <p className="text-xs">
                        Each workout will be automatically classified based on
                        its Intensity Factor (IF) and TSS values.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                        I confirm that I am the owner of this content or have
                        been authorized by the owner to export it
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isExporting && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={
                !fileName.trim() ||
                !hasAcknowledged ||
                !selectedDestination?.available
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

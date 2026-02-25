import type { ReactElement } from 'react';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';

interface MultiExportResultProps {
  results: ExportResultType[];
  onClose: () => void;
}

function downloadResultFile(result: ExportResultType): void {
  if (!result.fileUrl) return;

  const link = document.createElement('a');
  link.href = result.fileUrl;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function MultiExportResult({
  results,
  onClose,
}: MultiExportResultProps): ReactElement {
  const totalLibraries = results.length;
  const successCount = results.filter((result) => result.success).length;
  const failureCount = totalLibraries - successCount;
  const totalWorkouts = results.reduce(
    (sum, result) => sum + result.itemsExported,
    0
  );
  const totalWarnings = results.reduce(
    (sum, result) => sum + result.warnings.length,
    0
  );
  const totalErrors = results.reduce(
    (sum, result) => sum + (result.errors?.length || 0),
    0
  );

  const allSuccessful = failureCount === 0;
  const partialSuccess = successCount > 0 && failureCount > 0;

  return (
    <div className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {allSuccessful ? (
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  partialSuccess ? 'bg-yellow-100' : 'bg-red-100'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    partialSuccess ? 'text-yellow-700' : 'text-red-600'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {partialSuccess ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  )}
                </svg>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {allSuccessful
                  ? 'Export Successful'
                  : partialSuccess
                    ? 'Export Completed with Issues'
                    : 'Export Failed'}
              </h2>
              <p className="text-sm text-gray-600">
                {totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''} exported
                {' across '}
                {totalLibraries} librar{totalLibraries !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500">Libraries</p>
              <p className="text-sm font-semibold text-gray-900">
                {totalLibraries}
              </p>
            </div>
            <div className="bg-green-50 rounded-md p-3">
              <p className="text-xs text-green-700">Successful</p>
              <p className="text-sm font-semibold text-green-800">
                {successCount}
              </p>
            </div>
            <div className="bg-red-50 rounded-md p-3">
              <p className="text-xs text-red-700">Failed</p>
              <p className="text-sm font-semibold text-red-800">
                {failureCount}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-md p-3">
              <p className="text-xs text-yellow-700">Warnings</p>
              <p className="text-sm font-semibold text-yellow-800">
                {totalWarnings}
              </p>
            </div>
          </div>

          {totalErrors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm font-medium text-red-800">
                {totalErrors} export error{totalErrors !== 1 ? 's' : ''} across
                batch
              </p>
            </div>
          )}

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-800">
                Library Results
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {results.map((result, index) => {
                const warningCount = result.warnings.length;
                const errorCount = result.errors?.length || 0;

                return (
                  <div
                    key={`${result.fileName}-${index}`}
                    className="px-4 py-3 flex items-start gap-3"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {result.success ? (
                        <svg
                          className="w-5 h-5 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-red-600"
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
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.fileName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {result.itemsExported} workout
                        {result.itemsExported !== 1 ? 's' : ''} •{' '}
                        {result.format.toUpperCase()}
                        {warningCount > 0 &&
                          ` • ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
                        {errorCount > 0 &&
                          ` • ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                      </p>
                      {errorCount > 0 && (
                        <p className="mt-1 text-xs text-red-600 line-clamp-2">
                          {result.errors?.[0]}
                        </p>
                      )}
                    </div>

                    {result.fileUrl && (
                      <button
                        onClick={() => downloadResultFile(result)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        Download
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

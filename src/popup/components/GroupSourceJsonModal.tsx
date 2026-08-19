/**
 * GroupSourceJsonModal component
 *
 * Displays the raw TrainingPeaks athlete-groups (`/coaches/{id}/tags`) response
 * that generated the athlete group import screen. This is the single source
 * payload for the whole screen, shown pretty-printed with copy/download actions.
 *
 * Reuses the shared modal shell pattern from IntegrationHelpModal.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Copy as CopyIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
} from 'lucide-react';
import { downloadJsonFile } from '@/utils/downloadJson';
import { logger } from '@/utils/logger';

interface GroupSourceJsonModalProps {
  /** Raw TrainingPeaks response. When null, the modal is closed. */
  raw: unknown;
  onClose: () => void;
}

const DOWNLOAD_FILE_NAME = 'athlete-groups-source.json';

export function GroupSourceJsonModal({
  raw,
  onClose,
}: GroupSourceJsonModalProps): ReactElement | null {
  const [copied, setCopied] = useState(false);

  // Pretty-print once per payload rather than on every render.
  const jsonString = useMemo(() => JSON.stringify(raw, null, 2), [raw]);

  // Close on Escape.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset the copied confirmation shortly after it is shown.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (raw === undefined || raw === null) {
    return null;
  }

  const handleCopy = async (): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) {
        logger.warn('Clipboard API unavailable; cannot copy source JSON');
        return;
      }
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
    } catch (error) {
      logger.error('Failed to copy source JSON to clipboard:', error);
    }
  };

  const handleDownload = (): void => {
    downloadJsonFile(raw, DOWNLOAD_FILE_NAME);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-3 py-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Source JSON
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              The raw TrainingPeaks response that generated this screen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close source JSON"
            title="Close"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {copied ? (
              <CheckIcon
                className="h-3.5 w-3.5 text-green-600"
                aria-hidden="true"
              />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto bg-slate-50 px-4 py-3"
          style={{ scrollbarGutter: 'stable' }}
        >
          <pre className="whitespace-pre text-[11px] leading-4 text-slate-800">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
}

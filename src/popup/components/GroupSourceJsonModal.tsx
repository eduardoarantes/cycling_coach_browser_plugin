/**
 * GroupSourceJsonModal component
 *
 * Displays the raw TrainingPeaks athlete-groups (`/coaches/{id}/tags`) response
 * that generated the athlete group import screen. This is the single source
 * payload for the whole screen, shown pretty-printed with copy/download actions.
 *
 * Reuses the shared modal shell pattern from IntegrationHelpModal.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
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
const TITLE_ID = 'group-source-json-title';

/** Elements that can receive focus inside the dialog, for the focus trap. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function GroupSourceJsonModal({
  raw,
  onClose,
}: GroupSourceJsonModalProps): ReactElement | null {
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Whether the current drag started on the backdrop itself. A text selection
  // begun inside the JSON and released over the backdrop dispatches its click
  // on their common ancestor (the backdrop), which would otherwise close the
  // modal and discard the selection it exists to let users make.
  const backdropMouseDownRef = useRef(false);

  const isOpen = raw !== undefined && raw !== null;

  // Pretty-print once per payload rather than on every render.
  const jsonString = useMemo(() => JSON.stringify(raw, null, 2), [raw]);

  // Move focus into the dialog on open, and return it to the group screen on close.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Close on Escape, and keep Tab cycling within the dialog while it is open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const atEdge = event.shiftKey ? active === first : active === last;

      if (
        atEdge ||
        !(active instanceof HTMLElement) ||
        !dialog.contains(active)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset the copied confirmation shortly after it is shown.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!isOpen) {
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
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Only a click that both started and ended on the backdrop dismisses.
        if (event.target !== event.currentTarget) return;
        if (!backdropMouseDownRef.current) return;
        backdropMouseDownRef.current = false;
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h3 id={TITLE_ID} className="text-sm font-semibold text-slate-900">
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

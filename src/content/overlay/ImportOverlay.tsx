/**
 * The import overlay the coach interacts with on a PlanMyPeak page.
 *
 * Rendered inside a shadow root by `mount.tsx`, so it owns only its own DOM and
 * leaves the host page untouched when it closes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { usePlanMyPeakAccountMatch } from '@/hooks/usePlanMyPeakAccountMatch';
import { getTrainingPeaksAppUrl } from '@/services/trainingPeaksConfigService';
import type { Library } from '@/types/api.types';
import type { LibraryItem } from '@/schemas/library.schema';
import type { TrainingPlan } from '@/schemas/trainingPlan.schema';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';
import type { SiteControlImportCompletedPayload } from '@/types/siteControl.types';
import {
  EMPTY_SELECTION,
  isSelectionEmpty,
  summarizeSelection,
  toggleGroup,
  toggleLibrary,
  togglePlan,
  toggleWorkout,
  type OverlaySelection,
} from './selection';
import { useOverlayImport } from './useOverlayImport';
import { ConnectionGate } from './components/ConnectionGate';
import { LibraryBrowser } from './components/LibraryBrowser';
import { PlanBrowser } from './components/PlanBrowser';
import { GroupBrowser } from './components/GroupBrowser';
import { AccountMismatchGate } from './components/AccountMismatchGate';
import { SelectionSummary } from './components/SelectionSummary';
import { DuplicatePanel } from './components/DuplicatePanel';
import { ImportProgress } from './components/ImportProgress';
import { ImportResult } from './components/ImportResult';

type OverlayTab = 'libraries' | 'plans' | 'groups';

/**
 * Tab labels name the kind of container explicitly.
 *
 * Two things in this product are called a library — a workout library holds
 * workouts, a plan library holds plans — so a bare "Libraries" next to
 * "Training Plans" reads as though plans have no libraries.
 *
 * These match the popup's tabs exactly (`TabNavigation`): the overlay and the
 * popup show the same data, so they must not name it differently.
 */
const TABS: ReadonlyArray<{ id: OverlayTab; label: string }> = [
  { id: 'libraries', label: 'Workout Libraries' },
  { id: 'plans', label: 'Plans Library' },
  { id: 'groups', label: 'Athlete Groups' },
];

export interface ImportOverlayProps {
  /** Incremented by the bridge to re-focus an already-open overlay */
  focusNonce: number;
  preselectedLibraryId: number | null;
  preselectedPlanId: number | null;
  /** Open on the athlete-groups tab, as the page asked */
  preselectGroups: boolean;
  onImportCompleted?: (payload: SiteControlImportCompletedPayload) => void;
  onClose: () => void;
}

export function ImportOverlay({
  focusNonce,
  preselectedLibraryId,
  preselectedPlanId,
  preselectGroups,
  onImportCompleted,
  onClose,
}: ImportOverlayProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<OverlayTab>(() => {
    if (preselectGroups) return 'groups';
    return preselectedPlanId !== null ? 'plans' : 'libraries';
  });
  const [selection, setSelection] = useState<OverlaySelection>(EMPTY_SELECTION);
  const [expandedLibraryId, setExpandedLibraryId] = useState<number | null>(
    preselectedLibraryId
  );
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(
    preselectedPlanId
  );
  const [loadedItems, setLoadedItems] = useState<
    ReadonlyMap<number, ReadonlyArray<LibraryItem>>
  >(new Map());

  const {
    isAuthenticated: isTrainingPeaksAuthenticated,
    isLoading: isTrainingPeaksAuthLoading,
    refreshAuth: refreshTrainingPeaksAuth,
  } = useAuth();
  const {
    isAuthenticated: isPlanMyPeakAuthenticated,
    refreshAuth: refreshPlanMyPeakAuth,
  } = useMyPeakAuth();

  const accountMatch = usePlanMyPeakAccountMatch();

  const {
    phase,
    progress,
    outcome,
    conflicts,
    preflightError,
    startImport,
    resolveDuplicates,
    reset,
  } = useOverlayImport(onImportCompleted);

  // Close on Escape, captured at the document level so it works wherever focus
  // currently sits on the host page.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // Move focus into the panel on open, and again whenever the page asks for an
  // already-open overlay to be focused.
  useEffect(() => {
    panelRef.current?.focus();
  }, [focusNonce]);

  const handleItemsLoaded = useCallback(
    (libraryId: number, items: LibraryItem[]): void => {
      setLoadedItems((previous) => {
        if (previous.get(libraryId) === items) return previous;
        const next = new Map(previous);
        next.set(libraryId, items);
        return next;
      });
    },
    []
  );

  const handleToggleLibrary = useCallback((library: Library): void => {
    setSelection((previous) =>
      toggleLibrary(previous, {
        libraryId: library.exerciseLibraryId,
        libraryName: library.libraryName,
      })
    );
  }, []);

  const handleToggleWorkout = useCallback(
    (library: Library, workoutId: number, items: LibraryItem[]): void => {
      setSelection((previous) =>
        toggleWorkout(
          previous,
          {
            libraryId: library.exerciseLibraryId,
            libraryName: library.libraryName,
          },
          workoutId,
          items
        )
      );
    },
    []
  );

  const handleTogglePlan = useCallback((plan: TrainingPlan): void => {
    setSelection((previous) => togglePlan(previous, plan));
  }, []);

  const handleToggleGroup = useCallback((group: AthleteGroup): void => {
    setSelection((previous) => toggleGroup(previous, group));
  }, []);

  const handleOpenTrainingPeaks = useCallback((): void => {
    void (async () => {
      const url = await getTrainingPeaksAppUrl();
      // Content scripts cannot call chrome.tabs, and this runs from a click, so
      // the page's own window.open is the right tool.
      window.open(url, '_blank', 'noopener');
    })();
  }, []);

  const handleRecheck = useCallback((): void => {
    void refreshTrainingPeaksAuth();
    void refreshPlanMyPeakAuth();
  }, [refreshTrainingPeaksAuth, refreshPlanMyPeakAuth]);

  const summary = useMemo(
    () => summarizeSelection(selection, loadedItems),
    [selection, loadedItems]
  );

  // The footer summarises the whole selection, which is what Import acts on.
  // Without a per-tab count, a coach on one tab cannot see that another tab
  // holds a selection — the footer would describe something not on screen.
  const selectedCountByTab: Record<OverlayTab, number> = useMemo(
    () => ({
      libraries: selection.libraries.size,
      plans: selection.plans.size,
      groups: selection.groups.size,
    }),
    [selection]
  );

  const connectionsReady =
    isTrainingPeaksAuthenticated && isPlanMyPeakAuthenticated;
  const isBusy = phase === 'checking' || phase === 'importing';
  // A confirmed account mismatch blocks the import outright: the upload would
  // succeed against the wrong account rather than fail, so there is nothing
  // downstream to catch it.
  const hasAccountMismatch = accountMatch.status === 'mismatch';
  const canImport =
    connectionsReady &&
    !hasAccountMismatch &&
    !isSelectionEmpty(selection) &&
    !isBusy;

  const handleImport = useCallback((): void => {
    void startImport({ selection, loadedItems });
  }, [startImport, selection, loadedItems]);

  const handleDone = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Import from TrainingPeaks"
        className="flex max-h-[85vh] w-[560px] max-w-full flex-col overflow-hidden rounded-xl bg-gray-50 shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              Import from TrainingPeaks
            </h2>
            <p className="text-xs text-gray-600">
              Bring your workout libraries, training plans and athlete groups
              into PlanMyPeak
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close importer"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <ConnectionGate
            isTrainingPeaksAuthenticated={isTrainingPeaksAuthenticated}
            isPlanMyPeakAuthenticated={isPlanMyPeakAuthenticated}
            isChecking={isTrainingPeaksAuthLoading}
            onOpenTrainingPeaks={handleOpenTrainingPeaks}
            onRecheck={handleRecheck}
          />

          <AccountMismatchGate match={accountMatch} />

          {preflightError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {preflightError}
            </div>
          ) : null}

          {phase === 'result' && outcome ? (
            <ImportResult
              outcome={outcome}
              onDone={handleDone}
              onBackToSelection={reset}
            />
          ) : phase === 'importing' && progress ? (
            <ImportProgress progress={progress} />
          ) : (
            <>
              {phase === 'duplicates' ? (
                <DuplicatePanel
                  conflicts={conflicts}
                  isBusy={isBusy}
                  onAction={(action) => void resolveDuplicates(action)}
                />
              ) : null}

              <div className="flex gap-1 border-b border-gray-200">
                {TABS.map((tab) => {
                  const selectedOnTab = selectedCountByTab[tab.id];

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-pressed={activeTab === tab.id}
                      // Import acts on every tab's selection, so a selection
                      // made elsewhere has to be legible from the tab in view.
                      aria-label={
                        selectedOnTab > 0
                          ? `${tab.label}, ${selectedOnTab} selected`
                          : tab.label
                      }
                      className={
                        activeTab === tab.id
                          ? 'border-b-2 border-blue-600 px-3 py-2 text-sm font-medium text-blue-700'
                          : 'px-3 py-2 text-sm text-gray-600 hover:text-gray-800'
                      }
                    >
                      {tab.label}
                      {selectedOnTab > 0 ? (
                        <span
                          aria-hidden="true"
                          className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700"
                        >
                          {selectedOnTab}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'libraries' ? (
                <LibraryBrowser
                  enabled={isTrainingPeaksAuthenticated}
                  preselectedLibraryId={preselectedLibraryId}
                  selection={selection}
                  expandedLibraryId={expandedLibraryId}
                  onExpand={setExpandedLibraryId}
                  onToggleLibrary={handleToggleLibrary}
                  onToggleWorkout={handleToggleWorkout}
                  onItemsLoaded={handleItemsLoaded}
                />
              ) : activeTab === 'plans' ? (
                <PlanBrowser
                  enabled={isTrainingPeaksAuthenticated}
                  preselectedPlanId={preselectedPlanId}
                  selection={selection}
                  expandedPlanId={expandedPlanId}
                  onExpand={setExpandedPlanId}
                  onTogglePlan={handleTogglePlan}
                />
              ) : (
                <GroupBrowser
                  enabled={isTrainingPeaksAuthenticated}
                  selection={selection}
                  onToggleGroup={handleToggleGroup}
                />
              )}
            </>
          )}
        </div>

        {phase === 'result' ? null : (
          <footer className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3">
            <SelectionSummary summary={summary} />
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isBusy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

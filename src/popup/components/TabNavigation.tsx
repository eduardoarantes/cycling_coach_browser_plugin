/**
 * TabNavigation component
 *
 * Provides tab navigation between Workout Libraries, Plans Library, Athlete
 * Groups and New Workouts (workouts captured from the TrainingPeaks calendar).
 */

import type { ReactElement } from 'react';

export type TabType = 'libraries' | 'plans' | 'groups' | 'captured';

export interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  /** Captured workouts awaiting action; shows a dot on New Workouts when > 0 */
  pendingCount?: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  pendingCount = 0,
}: TabNavigationProps): ReactElement {
  const handleTabClick = (tab: TabType): void => {
    // Don't trigger change if clicking on already active tab
    if (tab === activeTab) {
      return;
    }
    onTabChange(tab);
  };

  const getTabClassName = (tab: TabType): string => {
    // Four tabs share the popup's fixed width, so each takes an equal share
    // and shrinks rather than pushing the row past the edge.
    const baseClasses =
      'flex-1 min-w-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors rounded-t-md whitespace-nowrap text-center';
    const activeClasses =
      tab === activeTab
        ? 'border-blue-500 text-blue-600 bg-blue-100'
        : 'border-gray-300 text-gray-600 bg-gray-100 hover:text-gray-900 hover:bg-gray-200';
    // Pending captured workouts outline the tab so the state is visible even
    // when the coach is looking elsewhere in the popup.
    const attentionClasses =
      tab === 'captured' && pendingCount > 0
        ? 'ring-2 ring-inset ring-amber-500'
        : '';

    return `${baseClasses} ${activeClasses} ${attentionClasses}`.trim();
  };

  return (
    <div className="flex w-full gap-1 border-b border-gray-200" role="tablist">
      <button
        role="button"
        aria-selected={activeTab === 'libraries'}
        className={getTabClassName('libraries')}
        onClick={() => handleTabClick('libraries')}
      >
        Workout Libraries
      </button>

      <button
        role="button"
        aria-selected={activeTab === 'plans'}
        className={getTabClassName('plans')}
        onClick={() => handleTabClick('plans')}
      >
        Plans Library
      </button>

      <button
        role="button"
        aria-selected={activeTab === 'groups'}
        className={getTabClassName('groups')}
        onClick={() => handleTabClick('groups')}
      >
        Athlete Groups
      </button>

      <button
        role="button"
        aria-selected={activeTab === 'captured'}
        aria-label={
          pendingCount > 0
            ? `New Workouts, ${pendingCount} pending`
            : 'New Workouts'
        }
        className={`${getTabClassName('captured')} inline-flex items-center justify-center gap-1.5`}
        onClick={() => handleTabClick('captured')}
      >
        New Workouts
        {pendingCount > 0 ? (
          <span
            data-testid="captured-pending-dot"
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full bg-amber-500 ring-2 ring-white"
          />
        ) : null}
      </button>
    </div>
  );
}

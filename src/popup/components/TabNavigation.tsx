/**
 * TabNavigation component
 *
 * Provides tab navigation between Workout Libraries and Training Plans views
 */

import type { ReactElement } from 'react';

export type TabType = 'libraries' | 'plans';

export interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabNavigation({
  activeTab,
  onTabChange,
}: TabNavigationProps): ReactElement {
  const handleTabClick = (tab: TabType): void => {
    // Don't trigger change if clicking on already active tab
    if (tab === activeTab) {
      return;
    }
    onTabChange(tab);
  };

  const getTabClassName = (tab: TabType): string => {
    const baseClasses =
      'px-4 py-2 text-sm font-medium border-b-2 transition-colors rounded-t-md';
    const activeClasses =
      tab === activeTab
        ? 'border-blue-500 text-blue-600 bg-blue-100'
        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50';

    return `${baseClasses} ${activeClasses}`;
  };

  return (
    <div className="flex border-b border-gray-200" role="tablist">
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
        Training Plans
      </button>
    </div>
  );
}

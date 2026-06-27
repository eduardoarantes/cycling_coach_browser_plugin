/**
 * AthleteGroupList component
 *
 * Displays the authenticated coach's athlete groups (TrainingPeaks tags) with
 * the number of athletes in each group. Handles loading, error, empty, and
 * search states consistent with the other list views.
 */

import { useMemo, useState, type ReactElement } from 'react';
import { Users as UsersIcon, Upload as UploadIcon } from 'lucide-react';
import { useAthleteGroups } from '@/hooks/useAthleteGroups';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { usePlanMyPeakGroupImport } from '@/hooks/usePlanMyPeakGroupImport';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import {
  is401Error,
  is403Error,
  getUserFriendlyErrorMessage,
  openTrainingPeaksTab,
} from '@/utils/trainingPeaksTab';

export function AthleteGroupList(): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: groups, isLoading, error, refetch } = useAthleteGroups();
  const { isAuthenticated: isPlanMyPeakConnected } = useMyPeakAuth();
  const importGroups = usePlanMyPeakGroupImport();

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!searchQuery) return groups;

    const query = searchQuery.toLowerCase();
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  const totalAthletes = useMemo(() => {
    if (!groups) return 0;
    return groups.reduce((total, group) => total + group.athleteIds.length, 0);
  }, [groups]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError = is401Error(error);
    const isPermissionError = is403Error(error);
    const friendlyMessage = getUserFriendlyErrorMessage(error);

    const handleRetry = async (): Promise<void> => {
      if (isAuthError) {
        await openTrainingPeaksTab();
      } else {
        refetch();
      }
    };

    return (
      <div className="p-4">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-800">
            Failed to Load Data
          </p>
          <p className="mt-1 text-xs text-red-600">{friendlyMessage}</p>
          {isAuthError && (
            <p className="mt-2 text-xs text-red-500">
              Opening TrainingPeaks to refresh your authentication...
            </p>
          )}
          {isPermissionError && (
            <p className="mt-2 text-xs text-red-500">
              You don't have permission to access this content
            </p>
          )}
          <button
            onClick={handleRetry}
            className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            {isAuthError ? 'Open TrainingPeaks' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no groups at all)
  if (!groups || groups.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="No Athlete Groups Found"
          message="You don't have any athlete groups yet."
        />
      </div>
    );
  }

  // No search results state
  if (filteredGroups.length === 0) {
    return (
      <div className="mt-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search groups..."
        />
        <div className="mt-4">
          <EmptyState
            title="No Athlete Groups Found"
            message={`No groups match "${searchQuery}"`}
          />
        </div>
      </div>
    );
  }

  // Success state with groups
  return (
    <div className="mt-4">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search groups..."
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {groups.length} {groups.length === 1 ? 'group' : 'groups'} ·{' '}
          {totalAthletes} {totalAthletes === 1 ? 'athlete' : 'athletes'}
        </p>

        <button
          type="button"
          onClick={() => importGroups.mutate(groups)}
          disabled={!isPlanMyPeakConnected || importGroups.isPending}
          title={
            isPlanMyPeakConnected
              ? 'Import these groups into PlanMyPeak'
              : 'Connect PlanMyPeak to import groups'
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {importGroups.isPending ? 'Importing…' : 'Import to PlanMyPeak'}
        </button>
      </div>

      {!isPlanMyPeakConnected && (
        <p className="mt-2 text-xs text-amber-600">
          Connect PlanMyPeak to import athlete groups.
        </p>
      )}

      {importGroups.isSuccess && (
        <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">Import complete</p>
          <p className="mt-1 text-xs text-green-700">
            {importGroups.data.groupsProcessed ?? groups.length}{' '}
            {(importGroups.data.groupsProcessed ?? groups.length) === 1
              ? 'group'
              : 'groups'}{' '}
            processed · {importGroups.data.athletesAssociated ?? 0} athletes
            associated
            {importGroups.data.skippedAthleteIds &&
            importGroups.data.skippedAthleteIds.length > 0
              ? ` · ${importGroups.data.skippedAthleteIds.length} skipped`
              : ''}
          </p>
        </div>
      )}

      {importGroups.isError && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">Import failed</p>
          <p className="mt-1 text-xs text-red-600">
            {importGroups.error.message}
          </p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {filteredGroups.map((group) => {
          const athleteCount = group.athleteIds.length;

          return (
            <div
              key={group.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <UsersIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {group.name}
                  </p>
                  {group.isDefault && (
                    <span className="text-xs text-gray-400">Default group</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                {athleteCount} {athleteCount === 1 ? 'athlete' : 'athletes'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

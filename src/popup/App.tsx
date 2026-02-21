import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthStatus } from './components/AuthStatus';
import { UserInfo } from './components/UserInfo';
import { LibraryList } from './components/LibraryList';
import { LibraryDetails } from './components/LibraryDetails';
import { TabNavigation } from './components/TabNavigation';
import { TrainingPlanList } from './components/TrainingPlanList';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useLibraries } from '@/hooks/useLibraries';

function App(): ReactElement {
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'libraries' | 'plans'>(
    'libraries'
  );
  const { isAuthenticated } = useAuth();

  // Only fetch data when authenticated to avoid 401 errors
  const { data: user, isLoading: userLoading } = useUser({
    enabled: isAuthenticated,
  });
  const { data: libraries } = useLibraries({ enabled: isAuthenticated });

  // Find the selected library name
  const selectedLibrary = libraries?.find(
    (lib) => lib.exerciseLibraryId === selectedLibraryId
  );
  const selectedLibraryName = selectedLibrary?.libraryName ?? '';

  const handleBackToLibraries = (): void => {
    setSelectedLibraryId(null);
  };

  const handleTabChange = (tab: 'libraries' | 'plans'): void => {
    setActiveTab(tab);
    // Reset selections when switching tabs
    setSelectedLibraryId(null);
  };

  const handleSelectPlan = (planId: number): void => {
    // TODO: Implement plan detail view in Phase 5 (Calendar Grid)
    console.log('Selected plan:', planId);
  };

  return (
    <div className="w-96 min-h-96 p-4 bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">PlanMyPeak Importer</h1>
        <p className="text-sm text-gray-600">Workout Library Access</p>
      </div>

      <AuthStatus />

      {isAuthenticated && (
        <>
          <UserInfo user={user} isLoading={userLoading} />

          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

          {activeTab === 'libraries' ? (
            selectedLibraryId !== null ? (
              <LibraryDetails
                libraryId={selectedLibraryId}
                libraryName={selectedLibraryName}
                onBack={handleBackToLibraries}
              />
            ) : (
              <LibraryList onSelectLibrary={setSelectedLibraryId} />
            )
          ) : (
            <TrainingPlanList onSelectPlan={handleSelectPlan} />
          )}
        </>
      )}
    </div>
  );
}

export default App;

import type { ReactElement } from 'react';
import { useState } from 'react';
import { ArrowLeft as BackIcon, Settings as SettingsIcon } from 'lucide-react';
import { LibraryList } from './components/LibraryList';
import { LibraryDetails } from './components/LibraryDetails';
import { TabNavigation } from './components/TabNavigation';
import { TrainingPlanList } from './components/TrainingPlanList';
import { PlanCalendar } from './components/PlanCalendar';
import { SettingsPage } from './components/SettingsPage';
import { ConnectionHealthSummary } from './components/ConnectionHealthSummary';
import { useAuth } from '@/hooks/useAuth';
import { useMyPeakAuth } from '@/hooks/useMyPeakAuth';
import { useIntervalsConnection } from '@/hooks/useIntervalsConnection';
import { useConnectionSettings } from '@/hooks/useConnectionSettings';
import { useLibraries } from '@/hooks/useLibraries';

function App(): ReactElement {
  const [activeView, setActiveView] = useState<'main' | 'settings'>('main');
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null
  );
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'libraries' | 'plans'>(
    'libraries'
  );
  const { isAuthenticated: isTrainingPeaksAuthenticated } = useAuth();
  const { isAuthenticated: isPlanMyPeakAuthenticated } = useMyPeakAuth();
  const { isAuthenticated: isIntervalsAuthenticated } =
    useIntervalsConnection();
  const {
    isPlanMyPeakEnabled,
    isIntervalsEnabled,
    setPlanMyPeakEnabled,
    setIntervalsEnabled,
  } = useConnectionSettings();
  const canAccessTrainingPeaksData = isTrainingPeaksAuthenticated;

  // TrainingPeaks data should be visible as soon as TP authentication is ready.
  const { data: libraries } = useLibraries({
    enabled: canAccessTrainingPeaksData,
  });

  // Find the selected library name
  const selectedLibrary = libraries?.find(
    (lib) => lib.exerciseLibraryId === selectedLibraryId
  );
  const selectedLibraryName = selectedLibrary?.libraryName ?? '';

  const handleBackToLibraries = (): void => {
    setSelectedLibraryId(null);
  };

  const handleBackToPlans = (): void => {
    setSelectedPlanId(null);
  };

  const handleTabChange = (tab: 'libraries' | 'plans'): void => {
    setActiveTab(tab);
    // Reset selections when switching tabs
    setSelectedLibraryId(null);
    setSelectedPlanId(null);
  };

  const handleSelectPlan = (planId: number): void => {
    setSelectedPlanId(planId);
  };

  // Use wider layout for calendar view
  const isCalendarView =
    activeView === 'main' && activeTab === 'plans' && selectedPlanId !== null;
  const containerWidth = isCalendarView ? 'w-[750px]' : 'w-96';

  return (
    <div className={`${containerWidth} min-h-96 p-4 bg-gray-50`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            PlanMyPeak Importer
          </h1>
          <p className="text-xs text-gray-600">Workout Library Access</p>
        </div>
        <button
          type="button"
          onClick={() =>
            setActiveView(activeView === 'main' ? 'settings' : 'main')
          }
          aria-label={activeView === 'main' ? 'Open settings' : 'Back to main'}
          title={activeView === 'main' ? 'Settings' : 'Back'}
          className="rounded p-1.5 text-gray-700 hover:bg-gray-100"
        >
          {activeView === 'main' ? (
            <SettingsIcon className="h-7 w-7" aria-hidden="true" />
          ) : (
            <BackIcon className="h-7 w-7" aria-hidden="true" />
          )}
        </button>
      </div>

      {activeView === 'settings' ? (
        <SettingsPage
          isPlanMyPeakEnabled={isPlanMyPeakEnabled}
          isIntervalsEnabled={isIntervalsEnabled}
          onPlanMyPeakEnabledChange={setPlanMyPeakEnabled}
          onIntervalsEnabledChange={setIntervalsEnabled}
        />
      ) : (
        <>
          <ConnectionHealthSummary
            isTrainingPeaksAuthenticated={isTrainingPeaksAuthenticated}
            isPlanMyPeakEnabled={isPlanMyPeakEnabled}
            isPlanMyPeakAuthenticated={isPlanMyPeakAuthenticated}
            isIntervalsEnabled={isIntervalsEnabled}
            isIntervalsAuthenticated={isIntervalsAuthenticated}
          />

          {!canAccessTrainingPeaksData ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              TrainingPeaks authentication is required to load data. Open
              Settings to connect accounts.
            </div>
          ) : null}

          {canAccessTrainingPeaksData ? (
            <>
              <TabNavigation
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />

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
              ) : selectedPlanId !== null ? (
                <PlanCalendar
                  planId={selectedPlanId}
                  onBack={handleBackToPlans}
                />
              ) : (
                <TrainingPlanList onSelectPlan={handleSelectPlan} />
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export default App;

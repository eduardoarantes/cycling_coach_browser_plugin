import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthStatus } from './components/AuthStatus';
import { UserInfo } from './components/UserInfo';
import { LibraryList } from './components/LibraryList';
import { LibraryDetails } from './components/LibraryDetails';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useLibraries } from '@/hooks/useLibraries';

function App(): ReactElement {
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null
  );
  const { isAuthenticated } = useAuth();
  const { data: user, isLoading: userLoading } = useUser();
  const { data: libraries } = useLibraries();

  // Find the selected library name
  const selectedLibrary = libraries?.find(
    (lib) => lib.exerciseLibraryId === selectedLibraryId
  );
  const selectedLibraryName = selectedLibrary?.libraryName ?? '';

  const handleBackToLibraries = (): void => {
    setSelectedLibraryId(null);
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

          {selectedLibraryId !== null ? (
            <LibraryDetails
              libraryId={selectedLibraryId}
              libraryName={selectedLibraryName}
              onBack={handleBackToLibraries}
            />
          ) : (
            <LibraryList onSelectLibrary={setSelectedLibraryId} />
          )}
        </>
      )}
    </div>
  );
}

export default App;

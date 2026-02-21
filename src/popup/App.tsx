import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthStatus } from './components/AuthStatus';
import { UserInfo } from './components/UserInfo';
import { LibraryList } from './components/LibraryList';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

function App(): ReactElement {
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null
  );
  const { isAuthenticated } = useAuth();
  const { data: user, isLoading: userLoading } = useUser();

  return (
    <div className="w-96 min-h-96 p-4 bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">TrainingPeaks</h1>
        <p className="text-sm text-gray-600">Workout Library Access</p>
      </div>

      <AuthStatus />

      {isAuthenticated && (
        <>
          <UserInfo user={user} isLoading={userLoading} />

          {selectedLibraryId !== null ? (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                Library details view will appear here (LibraryDetails component
                - Phase 4.3)
              </p>
              <button
                onClick={() => setSelectedLibraryId(null)}
                className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
              >
                ← Back to libraries
              </button>
            </div>
          ) : (
            <LibraryList onSelectLibrary={setSelectedLibraryId} />
          )}
        </>
      )}
    </div>
  );
}

export default App;

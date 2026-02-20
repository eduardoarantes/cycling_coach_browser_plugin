import { AuthStatus } from './components/AuthStatus';

function App() {
  return (
    <div className="w-96 min-h-96 p-4 bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">TrainingPeaks</h1>
        <p className="text-sm text-gray-600">Workout Library Access</p>
      </div>

      <AuthStatus />

      <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          Your workout libraries will appear here once authenticated.
        </p>
      </div>
    </div>
  );
}

export default App;

/**
 * AuthStatus component
 *
 * Displays current authentication status and provides retry option
 */

import { useAuth } from '../../hooks/useAuth';

export function AuthStatus() {
  const { isAuthenticated, isLoading, error, tokenAge, refreshAuth } =
    useAuth();

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Authentication Error
            </p>
            <p className="mt-1 text-xs text-red-600">{error}</p>
          </div>
          <button
            onClick={refreshAuth}
            className="ml-3 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Not Authenticated
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              Please log in to TrainingPeaks and refresh this page
            </p>
          </div>
          <button
            onClick={refreshAuth}
            className="ml-3 text-sm text-yellow-600 hover:text-yellow-800 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Format token age
  const formatTokenAge = (age: number | null): string => {
    if (age === null) return 'Unknown';
    const hours = Math.floor(age / (1000 * 60 * 60));
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  return (
    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <p className="text-sm font-medium text-green-800">Authenticated</p>
          </div>
          <p className="mt-1 text-xs text-green-600">
            Token obtained {formatTokenAge(tokenAge)}
          </p>
        </div>
        <button
          onClick={refreshAuth}
          className="ml-3 text-sm text-green-600 hover:text-green-800 font-medium"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

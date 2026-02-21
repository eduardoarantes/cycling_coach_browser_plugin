import type { ReactElement } from 'react';
import type { UserProfile } from '@/types/api.types';

export interface UserInfoProps {
  user: UserProfile | undefined;
  isLoading: boolean;
}

export function UserInfo({
  user,
  isLoading,
}: UserInfoProps): ReactElement | null {
  if (isLoading) {
    return (
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900">{fullName}</p>
      <p className="text-xs text-gray-500">{user.email}</p>
    </div>
  );
}

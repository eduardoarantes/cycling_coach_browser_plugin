import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserInfo } from '@/popup/components/UserInfo';
import type { UserProfile } from '@/types/api.types';

describe('UserInfo', () => {
  const mockUser: UserProfile = {
    userId: 123,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    timeZone: 'America/New_York',
  };

  describe('Loading State', () => {
    it('should display loading skeleton when isLoading is true', () => {
      const { container } = render(
        <UserInfo user={undefined} isLoading={true} />
      );

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('should not display user data when loading', () => {
      render(<UserInfo user={mockUser} isLoading={true} />);

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('User Display', () => {
    it('should display user full name when user data is available', () => {
      render(<UserInfo user={mockUser} isLoading={false} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display user email when user data is available', () => {
      render(<UserInfo user={mockUser} isLoading={false} />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should not display loading skeleton when user data is available', () => {
      const { container } = render(
        <UserInfo user={mockUser} isLoading={false} />
      );

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render nothing when not loading and no user', () => {
      const { container } = render(
        <UserInfo user={undefined} isLoading={false} />
      );

      // Component should return null, so container should be empty
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with empty first name', () => {
      const userNoFirstName: UserProfile = {
        ...mockUser,
        firstName: '',
      };

      render(<UserInfo user={userNoFirstName} isLoading={false} />);

      expect(screen.getByText('Doe')).toBeInTheDocument();
    });

    it('should handle user with empty last name', () => {
      const userNoLastName: UserProfile = {
        ...mockUser,
        lastName: '',
      };

      render(<UserInfo user={userNoLastName} isLoading={false} />);

      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should handle very long email addresses', () => {
      const userLongEmail: UserProfile = {
        ...mockUser,
        email: 'very.long.email.address.that.might.overflow@example.com',
      };

      render(<UserInfo user={userLongEmail} isLoading={false} />);

      expect(screen.getByText(/very\.long\.email/)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply consistent card styling', () => {
      const { container } = render(
        <UserInfo user={mockUser} isLoading={false} />
      );

      const card = container.querySelector('.bg-white');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('rounded-lg', 'border');
    });
  });
});

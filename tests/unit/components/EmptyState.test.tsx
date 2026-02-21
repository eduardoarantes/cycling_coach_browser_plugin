import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/popup/components/EmptyState';
import type { ReactElement } from 'react';

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('should display title and message', () => {
      render(
        <EmptyState
          title="No Data Found"
          message="There is no data to display"
        />
      );

      expect(screen.getByText('No Data Found')).toBeInTheDocument();
      expect(
        screen.getByText('There is no data to display')
      ).toBeInTheDocument();
    });

    it('should render without icon when not provided', () => {
      const { container } = render(
        <EmptyState title="No Data" message="Empty" />
      );

      const icon = container.querySelector('[data-testid="empty-state-icon"]');
      expect(icon).not.toBeInTheDocument();
    });

    it('should render custom icon when provided', () => {
      const CustomIcon = (): ReactElement => (
        <div data-testid="custom-icon">Icon</div>
      );
      render(
        <EmptyState title="No Data" message="Empty" icon={<CustomIcon />} />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should not render action button when not provided', () => {
      render(<EmptyState title="No Data" message="Empty" />);

      const button = screen.queryByRole('button');
      expect(button).not.toBeInTheDocument();
    });

    it('should render action button when provided', () => {
      const action = {
        label: 'Try Again',
        onClick: vi.fn(),
      };

      render(<EmptyState title="No Data" message="Empty" action={action} />);

      expect(
        screen.getByRole('button', { name: 'Try Again - No Data' })
      ).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClick when action button is clicked', () => {
      const onClick = vi.fn();
      const action = {
        label: 'Retry',
        onClick,
      };

      render(
        <EmptyState
          title="Error"
          message="Something went wrong"
          action={action}
        />
      );

      const button = screen.getByRole('button', { name: 'Retry - Error' });
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<EmptyState title="No Results" message="No results found" />);

      const heading = screen.getByRole('heading', { name: 'No Results' });
      expect(heading).toBeInTheDocument();
    });

    it('should have accessible button when action is provided', () => {
      const action = {
        label: 'Click Me',
        onClick: vi.fn(),
      };

      render(<EmptyState title="Title" message="Message" action={action} />);

      const button = screen.getByRole('button', { name: 'Click Me - Title' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName('Click Me - Title');
    });
  });
});

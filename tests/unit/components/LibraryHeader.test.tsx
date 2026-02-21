import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryHeader } from '@/popup/components/LibraryHeader';

describe('LibraryHeader', () => {
  const defaultProps = {
    libraryName: 'My Workout Library',
    workoutCount: 15,
    onBack: vi.fn(),
  };

  describe('Component Rendering', () => {
    it('should render library name', () => {
      render(<LibraryHeader {...defaultProps} />);
      expect(screen.getByText('My Workout Library')).toBeInTheDocument();
    });

    it('should render workout count', () => {
      render(<LibraryHeader {...defaultProps} />);
      expect(screen.getByText('15 workouts')).toBeInTheDocument();
    });

    it('should render workout count with singular form when count is 1', () => {
      render(<LibraryHeader {...defaultProps} workoutCount={1} />);
      expect(screen.getByText('1 workout')).toBeInTheDocument();
    });

    it('should render workout count with plural form when count is 0', () => {
      render(<LibraryHeader {...defaultProps} workoutCount={0} />);
      expect(screen.getByText('0 workouts')).toBeInTheDocument();
    });

    it('should render workout count with plural form for multiple', () => {
      render(<LibraryHeader {...defaultProps} workoutCount={42} />);
      expect(screen.getByText('42 workouts')).toBeInTheDocument();
    });

    it('should render back button', () => {
      render(<LibraryHeader {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
    });

    it('should render back arrow icon', () => {
      render(<LibraryHeader {...defaultProps} />);
      // Check for SVG or icon element
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton.textContent).toContain('←');
    });
  });

  describe('Long Library Name Handling', () => {
    it('should truncate very long library names', () => {
      const longName =
        'This is a very long library name that should be truncated when displayed';
      render(<LibraryHeader {...defaultProps} libraryName={longName} />);

      const nameElement = screen.getByText(longName);
      // Should have truncate class
      expect(nameElement).toHaveClass('truncate');
    });

    it('should handle empty library name', () => {
      render(<LibraryHeader {...defaultProps} libraryName="" />);
      // Should still render the header structure with workout count
      expect(screen.getByText('15 workouts')).toBeInTheDocument();
      // And back button should still work
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onBack when back button is clicked', async () => {
      const handleBack = vi.fn();
      const user = userEvent.setup();

      render(<LibraryHeader {...defaultProps} onBack={handleBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('should call onBack only once per click', async () => {
      const handleBack = vi.fn();
      const user = userEvent.setup();

      render(<LibraryHeader {...defaultProps} onBack={handleBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('should not call onBack on mount', () => {
      const handleBack = vi.fn();

      render(<LibraryHeader {...defaultProps} onBack={handleBack} />);

      expect(handleBack).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const handleBack = vi.fn();
      const user = userEvent.setup();

      render(<LibraryHeader {...defaultProps} onBack={handleBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });

      // Tab to the button
      await user.tab();
      expect(backButton).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(handleBack).toHaveBeenCalled();
    });

    it('should support Space key activation', async () => {
      const handleBack = vi.fn();
      const user = userEvent.setup();

      render(<LibraryHeader {...defaultProps} onBack={handleBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });

      // Focus and activate with Space
      backButton.focus();
      await user.keyboard(' ');

      expect(handleBack).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role for back button', () => {
      render(<LibraryHeader {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toHaveAttribute('type', 'button');
    });

    it('should have descriptive aria-label for back button', () => {
      render(<LibraryHeader {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /back/i });
      const ariaLabel = backButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.toLowerCase()).toContain('back');
    });

    it('should have proper heading hierarchy', () => {
      render(<LibraryHeader {...defaultProps} />);
      // Library name should be a heading
      const heading = screen.getByRole('heading');
      expect(heading).toHaveTextContent('My Workout Library');
    });
  });

  describe('Visual Structure', () => {
    it('should render back button on the left', () => {
      const { container } = render(<LibraryHeader {...defaultProps} />);
      const header = container.firstChild as HTMLElement;

      // Should have flex layout with proper ordering
      expect(header).toHaveClass('flex');
    });

    it('should display library name and count in proper container', () => {
      render(<LibraryHeader {...defaultProps} />);

      // Both should be present
      expect(screen.getByText('My Workout Library')).toBeInTheDocument();
      expect(screen.getByText('15 workouts')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle large workout counts', () => {
      render(<LibraryHeader {...defaultProps} workoutCount={9999} />);
      expect(screen.getByText('9999 workouts')).toBeInTheDocument();
    });

    it('should handle special characters in library name', () => {
      const specialName = "John's Workouts & Training (2024)";
      render(<LibraryHeader {...defaultProps} libraryName={specialName} />);
      expect(screen.getByText(specialName)).toBeInTheDocument();
    });

    it('should handle Unicode characters in library name', () => {
      const unicodeName = '🚴‍♂️ Cycling Training 2024';
      render(<LibraryHeader {...defaultProps} libraryName={unicodeName} />);
      expect(screen.getByText(unicodeName)).toBeInTheDocument();
    });
  });
});

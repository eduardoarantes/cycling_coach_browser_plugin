import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryCard } from '@/popup/components/LibraryCard';
import type { Library } from '@/types/api.types';

describe('LibraryCard', () => {
  const mockLibrary: Library = {
    exerciseLibraryId: 1,
    libraryName: 'Test Library',
    ownerId: 123,
    ownerName: 'John Doe',
    imageUrl: null,
    isDefaultContent: false,
  };

  const mockOnClick = vi.fn();

  describe('Rendering', () => {
    it('should display library name', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      expect(screen.getByText('Test Library')).toBeInTheDocument();
    });

    it('should display owner name with "by" prefix', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      expect(screen.getByText('by John Doe')).toBeInTheDocument();
    });

    it('should render as a button element', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });

    it('should truncate very long library names', () => {
      const longNameLibrary: Library = {
        ...mockLibrary,
        libraryName:
          'This is an extremely long library name that should be truncated',
      };

      const { container } = render(
        <LibraryCard library={longNameLibrary} onClick={mockOnClick} />
      );

      const heading = container.querySelector('h3');
      expect(heading).toHaveClass('truncate');
    });
  });

  describe('Interactions', () => {
    it('should call onClick with library ID when clicked', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(1);
    });

    it('should call onClick with correct ID for different libraries', () => {
      const anotherLibrary: Library = {
        ...mockLibrary,
        exerciseLibraryId: 456,
      };

      render(<LibraryCard library={anotherLibrary} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(456);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should be focusable', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      card.focus();

      expect(card).toHaveFocus();
    });

    it('should be a button element with proper semantics', () => {
      render(<LibraryCard library={mockLibrary} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      expect(card.tagName).toBe('BUTTON');
      // Buttons natively handle Enter and Space key activation
    });
  });

  describe('Styling', () => {
    it('should have hover effects', () => {
      const { container } = render(
        <LibraryCard library={mockLibrary} onClick={mockOnClick} />
      );

      const card = container.querySelector('button');
      expect(card).toHaveClass('hover:border-blue-400', 'hover:shadow-md');
    });

    it('should have transition class for smooth animations', () => {
      const { container } = render(
        <LibraryCard library={mockLibrary} onClick={mockOnClick} />
      );

      const card = container.querySelector('button');
      expect(card).toHaveClass('transition-all');
    });

    it('should be left-aligned text', () => {
      const { container } = render(
        <LibraryCard library={mockLibrary} onClick={mockOnClick} />
      );

      const card = container.querySelector('button');
      expect(card).toHaveClass('text-left');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty owner name gracefully', () => {
      const noOwnerLibrary: Library = {
        ...mockLibrary,
        ownerName: '',
      };

      render(<LibraryCard library={noOwnerLibrary} onClick={mockOnClick} />);

      expect(screen.getByText('by')).toBeInTheDocument();
    });

    it('should handle special characters in library name', () => {
      const specialCharsLibrary: Library = {
        ...mockLibrary,
        libraryName: 'Test & "Special" <Library>',
      };

      render(
        <LibraryCard library={specialCharsLibrary} onClick={mockOnClick} />
      );

      expect(
        screen.getByText('Test & "Special" <Library>')
      ).toBeInTheDocument();
    });
  });
});

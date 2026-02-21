import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '@/popup/components/SearchBar';

describe('SearchBar', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render an input element', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should display the current value', () => {
      render(<SearchBar value="test query" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('test query');
    });

    it('should show default placeholder', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText('Search libraries...');
      expect(input).toBeInTheDocument();
    });

    it('should show custom placeholder when provided', () => {
      render(
        <SearchBar
          value=""
          onChange={mockOnChange}
          placeholder="Find your library"
        />
      );

      const input = screen.getByPlaceholderText('Find your library');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should update input value when typing', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new search' } });

      expect((input as HTMLInputElement).value).toBe('new search');
    });

    it('should debounce onChange calls', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');

      // Type multiple times quickly
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });

      // onChange should not be called immediately
      expect(mockOnChange).not.toHaveBeenCalled();

      // Fast-forward time past debounce delay (300ms)
      await vi.advanceTimersByTimeAsync(300);

      // Now onChange should be called once with final value
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('abc');
    });

    it('should cancel pending onChange when new input arrives', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');

      // Type first value
      fireEvent.change(input, { target: { value: 'first' } });

      // Wait 150ms (not enough to trigger debounce)
      await vi.advanceTimersByTimeAsync(150);

      // Type second value (should cancel first debounce)
      fireEvent.change(input, { target: { value: 'second' } });

      // Complete the debounce period
      await vi.advanceTimersByTimeAsync(300);

      // Should only be called once with the latest value
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('second');
    });

    it('should clear input when value becomes empty', () => {
      render(<SearchBar value="test" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });

      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper input type', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should be focusable', () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      input.focus();

      expect(input).toHaveFocus();
    });
  });

  describe('Styling', () => {
    it('should have full width class', () => {
      const { container } = render(
        <SearchBar value="" onChange={mockOnChange} />
      );

      const input = container.querySelector('input');
      expect(input).toHaveClass('w-full');
    });

    it('should have focus ring styles', () => {
      const { container } = render(
        <SearchBar value="" onChange={mockOnChange} />
      );

      const input = container.querySelector('input');
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long search queries', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      const longQuery = 'a'.repeat(1000);

      fireEvent.change(input, { target: { value: longQuery } });
      await vi.advanceTimersByTimeAsync(300);

      expect(mockOnChange).toHaveBeenCalledWith(longQuery);
    });

    it('should handle special characters in search', async () => {
      render(<SearchBar value="" onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      const specialChars = '!@#$%^&*()';

      fireEvent.change(input, { target: { value: specialChars } });
      await vi.advanceTimersByTimeAsync(300);

      expect(mockOnChange).toHaveBeenCalledWith(specialChars);
    });
  });
});

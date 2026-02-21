import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/popup/components/LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('Rendering', () => {
    it('should render a loading spinner', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render with default medium size', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('.w-8.h-8');
      expect(spinner).toBeInTheDocument();
    });

    it('should render with small size when specified', () => {
      const { container } = render(<LoadingSpinner size="sm" />);
      const spinner = container.querySelector('.w-4.h-4');
      expect(spinner).toBeInTheDocument();
    });

    it('should render with large size when specified', () => {
      const { container } = render(<LoadingSpinner size="lg" />);
      const spinner = container.querySelector('.w-12.h-12');
      expect(spinner).toBeInTheDocument();
    });

    it('should apply custom className when provided', () => {
      const { container } = render(<LoadingSpinner className="custom-class" />);
      const spinner = container.querySelector('.custom-class');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should have accessible label', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByLabelText(/loading/i);
      expect(spinner).toBeInTheDocument();
    });
  });
});

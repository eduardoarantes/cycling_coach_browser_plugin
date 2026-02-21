import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LibraryGrid } from '@/popup/components/LibraryGrid';

describe('LibraryGrid', () => {
  describe('Rendering', () => {
    it('should render children', () => {
      const { container } = render(
        <LibraryGrid>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </LibraryGrid>
      );

      expect(
        container.querySelector('[data-testid="child-1"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-testid="child-2"]')
      ).toBeInTheDocument();
    });

    it('should apply grid layout classes', () => {
      const { container } = render(
        <LibraryGrid>
          <div>Child</div>
        </LibraryGrid>
      );

      const grid = container.firstChild;
      expect(grid).toHaveClass('grid');
    });

    it('should have gap spacing between items', () => {
      const { container } = render(
        <LibraryGrid>
          <div>Child</div>
        </LibraryGrid>
      );

      const grid = container.firstChild;
      expect(grid).toHaveClass('gap-4');
    });

    it('should render empty when no children', () => {
      const { container } = render(<LibraryGrid>{[]}</LibraryGrid>);

      const grid = container.firstChild;
      expect(grid).toBeEmptyDOMElement();
    });
  });

  describe('Layout', () => {
    it('should have single column layout', () => {
      const { container } = render(
        <LibraryGrid>
          <div>Child</div>
        </LibraryGrid>
      );

      const grid = container.firstChild;
      expect(grid).toHaveClass('grid-cols-1');
    });
  });
});

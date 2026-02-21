import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutGrid } from '@/popup/components/WorkoutGrid';

describe('WorkoutGrid', () => {
  describe('Component Rendering', () => {
    it('should render children', () => {
      render(
        <WorkoutGrid>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </WorkoutGrid>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('should render multiple children in order', () => {
      render(
        <WorkoutGrid>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </WorkoutGrid>
      );

      const children = screen.getAllByText(/First|Second|Third/);
      expect(children).toHaveLength(3);
      expect(children[0]).toHaveTextContent('First');
      expect(children[1]).toHaveTextContent('Second');
      expect(children[2]).toHaveTextContent('Third');
    });

    it('should render when no children provided', () => {
      const { container } = render(<WorkoutGrid>{null}</WorkoutGrid>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with single child', () => {
      render(
        <WorkoutGrid>
          <div data-testid="only-child">Only Child</div>
        </WorkoutGrid>
      );

      expect(screen.getByTestId('only-child')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('should apply vertical stacking layout class', () => {
      const { container } = render(
        <WorkoutGrid>
          <div>Child</div>
        </WorkoutGrid>
      );

      const grid = container.firstChild as HTMLElement;
      // Should have vertical spacing class
      expect(grid).toHaveClass('space-y-4');
    });

    it('should be a flex column container', () => {
      const { container } = render(
        <WorkoutGrid>
          <div>Child</div>
        </WorkoutGrid>
      );

      const grid = container.firstChild as HTMLElement;
      expect(grid).toHaveClass('flex');
      expect(grid).toHaveClass('flex-col');
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const { container } = render(
        <WorkoutGrid>
          <div>Child</div>
        </WorkoutGrid>
      );

      // Should be a div container (not a list, since cards handle their own semantics)
      expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
    });

    it('should not interfere with child accessibility', () => {
      render(
        <WorkoutGrid>
          <button aria-label="Test button">Click me</button>
        </WorkoutGrid>
      );

      const button = screen.getByLabelText('Test button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Test button');
    });
  });

  describe('Edge Cases', () => {
    it('should handle fragment children', () => {
      render(
        <WorkoutGrid>
          <>
            <div data-testid="fragment-1">Fragment 1</div>
            <div data-testid="fragment-2">Fragment 2</div>
          </>
        </WorkoutGrid>
      );

      expect(screen.getByTestId('fragment-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-2')).toBeInTheDocument();
    });

    it('should handle mixed content types', () => {
      render(
        <WorkoutGrid>
          <div>Div element</div>
          <span>Span element</span>
          <button>Button element</button>
        </WorkoutGrid>
      );

      expect(screen.getByText('Div element')).toBeInTheDocument();
      expect(screen.getByText('Span element')).toBeInTheDocument();
      expect(screen.getByText('Button element')).toBeInTheDocument();
    });

    it('should handle empty array of children', () => {
      const { container } = render(<WorkoutGrid>{[]}</WorkoutGrid>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

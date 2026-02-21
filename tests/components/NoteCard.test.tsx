/**
 * Unit tests for NoteCard component
 *
 * Tests calendar note card rendering and accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteCard } from '@/popup/components/NoteCard';
import type { CalendarNote } from '@/types/api.types';

// Mock calendar note data
const mockNote: CalendarNote = {
  id: 1,
  title: 'Week 2 starting',
  description: 'Recovery week focus on easy miles',
  noteDate: '2026-02-24',
  createdDate: '2026-02-01T00:00:00Z',
  modifiedDate: '2026-02-01T00:00:00Z',
  planId: 456,
  attachments: [],
};

describe('NoteCard', () => {
  describe('rendering', () => {
    it('should render note title', () => {
      render(<NoteCard note={mockNote} />);

      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
    });

    it('should render note description', () => {
      render(<NoteCard note={mockNote} />);

      expect(
        screen.getByText('Recovery week focus on easy miles')
      ).toBeInTheDocument();
    });

    it('should render note icon', () => {
      render(<NoteCard note={mockNote} />);

      // Look for the note emoji or icon
      expect(screen.getByText(/📝/)).toBeInTheDocument();
    });

    it('should have distinct styling for notes', () => {
      const { container } = render(<NoteCard note={mockNote} />);

      // Should have yellow/beige background
      const card = container.querySelector('.bg-yellow-50');
      expect(card).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle note without description', () => {
      const noteNoDesc = { ...mockNote, description: '' };
      render(<NoteCard note={noteNoDesc} />);

      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
      // Description should not be rendered
      expect(screen.queryByText('Recovery week focus')).not.toBeInTheDocument();
    });

    it('should handle very long note title', () => {
      const longTitleNote = {
        ...mockNote,
        title:
          'This is a very long note title that should be displayed properly',
      };
      render(<NoteCard note={longTitleNote} />);

      expect(
        screen.getByText(/This is a very long note title/)
      ).toBeInTheDocument();
    });

    it('should handle very long description', () => {
      const longDescNote = {
        ...mockNote,
        description:
          'This is a very long description that contains a lot of text about the training week and should be handled gracefully by the component',
      };
      render(<NoteCard note={longDescNote} />);

      expect(
        screen.getByText(/This is a very long description/)
      ).toBeInTheDocument();
    });

    it('should handle note with attachments', () => {
      const noteWithAttachments = {
        ...mockNote,
        attachments: [{ id: 1, name: 'test.pdf' }] as never[],
      };
      render(<NoteCard note={noteWithAttachments} />);

      // Should still render the note
      expect(screen.getByText('Week 2 starting')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have compact layout for calendar cells', () => {
      const { container } = render(<NoteCard note={mockNote} />);

      // Should have padding that's suitable for calendar cells
      const card = container.querySelector('.p-2');
      expect(card).toBeInTheDocument();
    });

    it('should have rounded corners', () => {
      const { container } = render(<NoteCard note={mockNote} />);

      const card = container.querySelector('.rounded-md');
      expect(card).toBeInTheDocument();
    });

    it('should have border', () => {
      const { container } = render(<NoteCard note={mockNote} />);

      const card = container.querySelector('.border');
      expect(card).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic HTML structure', () => {
      render(<NoteCard note={mockNote} />);

      // Title should be in a heading or strong element
      const title = screen.getByText('Week 2 starting');
      expect(title.tagName).toMatch(/H[1-6]|STRONG|P/);
    });

    it('should include aria-label for screen readers', () => {
      const { container } = render(<NoteCard note={mockNote} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('aria-label');
    });
  });
});

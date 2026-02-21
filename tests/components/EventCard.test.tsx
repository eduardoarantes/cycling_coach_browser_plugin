/**
 * Unit tests for EventCard component
 *
 * Tests calendar event card rendering and accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/popup/components/EventCard';
import type { CalendarEvent } from '@/types/api.types';

// Mock calendar event data
const mockEvent: CalendarEvent = {
  id: 1,
  planId: 456,
  eventDate: '2026-03-13',
  name: 'Husky',
  eventType: 'MultisportTriathlon',
  description: 'Olympic distance triathlon',
  comment: 'Go for sub 2:30',
  distance: 51.5,
  distanceUnits: 'km',
  legs: [],
};

describe('EventCard', () => {
  describe('rendering', () => {
    it('should render event name', () => {
      render(<EventCard event={mockEvent} />);

      expect(screen.getByText('Husky')).toBeInTheDocument();
    });

    it('should render event type', () => {
      render(<EventCard event={mockEvent} />);

      expect(screen.getByText('MultisportTriathlon')).toBeInTheDocument();
    });

    it('should render event icon', () => {
      render(<EventCard event={mockEvent} />);

      // Look for the event emoji or icon
      expect(screen.getByText(/🏁/)).toBeInTheDocument();
    });

    it('should have distinct styling for events', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      // Should have green background
      const card = container.querySelector('.bg-green-50');
      expect(card).toBeInTheDocument();
    });

    it('should display distance when available', () => {
      render(<EventCard event={mockEvent} />);

      expect(screen.getByText(/51.5/)).toBeInTheDocument();
      expect(screen.getByText(/km/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle event without distance', () => {
      const eventNoDistance = {
        ...mockEvent,
        distance: null,
        distanceUnits: null,
      };
      render(<EventCard event={eventNoDistance} />);

      expect(screen.getByText('Husky')).toBeInTheDocument();
      expect(screen.getByText('MultisportTriathlon')).toBeInTheDocument();
      // Distance should not be rendered
      expect(screen.queryByText(/km/)).not.toBeInTheDocument();
    });

    it('should handle very long event name', () => {
      const longNameEvent = {
        ...mockEvent,
        name: 'Ironman World Championship Kailua-Kona Hawaii',
      };
      render(<EventCard event={longNameEvent} />);

      expect(
        screen.getByText(/Ironman World Championship/)
      ).toBeInTheDocument();
    });

    it('should handle event without description', () => {
      const eventNoDesc = { ...mockEvent, description: null };
      render(<EventCard event={eventNoDesc} />);

      expect(screen.getByText('Husky')).toBeInTheDocument();
    });

    it('should handle event without comment', () => {
      const eventNoComment = { ...mockEvent, comment: null };
      render(<EventCard event={eventNoComment} />);

      expect(screen.getByText('Husky')).toBeInTheDocument();
    });

    it('should format different event types', () => {
      const runEvent = { ...mockEvent, eventType: 'Run' };
      render(<EventCard event={runEvent} />);

      expect(screen.getByText('Run')).toBeInTheDocument();
    });

    it('should handle various distance units', () => {
      const milesEvent = {
        ...mockEvent,
        distance: 26.2,
        distanceUnits: 'miles',
      };
      render(<EventCard event={milesEvent} />);

      expect(screen.getByText(/26.2/)).toBeInTheDocument();
      expect(screen.getByText(/miles/)).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have compact layout for calendar cells', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      // Should have padding suitable for calendar cells
      const card = container.querySelector('.p-2');
      expect(card).toBeInTheDocument();
    });

    it('should have rounded corners', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      const card = container.querySelector('.rounded-md');
      expect(card).toBeInTheDocument();
    });

    it('should have border', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      const card = container.querySelector('.border');
      expect(card).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic HTML structure', () => {
      render(<EventCard event={mockEvent} />);

      // Name should be in a heading or strong element
      const name = screen.getByText('Husky');
      expect(name.tagName).toMatch(/H[1-6]|STRONG|P/);
    });

    it('should include aria-label for screen readers', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('aria-label');
    });

    it('should provide meaningful event information to screen readers', () => {
      const { container } = render(<EventCard event={mockEvent} />);

      const card = container.firstChild as HTMLElement;
      const ariaLabel = card.getAttribute('aria-label');

      // Should include event name and type
      expect(ariaLabel).toContain('Husky');
      expect(ariaLabel).toContain('MultisportTriathlon');
    });
  });
});

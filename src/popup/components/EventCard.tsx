/**
 * EventCard component
 *
 * Displays a calendar event with name, type, and distance
 */

import type { ReactElement } from 'react';
import type { CalendarEvent } from '@/types/api.types';

export interface EventCardProps {
  event: CalendarEvent;
}

export function EventCard({ event }: EventCardProps): ReactElement {
  const hasDistance = event.distance !== null && event.distanceUnits !== null;
  const distanceText = hasDistance
    ? `${event.distance} ${event.distanceUnits}`
    : null;

  return (
    <div
      aria-label={`Event: ${event.name} - ${event.eventType}`}
      className="p-2 bg-green-50 rounded-md border border-green-200"
    >
      <div className="flex items-start space-x-2">
        <span className="text-base flex-shrink-0" role="img" aria-label="event">
          🏁
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-900 truncate">
            {event.name}
          </p>
          <p className="text-xs text-green-700 mt-1">{event.eventType}</p>
          {distanceText && (
            <p className="text-xs text-green-600 mt-1">{distanceText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

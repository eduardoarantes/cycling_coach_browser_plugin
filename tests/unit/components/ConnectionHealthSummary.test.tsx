import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionHealthSummary } from '@/popup/components/ConnectionHealthSummary';

describe('ConnectionHealthSummary', () => {
  it('shows green status when all enabled connections are authenticated', () => {
    render(
      <ConnectionHealthSummary
        isTrainingPeaksAuthenticated={true}
        isPlanMyPeakEnabled={true}
        isPlanMyPeakAuthenticated={true}
        isIntervalsEnabled={false}
        isIntervalsAuthenticated={false}
      />
    );

    expect(
      screen.getByText('All enabled connections authenticated')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Authenticated 2/2 enabled connections. Manage optional providers in Settings.'
      )
    ).toBeInTheDocument();
  });

  it('shows yellow status when only part of enabled connections are authenticated', () => {
    render(
      <ConnectionHealthSummary
        isTrainingPeaksAuthenticated={true}
        isPlanMyPeakEnabled={true}
        isPlanMyPeakAuthenticated={false}
        isIntervalsEnabled={true}
        isIntervalsAuthenticated={false}
      />
    );

    expect(
      screen.getByText('Some enabled connections are not authenticated')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Authenticated 1/3 enabled connections. Manage optional providers in Settings.'
      )
    ).toBeInTheDocument();
  });

  it('shows red status when none of enabled connections are authenticated', () => {
    render(
      <ConnectionHealthSummary
        isTrainingPeaksAuthenticated={false}
        isPlanMyPeakEnabled={true}
        isPlanMyPeakAuthenticated={false}
        isIntervalsEnabled={false}
        isIntervalsAuthenticated={true}
      />
    );

    expect(
      screen.getByText('No enabled connections authenticated')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Authenticated 0/2 enabled connections. Manage optional providers in Settings.'
      )
    ).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
      screen.getByText('Authenticated 2/2 enabled connections.')
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
      screen.getByText('Authenticated 1/3 enabled connections.')
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
      screen.getByText('Authenticated 0/2 enabled connections.')
    ).toBeInTheDocument();
  });

  it('offers a way into Settings when a connection is unauthenticated', () => {
    const onOpenSettings = vi.fn();

    render(
      <ConnectionHealthSummary
        onOpenSettings={onOpenSettings}
        isTrainingPeaksAuthenticated={true}
        isPlanMyPeakEnabled={true}
        isPlanMyPeakAuthenticated={false}
        isIntervalsEnabled={true}
        isIntervalsAuthenticated={false}
      />
    );

    // Naming Settings without a way to reach it leaves the reader to find it.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Manage optional providers in Settings.',
      })
    );

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('offers the same way in from every status', () => {
    const onOpenSettings = vi.fn();

    for (const authenticated of [true, false]) {
      const { unmount } = render(
        <ConnectionHealthSummary
          onOpenSettings={onOpenSettings}
          isTrainingPeaksAuthenticated={authenticated}
          isPlanMyPeakEnabled={false}
          isPlanMyPeakAuthenticated={false}
          isIntervalsEnabled={false}
          isIntervalsAuthenticated={false}
        />
      );

      expect(
        screen.getByRole('button', {
          name: 'Manage optional providers in Settings.',
        })
      ).toBeInTheDocument();

      unmount();
    }
  });

  it('falls back to plain text when there is nowhere to navigate', () => {
    render(
      <ConnectionHealthSummary
        isTrainingPeaksAuthenticated={true}
        isPlanMyPeakEnabled={true}
        isPlanMyPeakAuthenticated={false}
        isIntervalsEnabled={false}
        isIntervalsAuthenticated={false}
      />
    );

    // A control that cannot do anything is worse than prose.
    expect(
      screen.queryByRole('button', {
        name: 'Manage optional providers in Settings.',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Manage optional providers in Settings.')
    ).toBeInTheDocument();
  });
});

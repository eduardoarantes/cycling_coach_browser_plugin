import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanMyPeakEnvironmentIndicator } from '@/popup/components/PlanMyPeakEnvironmentIndicator';

describe('PlanMyPeakEnvironmentIndicator', () => {
  it('shows a localhost banner when the local target is active', () => {
    render(
      <PlanMyPeakEnvironmentIndicator
        isVisible={true}
        hostLabel="localhost:3006"
      />
    );

    expect(screen.getByText('Local PlanMyPeak Target')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This build targets localhost:3006 instead of planmypeak.com.'
      )
    ).toBeInTheDocument();
  });

  it('renders nothing when the local target is not active', () => {
    const { container } = render(
      <PlanMyPeakEnvironmentIndicator
        isVisible={false}
        hostLabel="planmypeak.com"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

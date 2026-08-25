import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanMyPeakEnvironmentIndicator } from '@/popup/components/PlanMyPeakEnvironmentIndicator';

describe('PlanMyPeakEnvironmentIndicator', () => {
  it('shows a localhost banner when the local environment is active', () => {
    render(
      <PlanMyPeakEnvironmentIndicator
        environment="local"
        hostLabel="localhost:3006"
      />
    );

    expect(screen.getByText('Local PlanMyPeak Target')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This extension targets localhost:3006 instead of portal.planmypeak.com.'
      )
    ).toBeInTheDocument();
  });

  it('shows a staging banner when the staging environment is active', () => {
    render(
      <PlanMyPeakEnvironmentIndicator
        environment="staging"
        hostLabel="staging.app.planmypeak.com"
      />
    );

    expect(screen.getByText('Staging PlanMyPeak Target')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This extension targets staging.app.planmypeak.com instead of portal.planmypeak.com.'
      )
    ).toBeInTheDocument();
  });

  it('renders nothing on production', () => {
    const { container } = render(
      <PlanMyPeakEnvironmentIndicator
        environment="production"
        hostLabel="portal.planmypeak.com"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

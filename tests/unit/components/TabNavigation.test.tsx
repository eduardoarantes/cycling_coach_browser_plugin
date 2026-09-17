import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabNavigation } from '@/popup/components/TabNavigation';

describe('TabNavigation', () => {
  it('renders the four tabs and reports a change', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="libraries" onTabChange={onTabChange} />);

    expect(
      screen.getByRole('button', { name: 'Workout Libraries' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Plans Library' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Athlete Groups' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Workouts' }));
    expect(onTabChange).toHaveBeenCalledWith('captured');
  });

  it('shows a dot and exposes the pending count while workouts are pending', () => {
    render(
      <TabNavigation
        activeTab="libraries"
        onTabChange={vi.fn()}
        pendingCount={3}
      />
    );

    expect(screen.getByTestId('captured-pending-dot')).toBeInTheDocument();
    const tab = screen.getByRole('button', { name: 'New Workouts, 3 pending' });
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveClass('ring-amber-500');
  });

  it('shows no dot when nothing is pending', () => {
    render(
      <TabNavigation
        activeTab="captured"
        onTabChange={vi.fn()}
        pendingCount={0}
      />
    );

    expect(
      screen.queryByTestId('captured-pending-dot')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New Workouts' })
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('does not report a click on the already active tab', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation activeTab="captured" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'New Workouts' }));
    expect(onTabChange).not.toHaveBeenCalled();
  });
});

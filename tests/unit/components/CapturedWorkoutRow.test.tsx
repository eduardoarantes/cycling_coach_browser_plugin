import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapturedWorkoutRow } from '@/popup/components/CapturedWorkoutRow';
import {
  formatDisciplineLabel,
  formatPlannedDuration,
  formatWorkoutDay,
} from '@/utils/capturedWorkoutFormat';
import type { CapturedWorkoutRecord } from '@/schemas/capturedWorkout.schema';

function record(
  overrides: Partial<CapturedWorkoutRecord> = {}
): CapturedWorkoutRecord {
  return {
    key: 'production:4830660:555',
    athleteId: 4830660,
    workoutId: 555,
    environment: 'production',
    capturedAt: 1000,
    updatedAt: 1000,
    status: 'pending',
    workout: {
      title: 'Sweet Spot',
      workoutDay: '2026-09-20T00:00:00',
      workoutTypeValueId: 2,
      structure: null,
      totalTimePlanned: 1.5,
      tssPlanned: 85,
      ifPlanned: 0.86,
      distancePlanned: null,
      caloriesPlanned: null,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: null,
      coachComments: null,
      userTags: null,
      lastModifiedDate: null,
    },
    ...overrides,
  };
}

function renderRow(
  props: Partial<React.ComponentProps<typeof CapturedWorkoutRow>> = {}
) {
  const onSend = vi.fn();
  const onDismiss = vi.fn();
  render(
    <ul>
      <CapturedWorkoutRow
        record={record()}
        isSending={false}
        canSend
        onSend={onSend}
        onDismiss={onDismiss}
        {...props}
      />
    </ul>
  );
  return { onSend, onDismiss };
}

describe('CapturedWorkoutRow', () => {
  it('shows title, day, athlete id, sport, duration and TSS', () => {
    renderRow();

    expect(screen.getByText('Sweet Spot')).toBeInTheDocument();
    expect(
      screen.getByText(/Sep 20, 2026 · Athlete 4830660/)
    ).toBeInTheDocument();
    expect(screen.getByText('Bike · 1h 30m · TSS 85')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByText('Sandbox')).not.toBeInTheDocument();
  });

  it('marks sandbox captures', () => {
    renderRow({
      record: record({ environment: 'sandbox', key: 'sandbox:1:1' }),
    });

    expect(screen.getByText('Sandbox')).toBeInTheDocument();
  });

  it('calls onSend and onDismiss with the record key', () => {
    const { onSend, onDismiss } = renderRow();

    fireEvent.click(
      screen.getByRole('button', { name: /send to planmypeak/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onSend).toHaveBeenCalledWith('production:4830660:555');
    expect(onDismiss).toHaveBeenCalledWith('production:4830660:555');
  });

  it('disables both actions and shows Sending… while in flight', () => {
    renderRow({ isSending: true });

    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send to planmypeak/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeDisabled();
  });

  it('disables Send with the reason when sending is gated', () => {
    renderRow({ canSend: false, sendDisabledReason: 'Connect PlanMyPeak' });

    const send = screen.getByRole('button', { name: /send to planmypeak/i });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute('title', 'Connect PlanMyPeak');
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeEnabled();
  });

  it('shows the stored send error', () => {
    renderRow({ record: record({ lastSendError: 'name too long' }) });

    expect(screen.getByRole('alert')).toHaveTextContent('name too long');
  });

  it('shows an outcome warning and error from the last send', () => {
    renderRow({
      outcome: { warning: 'Sent without its structure', error: 'nope' },
    });

    expect(screen.getByText('Sent without its structure')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('nope');
  });

  it('offers re-send but not dismiss for a sent record, and names the library', () => {
    renderRow({
      record: record({
        status: 'sent',
        planMyPeakWorkoutId: 'pmp-1',
        planMyPeakLibraryName: 'My Library',
      }),
    });

    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('In My Library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send again/i })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /dismiss/i })
    ).not.toBeInTheDocument();
  });

  it('offers no actions for a dismissed record', () => {
    renderRow({ record: record({ status: 'dismissed' }) });

    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('formats helpers', () => {
    expect(formatDisciplineLabel('cross_train')).toBe('Cross Train');
    expect(formatPlannedDuration(null)).toBeNull();
    expect(formatPlannedDuration(0.5)).toBe('30m');
    expect(formatPlannedDuration(2)).toBe('2h');
    expect(formatPlannedDuration(1.25)).toBe('1h 15m');
    expect(formatWorkoutDay('not a date')).toBe('not a date');
  });
});

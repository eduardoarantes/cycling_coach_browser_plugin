import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportResult } from '@/popup/components/export/ExportResult';
import type { ExportResult as ExportResultType } from '@/export/adapters/base';

function makeWarning(index: number) {
  return {
    field: `warning-${index}`,
    message: `Warning message ${index}`,
    severity: 'warning' as const,
  };
}

describe('ExportResult', () => {
  it('shows all warnings when user expands the warning list', () => {
    const result: ExportResultType = {
      success: true,
      fileName: 'Plan A',
      format: 'api',
      itemsExported: 3,
      warnings: [
        makeWarning(1),
        makeWarning(2),
        makeWarning(3),
        makeWarning(4),
        makeWarning(5),
      ],
    };

    render(<ExportResult result={result} onClose={vi.fn()} />);

    expect(screen.getByText(/Warning message 1/)).toBeInTheDocument();
    expect(screen.getByText(/Warning message 2/)).toBeInTheDocument();
    expect(screen.getByText(/Warning message 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Warning message 4/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show all 5 warnings'));

    expect(screen.getByText(/Warning message 4/)).toBeInTheDocument();
    expect(screen.getByText(/Warning message 5/)).toBeInTheDocument();
    expect(screen.getByText('Show fewer warnings')).toBeInTheDocument();
  });

  it('shows all errors when user expands the error list', () => {
    const result: ExportResultType = {
      success: false,
      fileName: 'Plan B',
      format: 'api',
      itemsExported: 0,
      warnings: [],
      errors: [
        'Error 1',
        'Error 2',
        'Error 3',
        'Error 4',
        'Error 5',
        'Error 6',
      ],
    };

    render(<ExportResult result={result} onClose={vi.fn()} />);

    expect(screen.getByText(/Error 1/)).toBeInTheDocument();
    expect(screen.getByText(/Error 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Error 6/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show all 6 errors'));

    expect(screen.getByText(/Error 6/)).toBeInTheDocument();
    expect(screen.getByText('Show fewer errors')).toBeInTheDocument();
  });
});

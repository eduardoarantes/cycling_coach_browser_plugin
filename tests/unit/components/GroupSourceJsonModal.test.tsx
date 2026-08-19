import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GroupSourceJsonModal } from '@/popup/components/GroupSourceJsonModal';

const downloadJsonFile = vi.fn();
vi.mock('@/utils/downloadJson', () => ({
  downloadJsonFile: (data: unknown, fileName: string): void =>
    downloadJsonFile(data, fileName),
}));

const samplePayload = [
  { id: 340276, coachId: 6469888, name: 'My Athletes', athleteIds: [] },
];

describe('GroupSourceJsonModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render nothing when raw is null', () => {
    const { container } = render(
      <GroupSourceJsonModal raw={null} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the pretty-printed JSON payload', () => {
    render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

    const expected = JSON.stringify(samplePayload, null, 2);
    expect(
      screen.getByText((_, node) => node?.tagName === 'PRE')
    ).toHaveTextContent('My Athletes');
    // The <pre> holds the fully indented JSON string.
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toBe(expected);
  });

  it('should copy the JSON string to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(samplePayload, null, 2)
      );
    });
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('should download the raw payload as a JSON file', () => {
    render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadJsonFile).toHaveBeenCalledWith(
      samplePayload,
      'athlete-groups-source.json'
    );
  });

  it('should close via the close button', () => {
    const onClose = vi.fn();
    render(<GroupSourceJsonModal raw={samplePayload} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close source json/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close when pressing Escape', () => {
    const onClose = vi.fn();
    render(<GroupSourceJsonModal raw={samplePayload} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

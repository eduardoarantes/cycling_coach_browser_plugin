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

  describe('backdrop dismissal', () => {
    it('should close when a click starts and ends on the backdrop', () => {
      const onClose = vi.fn();
      const { container } = render(
        <GroupSourceJsonModal raw={samplePayload} onClose={onClose} />
      );

      const backdrop = container.firstElementChild as HTMLElement;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when a selection drag starts inside the JSON and ends on the backdrop', () => {
      const onClose = vi.fn();
      const { container } = render(
        <GroupSourceJsonModal raw={samplePayload} onClose={onClose} />
      );

      const backdrop = container.firstElementChild as HTMLElement;
      const pre = container.querySelector('pre') as HTMLElement;

      // A drag from inside the <pre> released over the backdrop dispatches its
      // click on their common ancestor, which is the backdrop itself.
      fireEvent.mouseDown(pre);
      fireEvent.click(backdrop);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not close when clicking inside the dialog', () => {
      const onClose = vi.fn();
      render(<GroupSourceJsonModal raw={samplePayload} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      fireEvent.mouseDown(dialog);
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('dialog semantics and focus', () => {
    it('should expose modal dialog semantics labelled by its heading', () => {
      render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Source JSON');
    });

    it('should move focus into the dialog on open', () => {
      render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

      expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });

    it('should return focus to the trigger when closed', () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();

      const { unmount } = render(
        <GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />
      );
      expect(document.activeElement).not.toBe(trigger);

      unmount();

      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it('should cycle Tab back to the first control at the end of the dialog', () => {
      render(<GroupSourceJsonModal raw={samplePayload} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', {
        name: /close source json/i,
      });
      const downloadButton = screen.getByRole('button', { name: /download/i });

      downloadButton.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(closeButton);

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(downloadButton);
    });
  });
});

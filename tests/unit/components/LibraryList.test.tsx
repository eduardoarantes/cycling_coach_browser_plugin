import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LibraryList } from '@/popup/components/LibraryList';
import type { Library } from '@/types/api.types';
import type { ApiResponse } from '@/types/api.types';

const mockLibraries: Library[] = [
  {
    exerciseLibraryId: 1,
    libraryName: 'Cycling Workouts',
    ownerId: 123,
    ownerName: 'John Doe',
    imageUrl: null,
    isDefaultContent: false,
  },
  {
    exerciseLibraryId: 2,
    libraryName: 'Running Plans',
    ownerId: 456,
    ownerName: 'Jane Smith',
    imageUrl: null,
    isDefaultContent: false,
  },
  {
    exerciseLibraryId: 3,
    libraryName: 'Strength Training',
    ownerId: 123,
    ownerName: 'John Doe',
    imageUrl: null,
    isDefaultContent: true,
  },
];

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('LibraryList', () => {
  const mockOnSelectLibrary = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful response
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      data: mockLibraries,
    } as ApiResponse<Library[]>);
  });

  describe('Loading State', () => {
    it('should display loading state initially', () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      // Should show loading skeletons or spinner
      const loadingElements = screen.queryAllByRole('status');
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Success State', () => {
    it('should display libraries after loading', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      expect(screen.getByText('Running Plans')).toBeInTheDocument();
      expect(screen.getByText('Strength Training')).toBeInTheDocument();
    });

    it('should display search bar when libraries are loaded', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it('should render correct number of library cards', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        const cards = screen.getAllByRole('button');
        expect(cards).toHaveLength(3);
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter libraries by name', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'Cycling' } });

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
        expect(screen.queryByText('Running Plans')).not.toBeInTheDocument();
      });
    });

    it('should filter libraries by owner name', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'Jane' } });

      await waitFor(() => {
        expect(screen.getByText('Running Plans')).toBeInTheDocument();
        expect(screen.queryByText('Cycling Workouts')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'CYCLING' } });

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });
    });

    it('should show all libraries when search is cleared', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Filter
      fireEvent.change(searchInput, { target: { value: 'Cycling' } });

      await waitFor(() => {
        expect(screen.queryByText('Running Plans')).not.toBeInTheDocument();
      });

      // Clear
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
        expect(screen.getByText('Running Plans')).toBeInTheDocument();
      });
    });

    it('should show empty state when no matches found', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, {
        target: { value: 'NonexistentLibrary' },
      });

      await waitFor(() => {
        expect(screen.getByText(/no libraries found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('should call onSelectLibrary when library card is clicked', async () => {
      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });

      const card = screen.getByText('Cycling Workouts').closest('button');
      fireEvent.click(card!);

      expect(mockOnSelectLibrary).toHaveBeenCalledWith(1);
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Failed to fetch libraries',
        },
      } as ApiResponse<Library[]>);

      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Network error',
        },
      } as ApiResponse<Library[]>);

      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should retry when retry button is clicked', async () => {
      // First call fails
      chrome.runtime.sendMessage = vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          error: {
            code: 'API_ERROR',
            message: 'Network error',
          },
        } as ApiResponse<Library[]>)
        // Second call succeeds
        .mockResolvedValueOnce({
          success: true,
          data: mockLibraries,
        } as ApiResponse<Library[]>);

      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Cycling Workouts')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no libraries exist', async () => {
      chrome.runtime.sendMessage = vi.fn().mockResolvedValue({
        success: true,
        data: [],
      } as ApiResponse<Library[]>);

      renderWithClient(<LibraryList onSelectLibrary={mockOnSelectLibrary} />);

      await waitFor(() => {
        expect(screen.getByText(/no libraries/i)).toBeInTheDocument();
      });
    });
  });
});

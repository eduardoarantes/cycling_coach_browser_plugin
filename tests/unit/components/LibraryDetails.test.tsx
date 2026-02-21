import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { LibraryDetails } from '@/popup/components/LibraryDetails';
import type { LibraryItem } from '@/types/api.types';
import type { ApiResponse } from '@/types/api.types';

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn();
global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
  },
} as never;

describe('LibraryDetails', () => {
  let queryClient: QueryClient;

  const mockWorkouts: LibraryItem[] = [
    {
      exerciseLibraryId: 1,
      exerciseLibraryItemId: 101,
      exerciseLibraryItemType: 'Workout',
      itemName: 'Endurance Ride',
      workoutTypeId: 11,
      distancePlanned: 50000,
      totalTimePlanned: 7200,
      caloriesPlanned: 1200,
      tssPlanned: 85,
      ifPlanned: 0.75,
      velocityPlanned: 25.5,
      energyPlanned: 180,
      elevationGainPlanned: 500,
      description: 'A steady endurance ride.',
      coachComments: 'Keep HR in Zone 2.',
    },
    {
      exerciseLibraryId: 1,
      exerciseLibraryItemId: 102,
      exerciseLibraryItemType: 'Workout',
      itemName: 'Interval Training',
      workoutTypeId: 11,
      distancePlanned: null,
      totalTimePlanned: 3600,
      caloriesPlanned: null,
      tssPlanned: 95,
      ifPlanned: 0.88,
      velocityPlanned: null,
      energyPlanned: null,
      elevationGainPlanned: null,
      description: 'High intensity intervals.',
      coachComments: null,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockSendMessage.mockReset();
  });

  const renderWithClient = (ui: ReactElement): ReturnType<typeof render> => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      mockSendMessage.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should show library header while loading', () => {
      mockSendMessage.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText('My Library')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should display workouts when data loads successfully', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
      });

      expect(screen.getByText('Interval Training')).toBeInTheDocument();
    });

    it('should display correct workout count in header', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2 workouts')).toBeInTheDocument();
      });
    });

    it('should render workouts in grid layout', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        const cards = screen.getAllByRole('button');
        // Should have back button + 2 workout cards
        expect(cards.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should pass correct libraryId to useLibraryItems hook', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={123}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: 'GET_LIBRARY_ITEMS',
          libraryId: 123,
        });
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no workouts exist', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: [],
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no workouts/i)).toBeInTheDocument();
      });
    });

    it('should show helpful message in empty state', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: [],
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/library is empty/i)).toBeInTheDocument();
      });
    });

    it('should show workout count as 0 in header when empty', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: [],
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('0 workouts')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Failed to load workouts',
        },
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Workouts')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Network error',
        },
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should retry fetching when retry button clicked', async () => {
      const errorResponse: ApiResponse<LibraryItem[]> = {
        success: false,
        error: {
          code: 'API_ERROR',
          message: 'Network error',
        },
      };
      const successResponse: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };

      mockSendMessage
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText(/retry/i);
      retryButton.click();

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
      });
    });
  });

  describe('Header Integration', () => {
    it('should render LibraryHeader with correct props', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="Test Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Library')).toBeInTheDocument();
        expect(screen.getByText('2 workouts')).toBeInTheDocument();
      });
    });

    it('should call onBack when back button clicked', async () => {
      const handleBack = vi.fn();
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={handleBack}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      backButton.click();

      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Workout Interaction', () => {
    it('should not navigate to workout details when workout card clicked', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
      });

      // Click should not cause navigation (onClick handler exists but does nothing in Phase 4.3)
      const workoutCard = screen.getByText('Endurance Ride').closest('button');
      workoutCard?.click();

      // Component should still be rendered
      expect(screen.getByText('Endurance Ride')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      const response: ApiResponse<LibraryItem[]> = {
        success: true,
        data: mockWorkouts,
      };
      mockSendMessage.mockResolvedValue(response);

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: 'My Library' });
        expect(heading).toBeInTheDocument();
      });
    });

    it('should have accessible loading state', () => {
      mockSendMessage.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      renderWithClient(
        <LibraryDetails
          libraryId={1}
          libraryName="My Library"
          onBack={vi.fn()}
        />
      );

      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toBeInTheDocument();
    });
  });
});

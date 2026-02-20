/**
 * Unit tests for background message handler
 *
 * Tests message routing and API integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleMessage } from '@/background/messageHandler';
import * as trainingPeaksApi from '@/background/api/trainingPeaks';
import type {
  GetUserMessage,
  GetLibrariesMessage,
  GetLibraryItemsMessage,
} from '@/types';
import type { UserProfile, Library, LibraryItem } from '@/types/api.types';

// Mock the TrainingPeaks API module
vi.mock('@/background/api/trainingPeaks');

describe('messageHandler', () => {
  const mockSender: chrome.runtime.MessageSender = {
    id: 'test-extension-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET_USER message', () => {
    it('should return user data when API call succeeds', async () => {
      // Arrange
      const message: GetUserMessage = { type: 'GET_USER' };
      const mockUserData: UserProfile = {
        userId: 12345,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        timeZone: 'America/New_York',
      };

      vi.spyOn(trainingPeaksApi, 'fetchUser').mockResolvedValue({
        success: true,
        data: mockUserData,
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ success: true, data: mockUserData });
      expect(trainingPeaksApi.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('should return error when API call fails', async () => {
      // Arrange
      const message: GetUserMessage = { type: 'GET_USER' };

      vi.spyOn(trainingPeaksApi, 'fetchUser').mockResolvedValue({
        success: false,
        error: { message: 'Not authenticated', code: 'NO_TOKEN' },
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({
        success: false,
        error: { message: 'Not authenticated', code: 'NO_TOKEN' },
      });
      expect(trainingPeaksApi.fetchUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET_LIBRARIES message', () => {
    it('should return libraries array when API call succeeds', async () => {
      // Arrange
      const message: GetLibrariesMessage = { type: 'GET_LIBRARIES' };
      const mockLibraries: Library[] = [
        {
          exerciseLibraryId: 1,
          libraryName: 'My Workouts',
          ownerId: 12345,
          ownerName: 'John Doe',
          imageUrl: null,
          isDefaultContent: false,
        },
        {
          exerciseLibraryId: 2,
          libraryName: 'TrainingPeaks Workouts',
          ownerId: 1,
          ownerName: 'TrainingPeaks',
          imageUrl: 'https://example.com/image.png',
          isDefaultContent: true,
        },
      ];

      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: true,
        data: mockLibraries,
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ success: true, data: mockLibraries });
      expect(trainingPeaksApi.fetchLibraries).toHaveBeenCalledTimes(1);
    });

    it('should return error when API call fails', async () => {
      // Arrange
      const message: GetLibrariesMessage = { type: 'GET_LIBRARIES' };

      vi.spyOn(trainingPeaksApi, 'fetchLibraries').mockResolvedValue({
        success: false,
        error: { message: 'HTTP 401', status: 401 },
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({
        success: false,
        error: { message: 'HTTP 401', status: 401 },
      });
      expect(trainingPeaksApi.fetchLibraries).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET_LIBRARY_ITEMS message', () => {
    it('should return library items when API call succeeds', async () => {
      // Arrange
      const message: GetLibraryItemsMessage = {
        type: 'GET_LIBRARY_ITEMS',
        libraryId: 123,
      };
      const mockItems: LibraryItem[] = [
        {
          exerciseLibraryId: 123,
          exerciseLibraryItemId: 456,
          exerciseLibraryItemType: 'Workout',
          itemName: 'Interval Training',
          workoutTypeId: 1,
          distancePlanned: 10000,
          totalTimePlanned: 3600,
          caloriesPlanned: 600,
          tssPlanned: 85,
          ifPlanned: 0.85,
          velocityPlanned: 25.5,
          energyPlanned: 2500,
          elevationGainPlanned: 150,
          description: 'Hard interval session',
          coachComments: 'Focus on form',
        },
      ];

      vi.spyOn(trainingPeaksApi, 'fetchLibraryItems').mockResolvedValue({
        success: true,
        data: mockItems,
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ success: true, data: mockItems });
      expect(trainingPeaksApi.fetchLibraryItems).toHaveBeenCalledWith(123);
      expect(trainingPeaksApi.fetchLibraryItems).toHaveBeenCalledTimes(1);
    });

    it('should return error when API call fails', async () => {
      // Arrange
      const message: GetLibraryItemsMessage = {
        type: 'GET_LIBRARY_ITEMS',
        libraryId: 999,
      };

      vi.spyOn(trainingPeaksApi, 'fetchLibraryItems').mockResolvedValue({
        success: false,
        error: { message: 'HTTP 404', status: 404 },
      });

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({
        success: false,
        error: { message: 'HTTP 404', status: 404 },
      });
      expect(trainingPeaksApi.fetchLibraryItems).toHaveBeenCalledWith(999);
      expect(trainingPeaksApi.fetchLibraryItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('existing message types', () => {
    it('should still handle TOKEN_FOUND message', async () => {
      // Arrange
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        auth_token: 'test-token-123',
        token_timestamp: Date.now(),
      });

      global.chrome = {
        storage: {
          local: {
            set: mockSet,
            get: mockGet,
          },
        },
      } as any;

      const message = {
        type: 'TOKEN_FOUND' as const,
        token: 'test-token-123',
        timestamp: Date.now(),
      };

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockSet).toHaveBeenCalled();
    });

    it('should still handle GET_TOKEN message', async () => {
      // Arrange
      const mockToken = 'test-token-123';
      const mockTimestamp = Date.now();

      const mockGet = vi.fn().mockResolvedValue({
        auth_token: mockToken,
        token_timestamp: mockTimestamp,
      });

      global.chrome = {
        storage: {
          local: {
            get: mockGet,
          },
        },
      } as any;

      const message = { type: 'GET_TOKEN' as const };

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({
        token: mockToken,
        timestamp: mockTimestamp,
      });
    });

    it('should still handle CLEAR_TOKEN message', async () => {
      // Arrange
      const mockRemove = vi.fn();

      global.chrome = {
        storage: {
          local: {
            remove: mockRemove,
          },
        },
      } as any;

      const message = { type: 'CLEAR_TOKEN' as const };

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockRemove).toHaveBeenCalledWith([
        'auth_token',
        'token_timestamp',
      ]);
    });

    it('should still handle VALIDATE_TOKEN message', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockGet = vi.fn().mockResolvedValue({ auth_token: mockToken });

      global.chrome = {
        storage: {
          local: {
            get: mockGet,
          },
        },
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { userId: 12345 } }),
      });

      const message = { type: 'VALIDATE_TOKEN' as const };

      // Act
      const result = await handleMessage(message, mockSender);

      // Assert
      expect(result).toEqual({ valid: true, userId: 12345 });
    });
  });
});

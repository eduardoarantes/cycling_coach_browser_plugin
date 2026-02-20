/**
 * Unit tests for TrainingPeaks API client
 *
 * Tests all API methods with mocked fetch and chrome.storage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchUser,
  fetchLibraries,
  fetchLibraryItems,
} from '@/background/api/trainingPeaks';
import type { UserProfile, Library, LibraryItem } from '@/types/api.types';

// Mock chrome.storage.local
const mockGet = vi.fn();
const mockRemove = vi.fn();

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Setup chrome mock
  global.chrome = {
    storage: {
      local: {
        get: mockGet,
        remove: mockRemove,
      },
    },
  } as any;

  // Setup fetch mock
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trainingPeaks API', () => {
  describe('fetchUser', () => {
    it('should return user data when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const mockUserData: UserProfile = {
        userId: 12345,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        timeZone: 'America/New_York',
      };

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUserData }),
      });

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockUserData);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/users/v3/user',
        {
          headers: {
            Authorization: 'Bearer valid-token-123',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Not authenticated');
        expect(result.error.code).toBe('NO_TOKEN');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should clear token and return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
      expect(mockRemove).toHaveBeenCalledWith([
        'auth_token',
        'token_timestamp',
      ]);
    });

    it('should return error on 404 response', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should return error on invalid JSON response', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'data' }), // Missing 'user' wrapper
      });

      // Act
      const result = await fetchUser();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });

  describe('fetchLibraries', () => {
    it('should return libraries array when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
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

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockLibraries,
      });

      // Act
      const result = await fetchLibraries();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockLibraries);
        expect(result.data).toHaveLength(2);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/exerciselibrary/v2/libraries',
        {
          headers: {
            Authorization: 'Bearer valid-token-123',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchLibraries();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_TOKEN');
      }
    });

    it('should clear token and return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchLibraries();

      // Assert
      expect(result.success).toBe(false);
      expect(mockRemove).toHaveBeenCalledWith([
        'auth_token',
        'token_timestamp',
      ]);
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Connection refused'));

      // Act
      const result = await fetchLibraries();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Connection refused');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ invalid: 'schema' }],
      });

      // Act
      const result = await fetchLibraries();

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });

  describe('fetchLibraryItems', () => {
    it('should return library items when API call succeeds', async () => {
      // Arrange
      const libraryId = 123;
      const mockToken = 'valid-token-123';
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

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockItems,
      });

      // Act
      const result = await fetchLibraryItems(libraryId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockItems);
        expect(result.data).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/exerciselibrary/v2/libraries/123/items',
        {
          headers: {
            Authorization: 'Bearer valid-token-123',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return error when no token exists', async () => {
      // Arrange
      mockGet.mockResolvedValue({});

      // Act
      const result = await fetchLibraryItems(123);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_TOKEN');
      }
    });

    it('should clear token and return error on 401 response', async () => {
      // Arrange
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const result = await fetchLibraryItems(123);

      // Assert
      expect(result.success).toBe(false);
      expect(mockRemove).toHaveBeenCalledWith([
        'auth_token',
        'token_timestamp',
      ]);
    });

    it('should return error on 404 (library not found)', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act
      const result = await fetchLibraryItems(999);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should return error on network failure', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockRejectedValue(new Error('Timeout'));

      // Act
      const result = await fetchLibraryItems(123);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Timeout');
      }
    });

    it('should return error on invalid response schema', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ missing: 'required fields' }],
      });

      // Act
      const result = await fetchLibraryItems(123);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('validation');
      }
    });
  });
});

/**
 * Unit tests for TrainingPeaks Athlete Groups (coach tags) API function
 *
 * Tests fetchAthleteGroups with mocked fetch and chrome.storage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchAthleteGroups } from '@/background/api/trainingPeaks';
import type { AthleteGroup } from '@/schemas/athleteGroup.schema';

// Mock chrome.storage.local
const mockGet = vi.fn();
const mockRemove = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  global.chrome = {
    storage: {
      local: {
        get: mockGet,
        remove: mockRemove,
      },
    },
  } as any;

  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trainingPeaks Athlete Groups API', () => {
  describe('fetchAthleteGroups', () => {
    it('should return athlete groups when API call succeeds', async () => {
      // Arrange
      const mockToken = 'valid-token-123';
      const coachId = 6469888;
      const mockGroups: AthleteGroup[] = [
        {
          id: 340276,
          coachId,
          name: 'My Athletes',
          athleteIds: [],
          isDefault: true,
        },
        {
          id: 340617,
          coachId,
          name: 'Group1',
          athleteIds: [6469889],
          isDefault: false,
        },
      ];

      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGroups,
      });

      // Act
      const result = await fetchAthleteGroups(coachId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockGroups);
        expect(result.data[1].athleteIds).toHaveLength(1);
      }
      expect(global.fetch).toHaveBeenCalledWith(
        'https://tpapi.trainingpeaks.com/coaches/v2/coaches/6469888/tags',
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer valid-token-123',
          }),
        })
      );
    });

    it('should return an empty array when the coach has no groups', async () => {
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const result = await fetchAthleteGroups(123);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return error when no token exists', async () => {
      mockGet.mockResolvedValue({});

      const result = await fetchAthleteGroups(6469888);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Not authenticated');
        expect(result.error.code).toBe('NO_TOKEN');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return error and clear token on 401 response', async () => {
      const mockToken = 'invalid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await fetchAthleteGroups(6469888);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
      }
      expect(mockRemove).toHaveBeenCalledWith([
        'auth_token',
        'token_timestamp',
      ]);
    });

    it('should return a validation error when the response shape is invalid', async () => {
      const mockToken = 'valid-token-123';
      mockGet.mockResolvedValue({ auth_token: mockToken });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: 'not-a-number', name: 'Bad' }],
      });

      const result = await fetchAthleteGroups(6469888);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});

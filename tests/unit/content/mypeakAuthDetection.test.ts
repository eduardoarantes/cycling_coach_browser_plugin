import { describe, it, expect } from 'vitest';
import {
  isMyPeakSupabaseRequest,
  MYPEAK_SUPABASE_HOSTS,
  MYPEAK_APP_HOSTS,
} from '@/content/mypeakAuthDetection';

describe('mypeakAuthDetection', () => {
  describe('isMyPeakSupabaseRequest', () => {
    it('should match the production Supabase project host', () => {
      expect(
        isMyPeakSupabaseRequest(
          'https://nwvtltfibnkdogdeeluh.supabase.co/auth/v1/user'
        )
      ).toBe(true);
    });

    it('should match the production portal app origin (api/backend traffic)', () => {
      expect(
        isMyPeakSupabaseRequest(
          'https://portal.planmypeak.com/api/backend/athletes'
        )
      ).toBe(true);
    });

    it('should match local Supabase auth endpoints on any localhost port', () => {
      expect(
        isMyPeakSupabaseRequest('http://127.0.0.1:54331/auth/v1/user')
      ).toBe(true);
      expect(
        isMyPeakSupabaseRequest('http://localhost:54361/rest/v1/workouts')
      ).toBe(true);
    });

    it('should NOT match the retired Supabase project host', () => {
      expect(
        isMyPeakSupabaseRequest(
          'https://yqaskiwzyhhovthbvmqq.supabase.co/auth/v1/user'
        )
      ).toBe(false);
    });

    it('should NOT match the retired bare planmypeak.com host', () => {
      expect(
        isMyPeakSupabaseRequest('https://planmypeak.com/api/backend/athletes')
      ).toBe(false);
    });

    it('should NOT match unrelated hosts', () => {
      expect(
        isMyPeakSupabaseRequest('https://tpapi.trainingpeaks.com/users/v3/user')
      ).toBe(false);
      expect(
        isMyPeakSupabaseRequest('https://intervals.icu/api/v1/athlete')
      ).toBe(false);
    });
  });

  describe('host constants', () => {
    it('should target the new Supabase project, not the retired one', () => {
      expect(MYPEAK_SUPABASE_HOSTS).toContain(
        'nwvtltfibnkdogdeeluh.supabase.co'
      );
      expect(MYPEAK_SUPABASE_HOSTS).not.toContain(
        'yqaskiwzyhhovthbvmqq.supabase.co'
      );
    });

    it('should target the portal app origin', () => {
      expect(MYPEAK_APP_HOSTS).toContain('portal.planmypeak.com');
    });
  });
});

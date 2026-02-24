import { describe, it, expect } from 'vitest';
import {
  generateCurlCommand,
  formatCurlForConsole,
} from '@/utils/curlGenerator';

describe('curlGenerator', () => {
  describe('generateCurlCommand', () => {
    it('should generate GET request without headers or body', () => {
      const url = 'https://api.example.com/data';
      const curl = generateCurlCommand(url);

      expect(curl).toBe('curl \\\n  "https://api.example.com/data"');
    });

    it('should generate POST request with method', () => {
      const url = 'https://api.example.com/data';
      const options: { method: string } = { method: 'POST' };
      const curl = generateCurlCommand(url, options);

      expect(curl).toContain('-X POST');
      expect(curl).toContain('"https://api.example.com/data"');
    });

    it('should include headers in the curl command', () => {
      const url = 'https://api.example.com/data';
      const options: {
        method: string;
        headers: Record<string, string>;
      } = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        },
      };
      const curl = generateCurlCommand(url, options);

      expect(curl).toContain('-H "Content-Type: application/json"');
      expect(curl).toContain('-H "Authorization: Bearer token123"');
    });

    it('should include JSON body in the curl command', () => {
      const url = 'https://api.example.com/data';
      const body = { name: 'Test', value: 123 };
      const options: {
        method: string;
        headers: Record<string, string>;
        body: string;
      } = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body, null, 2),
      };
      const curl = generateCurlCommand(url, options);

      expect(curl).toContain("-d '");
      expect(curl).toContain('"name": "Test"');
      expect(curl).toContain('"value": 123');
    });

    it('should escape single quotes in body', () => {
      const url = 'https://api.example.com/data';
      const options: {
        method: string;
        body: string;
      } = {
        method: 'POST',
        body: "{'key': 'value'}",
      };
      const curl = generateCurlCommand(url, options);

      // Single quotes should be escaped for shell safety
      expect(curl).toContain("'\\'");
    });

    it('should generate complete curl for Intervals.icu request', () => {
      const url =
        'https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true';
      const apiKey = 'test-api-key-123';
      const auth = btoa(`API_KEY:${apiKey}`);
      const payloads = [
        {
          category: 'WORKOUT',
          start_date_local: '2024-01-15T00:00:00',
          type: 'Ride',
          name: 'Test Workout',
          description: 'Test description',
          moving_time: 3600,
          icu_training_load: 100,
          external_id: 'tp_123456',
        },
      ];

      const options: {
        method: string;
        headers: Record<string, string>;
        body: string;
      } = {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloads, null, 2),
      };

      const curl = generateCurlCommand(url, options);

      // Verify all components are present
      expect(curl).toContain('-X POST');
      expect(curl).toContain('-H "Authorization: Basic');
      expect(curl).toContain('-H "Content-Type: application/json"');
      expect(curl).toContain("-d '");
      expect(curl).toContain('"category": "WORKOUT"');
      expect(curl).toContain('"name": "Test Workout"');
      expect(curl).toContain(
        '"https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true"'
      );
    });
  });

  describe('formatCurlForConsole', () => {
    it('should wrap curl command in formatted box', () => {
      const curlCommand = 'curl -X POST "https://api.example.com"';
      const formatted = formatCurlForConsole(curlCommand);

      expect(formatted).toContain('╭─');
      expect(formatted).toContain('cURL Command');
      expect(formatted).toContain(curlCommand);
    });
  });
});

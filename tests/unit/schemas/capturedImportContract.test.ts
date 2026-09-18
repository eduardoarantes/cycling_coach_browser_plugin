/**
 * The captured-workout import contract, pinned to the fixture the PlanMyPeak
 * app also tests against. A change that makes one of these fail is a protocol
 * change and has to land in both repositories.
 */

import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/siteControl/captured-imports.json';
import { parseSiteControlRequest } from '@/schemas/siteControl.schema';
import {
  CapturedWorkoutImportStatusResultSchema,
  CapturedWorkoutSummaryResultSchema,
  ImportMissingWorkoutsResultSchema,
} from '@/schemas/capturedImportContract';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_REQUEST_TYPES,
} from '@/types/siteControl.types';

describe('captured-workout import contract fixture', () => {
  it('is written for the protocol version this build speaks', () => {
    expect(fixture.protocolVersion).toBe(PLANMYPEAK_SITE_CONTROL_VERSION);
  });

  it('names request types this build serves', () => {
    for (const type of fixture.requestTypes) {
      expect(SITE_CONTROL_REQUEST_TYPES).toContain(type);
    }
  });

  describe('requests', () => {
    it.each(fixture.requests.valid.map((entry) => [entry.name, entry]))(
      'accepts %s',
      (_name, entry) => {
        const result = parseSiteControlRequest(entry.envelope);

        expect(result.outcome).toBe('ok');
        if (result.outcome !== 'ok') return;
        expect(result.request.type).toBe(entry.envelope.type);
        expect(result.request.requestId).toBe(entry.envelope.requestId);
      }
    );

    it.each(fixture.requests.invalid.map((entry) => [entry.name, entry]))(
      'rejects %s',
      (_name, entry) => {
        const result = parseSiteControlRequest(entry.envelope);

        expect(result.outcome).toBe('error');
        if (result.outcome !== 'error') return;
        expect(result.error.code).toBe(entry.expectedCode);
        expect(result.requestId).toBe(entry.envelope.requestId);
      }
    );

    it('keeps exactly the two handles on an import start', () => {
      const [start] = fixture.requests.valid.filter(
        (entry) => entry.envelope.type === 'IMPORT_MISSING_WORKOUTS'
      );
      const result = parseSiteControlRequest(start.envelope);

      expect(result.outcome).toBe('ok');
      if (result.outcome !== 'ok') return;
      expect(result.request.payload).toEqual(start.envelope.payload);
    });
  });

  describe('summary result', () => {
    it.each(fixture.summary.valid.map((entry) => [entry.name, entry.data]))(
      'accepts %s',
      (_name, data) => {
        expect(CapturedWorkoutSummaryResultSchema.safeParse(data).success).toBe(
          true
        );
      }
    );

    it.each(fixture.summary.invalid.map((entry) => [entry.name, entry.data]))(
      'rejects %s',
      (_name, data) => {
        expect(CapturedWorkoutSummaryResultSchema.safeParse(data).success).toBe(
          false
        );
      }
    );
  });

  describe('import start result', () => {
    it.each(fixture.importStart.valid.map((entry) => [entry.name, entry.data]))(
      'accepts %s',
      (_name, data) => {
        expect(ImportMissingWorkoutsResultSchema.safeParse(data).success).toBe(
          true
        );
      }
    );

    it.each(
      fixture.importStart.invalid.map((entry) => [entry.name, entry.data])
    )('rejects %s', (_name, data) => {
      expect(ImportMissingWorkoutsResultSchema.safeParse(data).success).toBe(
        false
      );
    });
  });

  describe('import status result', () => {
    it.each(
      fixture.importStatus.valid.map((entry) => [entry.name, entry.data])
    )('accepts %s', (_name, data) => {
      expect(
        CapturedWorkoutImportStatusResultSchema.safeParse(data).success
      ).toBe(true);
    });

    it.each(
      fixture.importStatus.invalid.map((entry) => [entry.name, entry.data])
    )('rejects %s', (_name, data) => {
      expect(
        CapturedWorkoutImportStatusResultSchema.safeParse(data).success
      ).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  createErrorResponse,
  createImportCompletedEvent,
  createSuccessResponse,
  parseSiteControlRequest,
} from '@/schemas/siteControl.schema';
import {
  PLANMYPEAK_SITE_CONTROL_VERSION,
  SITE_CONTROL_EXTENSION_SOURCE,
  SITE_CONTROL_PAGE_SOURCE,
} from '@/types/siteControl.types';

function envelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    source: SITE_CONTROL_PAGE_SOURCE,
    version: PLANMYPEAK_SITE_CONTROL_VERSION,
    requestId: 'req-1',
    type: 'PING',
    payload: {},
    ...overrides,
  };
}

describe('parseSiteControlRequest', () => {
  describe('valid requests', () => {
    it('should parse a PING request', () => {
      const result = parseSiteControlRequest(envelope());

      expect(result.outcome).toBe('ok');
      if (result.outcome !== 'ok') return;
      expect(result.request.type).toBe('PING');
      expect(result.request.requestId).toBe('req-1');
    });

    it('should parse a no-argument request with the payload key omitted', () => {
      const raw = envelope({ type: 'GET_LIBRARIES' }) as Record<
        string,
        unknown
      >;
      delete raw.payload;

      const result = parseSiteControlRequest(raw);

      expect(result.outcome).toBe('ok');
    });

    it('should parse GET_LIBRARY_ITEMS with a library id', () => {
      const result = parseSiteControlRequest(
        envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 42 } })
      );

      expect(result.outcome).toBe('ok');
      if (result.outcome !== 'ok') return;
      expect(result.request.payload).toEqual({ libraryId: 42 });
    });

    it('should parse GET_PLAN_CONTENTS with a plan id', () => {
      const result = parseSiteControlRequest(
        envelope({ type: 'GET_PLAN_CONTENTS', payload: { planId: 7 } })
      );

      expect(result.outcome).toBe('ok');
    });

    it('should parse OPEN_IMPORTER with an optional pre-selection', () => {
      const withSelection = parseSiteControlRequest(
        envelope({ type: 'OPEN_IMPORTER', payload: { libraryId: 3 } })
      );
      const withoutSelection = parseSiteControlRequest(
        envelope({ type: 'OPEN_IMPORTER', payload: {} })
      );

      expect(withSelection.outcome).toBe('ok');
      expect(withoutSelection.outcome).toBe('ok');
    });
  });

  describe('messages that are not ours', () => {
    it('should ignore a message with a foreign source marker', () => {
      const result = parseSiteControlRequest(
        envelope({ source: 'trainingpeaks-extension-main' })
      );

      expect(result.outcome).toBe('ignore');
    });

    it('should ignore a message with no source marker', () => {
      expect(parseSiteControlRequest({ type: 'PING' }).outcome).toBe('ignore');
    });

    it('should ignore non-object messages', () => {
      expect(parseSiteControlRequest('PING').outcome).toBe('ignore');
      expect(parseSiteControlRequest(null).outcome).toBe('ignore');
      expect(parseSiteControlRequest(undefined).outcome).toBe('ignore');
    });

    it('should ignore a control envelope with no usable request id', () => {
      // Without a request id the response could not be correlated, so there is
      // nothing meaningful to answer.
      expect(parseSiteControlRequest(envelope({ requestId: '' })).outcome).toBe(
        'ignore'
      );
    });
  });

  describe('invalid requests', () => {
    it('should reject an unsupported protocol version', () => {
      const result = parseSiteControlRequest(envelope({ version: 99 }));

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('UNSUPPORTED_VERSION');
      expect(result.requestId).toBe('req-1');
    });

    it('should reject a missing protocol version', () => {
      const raw = envelope() as Record<string, unknown>;
      delete raw.version;

      const result = parseSiteControlRequest(raw);

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('UNSUPPORTED_VERSION');
    });

    it('should reject an unknown request type', () => {
      const result = parseSiteControlRequest(envelope({ type: 'GET_TOKEN' }));

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('UNSUPPORTED_REQUEST_TYPE');
    });

    it('should reject a runtime message type that is not site-controllable', () => {
      const result = parseSiteControlRequest(
        envelope({ type: 'GET_INTERVALS_API_KEY' })
      );

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('UNSUPPORTED_REQUEST_TYPE');
    });

    it('should reject a malformed payload', () => {
      const result = parseSiteControlRequest(
        envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 'abc' } })
      );

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('INVALID_REQUEST');
    });

    it('should reject a missing required payload field', () => {
      const result = parseSiteControlRequest(
        envelope({ type: 'GET_PLAN_CONTENTS', payload: {} })
      );

      expect(result.outcome).toBe('error');
      if (result.outcome !== 'error') return;
      expect(result.error.code).toBe('INVALID_REQUEST');
    });

    it('should reject non-positive identifiers', () => {
      expect(
        parseSiteControlRequest(
          envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 0 } })
        ).outcome
      ).toBe('error');
      expect(
        parseSiteControlRequest(
          envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: -5 } })
        ).outcome
      ).toBe('error');
      expect(
        parseSiteControlRequest(
          envelope({ type: 'GET_LIBRARY_ITEMS', payload: { libraryId: 1.5 } })
        ).outcome
      ).toBe('error');
    });
  });
});

describe('response builders', () => {
  it('should echo the request id and stamp the extension source on success', () => {
    const response = createSuccessResponse('req-9', { hello: 'world' });

    expect(response).toEqual({
      source: SITE_CONTROL_EXTENSION_SOURCE,
      version: PLANMYPEAK_SITE_CONTROL_VERSION,
      requestId: 'req-9',
      ok: true,
      data: { hello: 'world' },
    });
  });

  it('should echo the request id and stamp the extension source on error', () => {
    const response = createErrorResponse('req-9', {
      code: 'API_ERROR',
      message: 'upstream failed',
    });

    expect(response.ok).toBe(false);
    expect(response.requestId).toBe('req-9');
    expect(response.source).toBe(SITE_CONTROL_EXTENSION_SOURCE);
  });

  it('should build an import completed event carrying counts only', () => {
    const event = createImportCompletedEvent('req-9', {
      ok: true,
      importedCount: 12,
      failedCount: 0,
    });

    expect(event.type).toBe('IMPORT_COMPLETED');
    expect(event.payload).toEqual({
      ok: true,
      importedCount: 12,
      failedCount: 0,
    });
    expect(Object.keys(event.payload)).toEqual([
      'ok',
      'importedCount',
      'failedCount',
    ]);
  });
});

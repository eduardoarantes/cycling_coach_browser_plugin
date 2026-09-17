/**
 * Main world interceptor - runs in page's JavaScript context
 *
 * This script runs with world: "MAIN" in Manifest V3, bypassing CSP restrictions.
 * It intercepts fetch/XHR and uses postMessage to send tokens to the isolated world.
 */

import { isMyPeakSupabaseRequest } from './mypeakAuthDetection';
import {
  extractRequestInfo,
  extractRequestMethod,
  toAbsoluteUrl,
} from './requestInfo';
import {
  matchTrainingPeaksWorkoutWrite,
  readJsonBody,
  readWorkoutIdFromResponse,
  safeParseJson,
  takeRequestBodyHandle,
  type TrainingPeaksWorkoutWriteMatch,
} from './workoutCaptureDetection';

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log('[TP Extension - MAIN World]', ...args);
};

/**
 * Detect TrainingPeaks API calls for either environment (production or sandbox),
 * so the bearer token is captured regardless of the active environment.
 */
function isTrainingPeaksApiUrl(url: string): boolean {
  return (
    url.includes('tpapi.trainingpeaks.com') ||
    url.includes('tpapi.sandbox.trainingpeaks.com')
  );
}

function maybePostMyPeakSupabaseAuth(
  url: string,
  headers: Headers,
  context: 'fetch' | 'xhr'
): void {
  if (!isMyPeakSupabaseRequest(url)) {
    return;
  }

  const authHeader = headers.get('authorization');
  const apiKey = headers.get('apikey');
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

  // Supabase login requests often use Authorization: Bearer <anon apikey>.
  // We only store a MyPeak user token when it differs from the anon key, or
  // when the request is clearly a user validation endpoint.
  const isUserEndpoint = url.includes('/auth/v1/user');
  const isUserToken =
    !!bearerToken &&
    (isUserEndpoint || (apiKey ? bearerToken !== apiKey : true));

  if (!apiKey && !isUserToken) {
    return;
  }

  log('  🧩 MyPeak/Supabase auth headers detected:', context, url);
  log('  🔑 apikey present:', !!apiKey);
  log('  🎫 user bearer present:', !!isUserToken);

  window.postMessage(
    {
      type: 'MY_PEAK_AUTH_FOUND',
      token: isUserToken ? bearerToken : null,
      apiKey: apiKey || null,
      timestamp: Date.now(),
      source: 'trainingpeaks-extension-main',
    },
    '*'
  );

  log('  ✅ Posted MyPeak auth details to isolated world');
}

/**
 * Post a captured TrainingPeaks workout write to the isolated world.
 *
 * Carries the parsed request and response bodies, the ids, the kind and a
 * timestamp — never request headers, so no credential can cross here. A
 * create whose response carries no numeric `workoutId` is dropped: without a
 * stable identity nothing downstream could store or upsert it.
 */
function postWorkoutCapture(
  match: TrainingPeaksWorkoutWriteMatch,
  request: unknown,
  response: unknown,
  context: 'fetch' | 'xhr'
): void {
  const workoutId = match.workoutId ?? readWorkoutIdFromResponse(response);
  if (workoutId === null) {
    log('  ⏭️ Workout capture skipped: no workout id in response', context);
    return;
  }

  window.postMessage(
    {
      type:
        match.kind === 'create' ? 'TP_WORKOUT_CREATED' : 'TP_WORKOUT_UPDATED',
      kind: match.kind,
      athleteId: match.athleteId,
      workoutId,
      request,
      response,
      timestamp: Date.now(),
      source: 'trainingpeaks-extension-main',
    },
    '*'
  );

  log('  ✅ Posted workout capture to isolated world', context, match.kind);
}

log('🚀 Main world interceptor loading...');

// Store original fetch
const originalFetch = window.fetch;
let fetchCount = 0;

// Intercept fetch
window.fetch = async function (...args) {
  fetchCount++;
  const { urlStr: rawUrl, headers } = extractRequestInfo(args[0], args[1]);
  // Resolve relative URLs (e.g. fetch('/api/backend/...')) against the page
  // origin so host-based detection can match them.
  const urlStr = toAbsoluteUrl(rawUrl, document.baseURI);

  log('📡 Fetch request #' + fetchCount + ':', urlStr);

  const authHeader = headers.get('authorization');

  log('  ✓ Authorization:', authHeader ? 'present' : 'none');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Only capture TrainingPeaks encrypted tokens (start with "gAAAA")
    // NOT JWT tokens (start with "eyJ")
    const isEncryptedToken = token.startsWith('gAAAA');
    const isApiCall = isTrainingPeaksApiUrl(urlStr);

    log('  🎫 Bearer token detected', {
      length: token.length,
      tokenType: isEncryptedToken ? 'encrypted' : 'jwt',
      isApiCall,
    });

    if (isEncryptedToken && isApiCall) {
      log('  ✅ Valid TrainingPeaks API token! Posting to isolated world...');

      // Send token to isolated world content script via postMessage
      window.postMessage(
        {
          type: 'TP_TOKEN_FOUND',
          token: token,
          timestamp: Date.now(),
          source: 'trainingpeaks-extension-main',
        },
        '*'
      );

      log('  ✅ Token posted');
    } else {
      log('  ⏭️ Skipping non-TrainingPeaks token candidate');
    }
  }

  maybePostMyPeakSupabaseAuth(urlStr, headers, 'fetch');

  const captureMatch = matchTrainingPeaksWorkoutWrite(
    extractRequestMethod(args[0], args[1]),
    urlStr
  );
  if (!captureMatch) {
    return originalFetch.apply(this, args);
  }

  // Take a handle on the request body synchronously — a Request is cloned,
  // a string is kept as is — and dispatch the original fetch at once. Nothing
  // is awaited before dispatch, so the page's request goes out exactly when
  // it would have without the interceptor.
  let bodyHandle: string | Request | undefined;
  try {
    bodyHandle = takeRequestBodyHandle(args[0], args[1]);
  } catch (error) {
    log('  ⚠️ Could not take workout request body handle:', error);
    bodyHandle = undefined;
  }

  const response = await originalFetch.apply(this, args);

  // The page gets the original response back immediately. The bodies are read
  // off a clone on a detached promise, concurrently with the page's own
  // consumption; any failure in that path is logged and swallowed.
  try {
    if (response.ok) {
      const responseClone = response.clone();
      void Promise.all([readJsonBody(bodyHandle), responseClone.json()])
        .then(([requestBody, responseBody]) => {
          postWorkoutCapture(captureMatch, requestBody, responseBody, 'fetch');
        })
        .catch((error) => {
          log('  ⚠️ Workout capture failed (fetch):', error);
        });
    } else {
      log('  ⏭️ Workout write not captured: status', response.status);
    }
  } catch (error) {
    log('  ⚠️ Workout capture setup failed (fetch):', error);
  }

  return response;
};

// Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const originalXHRSend = XMLHttpRequest.prototype.send;
const xhrHeaders = new WeakMap<XMLHttpRequest, Map<string, string>>();
/** String bodies passed to send(), for workout-write capture. */
const xhrBodies = new WeakMap<XMLHttpRequest, string>();
let xhrCount = 0;

XMLHttpRequest.prototype.send = function (
  body?: Document | XMLHttpRequestBodyInit | null
) {
  // Only string bodies are parsed; anything else is skipped.
  if (typeof body === 'string') {
    xhrBodies.set(this, body);
  }

  return originalXHRSend.call(this, body);
};

/**
 * The response body of a loaded XHR as JSON, honouring `responseType`.
 * `responseText` throws for a non-text responseType, so `json` is read from
 * `response` instead and anything else is skipped.
 */
function readXhrResponseJson(xhr: XMLHttpRequest): unknown {
  if (xhr.responseType === 'json') {
    return xhr.response as unknown;
  }
  if (xhr.responseType === '' || xhr.responseType === 'text') {
    return safeParseJson(xhr.responseText);
  }
  return undefined;
}

XMLHttpRequest.prototype.setRequestHeader = function (
  header: string,
  value: string
) {
  if (!xhrHeaders.has(this)) {
    xhrHeaders.set(this, new Map());
  }
  xhrHeaders.get(this)!.set(header.toLowerCase(), value);

  if (header.toLowerCase() === 'authorization') {
    log('  🔑 XHR Authorization header set');
  }

  return originalXHRSetRequestHeader.apply(this, [header, value]);
};

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
) {
  xhrCount++;
  const xhrUrlAbs = toAbsoluteUrl(url.toString(), document.baseURI);
  log('📡 XHR request #' + xhrCount + ':', method, xhrUrlAbs);

  const captureMatch = matchTrainingPeaksWorkoutWrite(method, xhrUrlAbs);
  if (captureMatch) {
    // `load` fires after the page's own handlers have been queued and never
    // blocks them; a failure here is logged and swallowed.
    this.addEventListener('load', function () {
      try {
        if (this.status < 200 || this.status >= 300) {
          log('  ⏭️ Workout write not captured (XHR): status', this.status);
          return;
        }

        const requestBody = xhrBodies.get(this);
        const requestJson =
          requestBody !== undefined ? safeParseJson(requestBody) : undefined;
        const responseJson = readXhrResponseJson(this);
        if (responseJson === undefined) {
          log('  ⏭️ Workout write not captured (XHR): unreadable response');
          return;
        }

        postWorkoutCapture(captureMatch, requestJson, responseJson, 'xhr');
      } catch (error) {
        log('  ⚠️ Workout capture failed (XHR):', error);
      }
    });
  }

  this.addEventListener('loadstart', function () {
    const headers = xhrHeaders.get(this);
    if (headers) {
      maybePostMyPeakSupabaseAuth(
        xhrUrlAbs,
        new Headers(Array.from(headers.entries())),
        'xhr'
      );

      const authHeader = headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Only capture TrainingPeaks encrypted tokens (start with "gAAAA")
        // NOT JWT tokens (start with "eyJ")
        const isEncryptedToken = token.startsWith('gAAAA');
        const isApiCall = isTrainingPeaksApiUrl(url.toString());

        log('  🎫 BEARER TOKEN FOUND (XHR)! Length:', token.length);
        log(
          '  🔍 Token type:',
          isEncryptedToken ? 'Encrypted (gAAAA)' : 'JWT (eyJ)'
        );
        log('  🌐 API call:', isApiCall ? 'YES' : 'NO');

        if (isEncryptedToken && isApiCall) {
          log('  ✅ Valid TrainingPeaks API token! Posting...');

          window.postMessage(
            {
              type: 'TP_TOKEN_FOUND',
              token: token,
              timestamp: Date.now(),
              source: 'trainingpeaks-extension-main',
            },
            '*'
          );

          log('  ✅ Token posted (XHR)');
        } else {
          log('  ⏭️ Skipping non-TrainingPeaks token candidate');
        }
      }
    }
  });

  return originalXHROpen.call(
    this,
    method,
    url,
    async ?? true,
    username,
    password
  );
};

log('✅ Interceptors installed in MAIN world (bypassed CSP)');

export {};

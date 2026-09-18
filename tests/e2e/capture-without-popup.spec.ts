/** Real extension runtime with synthetic HTTP responses; no live accounts used. */
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const portal = 'https://portal.planmypeak.com';
const tp = 'https://app.trainingpeaks.com';
const dist = path.resolve('dist');

async function launch(profile: string): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    headless: true,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest()) {
      await route.fulfill({
        contentType: 'text/html',
        body: '<html><body>Capture test</body></html>',
      });
    } else {
      await route.fulfill({
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
        },
        body: JSON.stringify(
          url.pathname.endsWith('/coaches/me')
            ? { id: 'test-coach' }
            : { workoutId: 123 }
        ),
      });
    }
  });
  return context;
}

async function worker(context: BrowserContext) {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  );
}

for (const cached of [true, false]) {
  test(`captures without a popup or live extension tokens (cached coach: ${cached})`, async () => {
    const profile = await mkdtemp(path.join(tmpdir(), 'pmp-capture-'));
    let context = await launch(profile);
    try {
      let background = await worker(context);
      await background.evaluate(
        async ({ cached, portal }) => {
          await chrome.storage.local.set({
            planmypeak_environment: 'production',
            connection_enable_planmypeak: true,
            auth_token: 'expired-test-token',
            token_timestamp: 1,
            mypeak_auth_token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.test',
            mypeak_token_timestamp: 1,
            ...(cached
              ? {
                  capture_coach_cache: {
                    version: 1,
                    coachId: 'test-coach',
                    destination: portal,
                    verifiedAt: 1,
                  },
                }
              : {}),
          });
        },
        { cached, portal }
      );
      // Restart the browser/worker and retain only durable extension state.
      await context.close();
      context = await launch(profile);
      background = await worker(context);
      const page = await context.newPage();
      await page.goto(tp);
      await page.waitForFunction(
        () => !window.fetch.toString().includes('[native code]')
      );
      await page.evaluate(async () => {
        const result = await fetch(
          'https://tpapi.trainingpeaks.com/fitness/v6/athletes/1/workouts',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: 'Test capture',
              workoutDay: '2026-09-18',
              workoutTypeValueId: 2,
            }),
          }
        );
        if (!result.ok) throw new Error('save failed');
      });
      const read = () =>
        background.evaluate(
          async () =>
            (await chrome.storage.local.get('captured_workouts'))
              .captured_workouts
        );
      await expect
        .poll(async () => (await read())?.['production:1:123']?.status)
        .toBe('pending');
      expect((await read())['production:1:123'].owner).toEqual(
        cached ? { coachId: 'test-coach', destination: portal } : undefined
      );
      await expect
        .poll(() => background.evaluate(() => chrome.action.getBadgeText({})))
        .toBe('1');
      await page.goto(portal);
      await page.waitForFunction(
        () => !window.fetch.toString().includes('[native code]')
      );
      const summary = await page.evaluate(
        () =>
          new Promise<Record<string, unknown>>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('summary timed out')),
              5000
            );
            window.addEventListener('message', function receive(event) {
              if (
                event.data?.source !== 'planmypeak-extension' ||
                event.data?.requestId !== 'capture-test'
              )
                return;
              clearTimeout(timer);
              window.removeEventListener('message', receive);
              resolve(event.data);
            });
            window.postMessage(
              {
                source: 'planmypeak-site-control',
                version: 1,
                requestId: 'capture-test',
                type: 'GET_CAPTURED_WORKOUT_SUMMARY',
                payload: {},
              },
              location.origin
            );
          })
      );
      expect(summary).toMatchObject({
        ok: true,
        data: { state: 'blocked', missingCount: null, pendingCount: 1 },
      });
      if (!cached) {
        await page.evaluate(async () => {
          const token = `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`;
          await fetch('/api/backend/coaches/me', {
            headers: { authorization: `Bearer ${token}` },
          });
        });
        await expect
          .poll(async () => (await read())['production:1:123'].owner)
          .toEqual({ coachId: 'test-coach', destination: portal });
      }
      expect(
        context.pages().some((tab) => tab.url().startsWith('chrome-extension:'))
      ).toBe(false);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  });
}

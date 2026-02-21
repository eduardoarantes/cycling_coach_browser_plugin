/**
 * E2E test to verify token interception is working with the new injection method
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load extension in a persistent context
 */
async function loadExtension(): Promise<BrowserContext> {
  const pathToExtension = path.join(__dirname, '../../dist');

  const context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  return context;
}

test.describe('Token Interception with Main World Injection', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await loadExtension();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should inject script into main world and intercept tokens', async () => {
    const page = await context.newPage();

    // Array to collect console messages
    const consoleLogs: string[] = [];

    // Listen for console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log('CONSOLE:', text);
    });

    // Navigate to TrainingPeaks
    console.log('\n📍 Navigating to TrainingPeaks...');
    await page.goto('https://app.trainingpeaks.com');
    await page.waitForTimeout(2000); // Wait for scripts to load

    console.log('\n✅ Page loaded, checking for extension logs...\n');

    // Check that isolated world bridge loaded
    const hasIsolatedWorldLog = consoleLogs.some((log) =>
      log.includes('[TP Extension - ISOLATED World]')
    );
    console.log('Has isolated world bridge logs:', hasIsolatedWorldLog);

    // Check that MAIN world script loaded (THIS IS THE KEY FIX)
    const hasMainWorldScriptLog = consoleLogs.some((log) =>
      log.includes('[TP Extension - MAIN World]')
    );
    console.log('Has MAIN world script logs:', hasMainWorldScriptLog);

    // Check for specific initialization logs
    const hasMainWorldLoading = consoleLogs.some((log) =>
      log.includes('Main world interceptor loading')
    );
    console.log('Has main world loading log:', hasMainWorldLoading);

    const hasInterceptorsInstalled = consoleLogs.some((log) =>
      log.includes('Interceptors installed in MAIN world')
    );
    console.log('Has interceptors installed log:', hasInterceptorsInstalled);

    console.log('\n🧪 Running token interception test...\n');

    // Clear console logs before test
    consoleLogs.length = 0;

    // Execute test fetch with bearer token
    await page.evaluate(() => {
      fetch('https://tpapi.trainingpeaks.com/test', {
        headers: { Authorization: 'Bearer test-token-12345' },
      }).catch(() => {
        // Ignore network error, we just want to test interception
      });
    });

    // Wait for logs to appear
    await page.waitForTimeout(1000);

    console.log('\n📋 Console logs after test fetch:');
    consoleLogs.forEach((log) => console.log('  ', log));

    // Verify token was intercepted
    const hasFetchLog = consoleLogs.some((log) =>
      log.includes('📡 Fetch request')
    );
    console.log('\n✓ Has fetch request log:', hasFetchLog);

    const hasTokenFound = consoleLogs.some((log) =>
      log.includes('🎫 BEARER TOKEN FOUND')
    );
    console.log('✓ Has token found log:', hasTokenFound);

    const hasReceivedToken = consoleLogs.some((log) =>
      log.includes('📨 Received token from MAIN world')
    );
    console.log('✓ ISOLATED world received token:', hasReceivedToken);

    const hasTokenSent = consoleLogs.some((log) =>
      log.includes('✅ Token sent to background successfully')
    );
    console.log('✓ Token sent to background:', hasTokenSent);

    console.log('\n--- Test Results ---');
    console.log('ISOLATED world bridge loaded:', hasIsolatedWorldLog);
    console.log('MAIN world script loaded:', hasMainWorldScriptLog);
    console.log('Main world interceptor loading:', hasMainWorldLoading);
    console.log('Interceptors installed:', hasInterceptorsInstalled);
    console.log('Fetch intercepted:', hasFetchLog);
    console.log('Token found:', hasTokenFound);
    console.log('Token received by ISOLATED world:', hasReceivedToken);
    console.log('Token sent to background:', hasTokenSent);
    console.log('--------------------\n');

    // Assertions
    expect(hasIsolatedWorldLog).toBeTruthy();
    expect(hasMainWorldScriptLog).toBeTruthy();
    expect(hasMainWorldLoading).toBeTruthy();
    expect(hasInterceptorsInstalled).toBeTruthy();
    expect(hasFetchLog).toBeTruthy();
    expect(hasTokenFound).toBeTruthy();
    expect(hasReceivedToken).toBeTruthy();
    expect(hasTokenSent).toBeTruthy();

    console.log('🎉 All token interception checks PASSED!\n');

    await page.close();
  });

  test('should intercept real TrainingPeaks API requests', async () => {
    const page = await context.newPage();

    const consoleLogs: string[] = [];
    const apiRequests: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);

      // Track intercepted API requests
      if (
        text.includes('📡 Fetch request') ||
        text.includes('📡 XHR request')
      ) {
        apiRequests.push(text);
      }
    });

    console.log('\n📍 Navigating to TrainingPeaks...');
    await page.goto('https://app.trainingpeaks.com');
    await page.waitForTimeout(3000);

    console.log('\n📊 API requests intercepted on page load:');
    apiRequests.forEach((req) => console.log('  ', req));

    // Check that we're intercepting requests
    const hasInterceptedRequests = apiRequests.length > 0;
    console.log('\nTotal requests intercepted:', apiRequests.length);
    console.log('Has intercepted requests:', hasInterceptedRequests);

    // Check if any had authorization headers
    const hasAuthHeader = consoleLogs.some(
      (log) =>
        log.includes('Authorization: present') ||
        log.includes('🎫 BEARER TOKEN FOUND')
    );
    console.log('Found requests with auth header:', hasAuthHeader);

    expect(hasInterceptedRequests).toBeTruthy();

    await page.close();
  });
});

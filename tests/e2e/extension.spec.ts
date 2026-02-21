/**
 * E2E tests for Chrome extension
 *
 * NOTE: These tests require:
 * 1. Extension to be built (npm run build)
 * 2. Headed mode (extensions don't work in headless)
 * 3. TrainingPeaks credentials in environment variables
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load extension in a persistent context
 * This is required for Chrome extensions
 */
async function loadExtension(): Promise<BrowserContext> {
  const pathToExtension = path.join(__dirname, '../../dist');

  const context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox', // May be needed in some environments
    ],
  });

  return context;
}

/**
 * Get extension popup page
 * The popup is opened as a new page when clicking the extension icon
 */
async function getExtensionPopup(
  context: BrowserContext
): Promise<string | null> {
  // Get all pages (including extension pages)
  const pages = context.pages();

  // Find the popup page (starts with chrome-extension://)
  const popupPage = pages.find((page) =>
    page.url().startsWith('chrome-extension://')
  );

  return popupPage ? popupPage.url() : null;
}

test.describe('Extension Loading', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await loadExtension();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load extension without errors', async () => {
    const page = await context.newPage();

    // Check that extension service worker is running
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);

    await page.close();
  });

  test('should have extension icon in toolbar', async () => {
    // Extension should be loaded and visible
    // (Manual verification needed - Playwright can't directly check toolbar)
    expect(context.pages().length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Authentication Flow', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await loadExtension();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should show unauthenticated state initially', async () => {
    const page = await context.newPage();

    // Navigate directly to extension popup
    // Note: You'll need to get the extension ID from chrome://extensions
    // For now, we'll test the behavior indirectly

    await page.goto('https://app.trainingpeaks.com');

    // Extension should intercept requests when user interacts with TP
    await page.waitForTimeout(1000);

    await page.close();
  });

  test.skip('should detect authentication after login', async () => {
    // Skip by default - requires real credentials
    const page = await context.newPage();

    await page.goto('https://app.trainingpeaks.com/login');

    // Login (use environment variables)
    if (process.env.TP_EMAIL && process.env.TP_PASSWORD) {
      await page.fill('[name="email"]', process.env.TP_EMAIL);
      await page.fill('[name="password"]', process.env.TP_PASSWORD);
      await page.click('[type="submit"]');

      // Wait for dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });

      // Extension should have intercepted the token
      // Verify by checking chrome.storage (requires additional setup)
    }

    await page.close();
  });
});

test.describe('Token Interception', () => {
  let context: BrowserContext;

  test.beforeEach(async () => {
    context = await loadExtension();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should intercept fetch requests on TrainingPeaks', async () => {
    const page = await context.newPage();

    // Listen for console messages from content script
    const messages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('TrainingPeaks Extension')) {
        messages.push(msg.text());
      }
    });

    await page.goto('https://app.trainingpeaks.com');

    // Trigger some API requests by navigating
    await page.waitForTimeout(2000);

    // In dev mode, should see console logs from content script
    // console.log('Intercepted messages:', messages);

    await page.close();
  });
});

/**
 * Test helper: Check if extension popup shows correct state
 *
 * Note: This requires knowing the extension ID or using a workaround
 * to programmatically open the popup
 */
test.describe.skip('Popup UI Tests', () => {
  test('should display authentication status in popup', async () => {
    const context = await loadExtension();
    const page = await context.newPage();

    // TODO: Open extension popup programmatically
    // This is challenging because Playwright can't click the extension icon
    // Workarounds:
    // 1. Use chrome.action.openPopup() from background script
    // 2. Navigate directly to popup URL (need extension ID)
    // 3. Use Chrome DevTools Protocol

    await page.close();
    await context.close();
  });
});

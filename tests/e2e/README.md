# E2E Testing with Playwright

## Overview

This directory contains end-to-end tests for the TrainingPeaks Chrome extension using Playwright.

**Important**: Chrome extensions **cannot run in headless mode**, so all E2E tests run in headed mode (you'll see the browser).

## Quick Start

```bash
# Install Playwright browsers
npx playwright install chromium

# Build the extension first
npm run build

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode (recommended for development)
npx playwright test --ui

# Run specific test file
npx playwright test extension.spec.ts

# Debug mode
npx playwright test --debug
```

## How It Works

### Extension Loading

```typescript
import { chromium } from '@playwright/test';

const context = await chromium.launchPersistentContext('', {
  headless: false, // MUST be false for extensions
  args: [`--disable-extensions-except=./dist`, `--load-extension=./dist`],
});
```

### Key Points

1. **Headed Mode Only**: Extensions don't work in headless mode
2. **Persistent Context**: Use `launchPersistentContext()` not `launch()`
3. **Build First**: Extension must be built to `dist/` before testing
4. **Extension ID**: Changes between sessions, need to detect it

## Test Structure

```
tests/e2e/
├── extension.spec.ts       # Main extension tests
├── helpers/
│   └── extension.ts        # Helper utilities
└── README.md               # This file
```

## Writing Tests

### Basic Template

```typescript
import { test, expect } from '@playwright/test';
import { launchExtension, openPopup } from './helpers/extension';

test('test name', async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  // Your test code

  await page.close();
  await context.close();
});
```

### Available Helpers

```typescript
import {
  launchExtension, // Launch Chrome with extension
  openPopup, // Open extension popup
  getExtensionId, // Get extension ID
  isExtensionAuthenticated, // Check auth status
  clearExtensionStorage, // Clear extension data
} from './helpers/extension';
```

## Common Scenarios

### Test Authentication Flow

```typescript
test('should detect authentication', async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  // Visit TrainingPeaks
  await page.goto('https://app.trainingpeaks.com');

  // Manually log in (or use saved session)
  // Extension should intercept token

  // Open popup and check status
  const popup = await openPopup(context);
  await expect(popup.locator('.bg-green-50')).toBeVisible();

  await popup.close();
  await page.close();
  await context.close();
});
```

### Test Token Interception

```typescript
test('should intercept API requests', async () => {
  const context = await launchExtension();
  const page = await context.newPage();

  // Listen for console messages from content script
  const messages: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('TrainingPeaks Extension')) {
      messages.push(msg.text());
    }
  });

  await page.goto('https://app.trainingpeaks.com');
  await page.waitForTimeout(2000);

  // Check that content script logged messages
  expect(messages.length).toBeGreaterThan(0);

  await page.close();
  await context.close();
});
```

## Limitations

### ❌ What Doesn't Work

1. **Headless mode**: Extensions require headed browser
2. **Clicking extension icon**: Playwright can't interact with Chrome toolbar
3. **chrome:// pages**: Limited access to internal Chrome pages
4. **Stable extension ID**: ID changes between contexts

### ✅ Workarounds

1. **Access popup**: Navigate directly to `chrome-extension://{id}/popup.html`
2. **Test content script**: Check console messages and DOM changes
3. **Test background**: Use service worker debugging
4. **Persistent state**: Use `launchPersistentContext()` with a user data dir

## CI/CD Considerations

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: |
    npm run build
    npx playwright install chromium
    xvfb-run npm run test:e2e  # Virtual display for headed mode
```

### Docker

E2E tests with extensions in Docker are challenging. Consider:

- Using `xvfb` for virtual display
- Mounting extension directory
- Using `--no-sandbox` flag

## Debugging

### Visual Debugging

```bash
# UI Mode (recommended)
npx playwright test --ui

# Debug mode (step through)
npx playwright test --debug

# Headed with slow motion
npx playwright test --headed --slowmo=1000
```

### Screenshots & Videos

Configured in `playwright.config.ts`:

- Screenshots on failure: `screenshot: 'only-on-failure'`
- Videos on failure: `video: 'retain-on-failure'`
- Traces: `trace: 'retain-on-failure'`

### Console Logs

```typescript
page.on('console', (msg) => {
  console.log(`BROWSER: ${msg.text()}`);
});

page.on('pageerror', (error) => {
  console.error(`PAGE ERROR: ${error}`);
});
```

## Environment Variables

For tests requiring authentication:

```bash
# .env.test
TP_EMAIL=your-email@example.com
TP_PASSWORD=your-password
```

**Security**: Never commit credentials! Use CI secrets for automated tests.

## Best Practices

1. **Build first**: Always `npm run build` before E2E tests
2. **Clean state**: Clear extension storage between tests
3. **Explicit waits**: Use `waitForSelector()` not `waitForTimeout()`
4. **Stable selectors**: Use `data-testid` attributes
5. **Test isolation**: Each test should be independent
6. **Skip auth**: Save authenticated session to speed up tests

## Alternative: Bowser-QA Agent

If Playwright setup is too complex, you can use the built-in Bowser-QA agent:

```bash
# This project has access to bowser-qa agents
# They handle Playwright setup automatically
# See: Skill tool with skill: "bowser-qa:playwright-bowser"
```

The agent can:

- Run tests in parallel
- Handle headless/headed modes
- Manage browser contexts
- Generate reports

## Resources

- [Playwright Docs](https://playwright.dev/)
- [Testing Extensions Guide](https://playwright.dev/docs/chrome-extensions)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Troubleshooting

### Extension not loading

**Issue**: `Extension could not be loaded`
**Fix**:

```bash
npm run build  # Rebuild extension
ls -la dist/   # Verify dist/ exists
```

### Tests timeout

**Issue**: Tests hang or timeout
**Fix**:

- Check `headless: false` is set
- Increase timeout in config
- Use explicit waits instead of sleep

### Can't access popup

**Issue**: `Cannot navigate to chrome-extension://...`
**Fix**:

- Get extension ID first with `getExtensionId()`
- Verify popup URL is correct
- Check manifest.json has popup configured

### Flaky tests

**Issue**: Tests pass sometimes, fail other times
**Fix**:

- Use `waitFor` instead of `timeout`
- Add retry logic
- Check for race conditions
- Ensure clean state between tests

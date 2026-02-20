import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Chrome extension testing
 *
 * Note: Extension testing requires headed mode (headless: false)
 * because Chrome doesn't support extensions in headless mode.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Maximum time one test can run */
  timeout: 30 * 1000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter to use */
  reporter: [['html'], ['list']],

  /* Shared settings for all projects */
  use: {
    /* Base URL for navigation (TrainingPeaks) */
    baseURL: 'https://app.trainingpeaks.com',

    /* Collect trace on failure */
    trace: 'retain-on-failure',

    /* Screenshots on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for extension testing */
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Extension-specific settings applied in test setup
      },
    },
  ],
});

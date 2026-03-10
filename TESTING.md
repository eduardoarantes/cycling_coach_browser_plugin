# Testing Guide

This project has unit, component, and Playwright-based extension tests, plus a
small set of manual smoke checks that are important for auth and export flows.

## Automated Checks

Run the standard validation commands before opening a pull request:

```bash
npm run lint
npm run type-check
npm run test:unit
```

Additional commands:

```bash
npm test
npm run test:components
npm run coverage
npm run test:e2e
```

## Build Notes

For local validation, prefer:

```bash
npm run build:bundle
```

`npm run build` and `npm run build:local` increment the patch version in
`package.json` and `public/manifest.json`. That is useful for release packaging
but noisy during normal development.

## Manual Smoke Tests

### 1. TrainingPeaks Auth Capture

1. Load the extension in Chrome.
2. Sign in to `https://app.trainingpeaks.com`.
3. Refresh the page or navigate inside the app.
4. Open the popup.
5. Confirm that TrainingPeaks shows as connected.

### 2. Library and Plan Browsing

1. Open a connected popup.
2. Load workout libraries and at least one library detail view.
3. Load training plans if your account has them.
4. Confirm that notes, events, and structured workout details render without
   obvious errors.

### 3. PlanMyPeak Connection

1. Enable the PlanMyPeak integration in Settings.
2. Sign in to `planmypeak.com` or the configured local PlanMyPeak target.
3. Refresh the tab.
4. Confirm that the extension marks PlanMyPeak as connected.

### 4. Intervals.icu Connection

1. Enable the Intervals.icu integration in Settings.
2. Save an Intervals.icu API key.
3. Re-open the popup.
4. Confirm that the integration shows as connected.

### 5. Export Flow

1. Export a small workout library to the target you changed.
2. Confirm badge and notification behavior.
3. Confirm the expected result on the destination service.

## Playwright E2E Notes

- Extension tests must run in headed Chromium
- Build the extension before running E2E tests
- Use `npx playwright install chromium` if the browser is not installed yet

See [tests/e2e/README.md](./tests/e2e/README.md) for Playwright-specific
details.

## Suggested Pre-PR Checklist

- `npm run lint`
- `npm run type-check`
- `npm run test:unit`
- `npm run build:bundle`
- Relevant manual smoke tests for the feature you changed

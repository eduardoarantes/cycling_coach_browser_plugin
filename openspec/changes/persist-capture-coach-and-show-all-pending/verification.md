# Implementation verification

Implemented on `feat/personal-capture-pending`, based on extension `origin/main` at `cfad660`. The companion page is implemented on the same branch name in the application repository, based on its `origin/main` at `9e40d123`, with change `show-local-pending-captures`. Neither branch has been deployed.

## Automated checks

- Extension unit tests: 114 files passed; 1710 tests passed, 3 existing skips.
- Extension production bundle (including TypeScript compilation): passed.
- Extension ESLint: passed.
- Companion contract, observer, and page-control suites: 80 tests passed. Web type checking and changed-file ESLint passed.
- Both OpenSpecs pass strict validation.
- Broader legacy component suite: 65 passed, 77 failed. Running the identical suite on a clean archive of base `cfad660` reproduced the same 77 failing test cases (5 files); these are pre-existing failures, not introduced here.

Tests cover durable-cache retention, absent/corrupt cache, immediate unowned capture, capture before network completion, concurrent enrichment, restart backfill, failed cache publication, token/destination changes during a profile request, aborted late responses, single flight, persisted throttle, accepted auth traffic without popup use, destination acknowledgements, importing absent/different owners, and blocked-auth local summaries. The coach-profile endpoint remains passive; no new credential recovery path or retry policy was introduced.

## Browser evidence

`tests/e2e/capture-without-popup.spec.ts`: two real Chromium extension-runtime tests passed against the production bundle, using temporary profiles and synthetic HTTP responses. They exercise:

1. Persist expired TP and PMP credentials, then restart the browser/service worker.
2. Create a supported custom workout through the actual TP-page fetch interceptor and isolated-world bridge, with the popup never opened.
3. Verify immediate pending storage and badge count, both with a durable cached coach and without any coach cache.
4. Query the actual page bridge and verify blocked authentication still returns pending availability and unknown missing count.
5. From the clean-cache case, observe ordinary PMP auth-bearing traffic and verify automatic coach initialization and attribution without linking.

Run with `npm run build:bundle`, then `npx playwright test tests/e2e/capture-without-popup.spec.ts --reporter=list`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only when using an already installed compatible test browser outside Playwright's default location.

## Remaining acceptance

Task 5.8 remains open: perform the complete scenario against live TP/PMP accounts, including explicit import after destination authentication recovers. The browser evidence above verifies actual extension execution with synthetic servers; it is not evidence of a live TP save or live PMP upload. The companion page must ship before or together with the extension for the complete page experience.

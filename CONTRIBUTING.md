# Contributing

Contributions are welcome, but this extension touches authentication, browser
permissions, and third-party APIs. Please keep changes focused and document user
visible behavior carefully.

## Before You Start

- Open an issue before making large changes or new integrations
- Read [README.md](./README.md), [INSTALL.md](./INSTALL.md), and
  [TESTING.md](./TESTING.md)
- If your change affects data flow, auth handling, permissions, or exports,
  update the relevant documentation in the same pull request

## Local Setup

```bash
npm install
npm run lint
npm run type-check
npm run test:unit
```

Useful commands:

- `npm run dev`: local PlanMyPeak target on `localhost:3006`
- `npm run dev:prod`: dev server against production targets
- `npm run build:bundle`: build without changing the version number
- `npm run build`: build and bump patch version
- `npm run build:local`: local-target build and patch version bump
- `npm run test:e2e`: Playwright extension tests

For routine development, prefer `npm run build:bundle`. The `build` and
`build:local` scripts run `scripts/increment-version.cjs`, which updates both
`package.json` and `public/manifest.json`.

## Loading the Extension

1. Build the extension with `npm run build:bundle`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select `dist/`.

## Coding Expectations

- Keep TypeScript strict and avoid weakening types unless necessary
- Favor small, reviewable pull requests over large cross-cutting rewrites
- Keep new docs and UI copy consistent with the actual product name shown in the
  manifest: `PlanMyPeak Importer`
- Do not commit generated artifacts such as `dist/`, `node_modules/`, or ZIP
  packages

## Testing Expectations

At minimum, run:

```bash
npm run lint
npm run type-check
npm run test:unit
npm run build:bundle
```

Also run the relevant manual checks from [TESTING.md](./TESTING.md). If your
change affects popup flows, auth capture, or export behavior, include manual
verification notes in the pull request.

Run `npm run test:e2e` for Playwright-covered flows when you touch extension UI
or browser runtime behavior. Those tests require headed Chromium.

## Commit and Pull Request Guidelines

- Conventional commits are enforced through Commitlint
- Prettier runs on staged `ts`, `tsx`, `json`, and `md` files via lint-staged
- Include a clear summary, testing notes, and screenshots when relevant
- Call out permission changes, storage changes, and external API changes
- Avoid mixing refactors, behavior changes, and release/version changes unless
  there is a strong reason

## Reporting Bugs and Requesting Features

- Use GitHub issues for bugs, questions, and feature requests
- Redact tokens, API keys, and personal training data from reports
- For vulnerabilities or sensitive disclosures, follow [SECURITY.md](./SECURITY.md)

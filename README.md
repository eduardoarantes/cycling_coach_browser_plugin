# PlanMyPeak Importer

Open-source Chrome extension for working with TrainingPeaks data in the browser.
It captures your authenticated TrainingPeaks session locally, lets you browse
workout libraries and training plans, and exports data to PlanMyPeak and
Intervals.icu.

This project is independent and is not affiliated with TrainingPeaks,
Intervals.icu, or PlanMyPeak.

![Extension screenshot](./screenshot600x400.jpg)

## What It Does

- Reuses your existing TrainingPeaks web session instead of asking you to paste
  tokens manually
- Browses TrainingPeaks workout libraries, workouts, plans, notes, and events
- Exports workout libraries and full training plans to PlanMyPeak
- Exports workout libraries and reusable PLAN folders to Intervals.icu
- Tracks export progress with extension badge updates and an in-popup progress banner

## Supported Platforms

- Chrome and Chromium-based browsers
- TrainingPeaks is required
- PlanMyPeak is optional
- Intervals.icu is optional

Firefox and Safari are not supported.

## Privacy at a Glance

- The extension stores credentials and settings in `chrome.storage.local`
- Network calls go directly from the extension to provider APIs
- There is no analytics, ads, or separate telemetry backend in this repository
- PlanMyPeak and Intervals.icu are optional integrations; see the privacy docs
  for the exact request paths and conditions

See [PRIVACY.md](./PRIVACY.md) and
[docs/PRIVACY_AND_PERMISSIONS.md](./docs/PRIVACY_AND_PERMISSIONS.md) for the
full details.

## Install From Source

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the extension bundle without changing the version number:

   ```bash
   npm run build:bundle
   ```

3. Open `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the repository's `dist/` directory.

### First Use

1. Open `https://app.trainingpeaks.com` and sign in.
2. Navigate inside TrainingPeaks to trigger an API request, or click **Refresh**
   in the popup: it captures the sign-in in a temporary background tab without
   reloading your page.
3. Open the extension popup.
4. Confirm that TrainingPeaks shows as connected.
5. Optionally connect PlanMyPeak or add an Intervals.icu API key in Settings.

For a more detailed guide, see [INSTALL.md](./INSTALL.md).

## Development

```bash
npm install
npm run dev
npm run lint
npm run type-check
npm run test:unit
```

Useful commands:

- `npm run dev`: local development target for PlanMyPeak (`https://localhost:3002`, port configurable in Settings → Local Dev Ports)
- `npm run dev:prod`: development server targeting production hosts
- `npm run build:bundle`: production-target bundle without a version bump
- `npm run build`: production-target bundle and patch-version increment
- `npm run build:local`: local-target bundle and patch-version increment
- `npm run package:release`: build and create the canonical Chrome Web Store ZIP
- `npm run test:e2e`: Playwright extension tests in headed Chromium

Important: `npm run build` and `npm run build:local` update the patch version in
`package.json` and `public/manifest.json` via `scripts/increment-version.cjs`.
For routine local validation, prefer `npm run build:bundle`.

## CI And Releases

Pull requests and pushes to `main` run GitHub Actions lint, type-check, unit
tests, and `npm run build:bundle`.

### Publishing a release

1. Open **Actions → Release Artifact → Run workflow** and select **main**.
2. Set **new_version** to `patch`, `minor`, `major`, or an exact version such as
   `1.21.0` (a leading `v` is also accepted).
3. Click **Run workflow**. It updates `package.json`, the lockfile root metadata,
   and `public/manifest.json` in a new PR, waits for the required pull-request CI
   for that commit, merges when checks pass, then builds and publishes the release.

Leave **new_version** blank to publish the version already on `main`, for example
when retrying after a version PR merged but packaging failed. The optional
**expected_version** is a guard against releasing an unintended version; it is
checked against the resolved new version, or current `main` when no bump is
requested. It does not bump the version itself.

The workflow rejects invalid versions, downgrades, and existing release tags
before opening a PR. If CI fails, the PR remains open for diagnosis and no tag
is created. If `main` changes while the version PR is being checked, close that
PR and run the release again; the workflow will not silently release different
code. If a tag exists but publication failed, dispatch the workflow on that tag with
no bump: `gh workflow run release.yml --ref v1.21.0`. This rebuilds and publishes
the tagged commit without changing `main`. Pushing a `vX.Y.Z` tag manually also
continues to build and publish that exact tag.

Repository setup: **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests** must be enabled.
The workflow uses the built-in token to create and merge its own version PR;
it does not approve reviews or bypass branch protection. It approves execution
of the CI run for its own version-only PR when GitHub requires it, then waits for
that pull-request run. Manually dispatched CI does not satisfy required PR checks.
No personal access token or auto-merge repository setting is required. If additional required reviews
or checks are introduced, they must be satisfied before this automation can merge.

The published artifact is `planmypeak-importer-webstore-vX.Y.Z.zip`, attached
to the GitHub release and available as a workflow artifact. That zip is what
you upload to the Chrome Web Store.

## Project Layout

```text
src/
  background/   Service worker and provider API clients
  content/      TrainingPeaks and PlanMyPeak request interceptors
  export/       Destination adapters and mapping logic
  hooks/        Popup data-fetching and auth hooks
  popup/        React UI for browsing and exports
  schemas/      Zod schemas
  services/     Storage, auth, export progress, and port config
tests/
  unit/         Unit tests
  components/   Component tests
  e2e/          Playwright extension tests
docs/
  Architecture, mapping, and integration notes
```

## Documentation

- [INSTALL.md](./INSTALL.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [TESTING.md](./TESTING.md)
- [PRIVACY.md](./PRIVACY.md)
- [SECURITY.md](./SECURITY.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/PRIVACY_AND_PERMISSIONS.md](./docs/PRIVACY_AND_PERMISSIONS.md)
- [docs/RELEASING.md](./docs/RELEASING.md)

## Current Limitations

- Token capture depends on visiting supported TrainingPeaks pages and generating
  authenticated network traffic
- Playwright extension tests must run in headed Chromium
- The packaged extension name is currently `PlanMyPeak Importer`
- Production bundles target `planmypeak.com`; local dev bundles can target a
  configurable localhost PlanMyPeak app and Supabase instance

## License

MIT. See [LICENSE](./LICENSE).

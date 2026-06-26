# Releasing

This repository uses GitHub Actions to build the canonical Chrome Web Store
artifact for tagged releases.

## Trigger

The release workflow is defined in
`.github/workflows/release.yml`.

It runs automatically when you push a tag that matches:

```text
vX.Y.Z
```

Examples:

- `v1.11.80`
- `v1.12.0`

There is currently no manual `workflow_dispatch` trigger. The workflow only
runs from a pushed tag.

## Before You Tag

Make sure these versions match exactly:

- `package.json`
- `public/manifest.json`
- the git tag you are about to create

Example:

- `package.json` version: `1.11.80`
- `public/manifest.json` version: `1.11.80`
- git tag: `v1.11.80`

If they do not match, the release workflow will fail.

## Release Steps

1. Update `package.json` and `public/manifest.json` to the release version if
   needed.
2. Commit and push that change to `main`.
3. Create the tag locally:

   ```bash
   git checkout main
   git pull origin main
   git tag vX.Y.Z
   ```

4. Push the tag:

   ```bash
   git push origin vX.Y.Z
   ```

## What the Workflow Does

The `Release Artifact` workflow:

- installs dependencies with `npm ci`
- runs `npm run lint`
- runs `npm run type-check`
- runs `npm run test:unit`
- runs `npm run build:bundle`
- creates the canonical store ZIP
- uploads the ZIP and checksum as workflow artifacts
- publishes the ZIP and checksum to the GitHub release

The release artifact name is:

```text
planmypeak-importer-webstore-vX.Y.Z.zip
```

It also publishes:

```text
planmypeak-importer-webstore-vX.Y.Z.zip.sha256
```

## Where To Find The Artifact

After the workflow completes successfully, the files are available in two
places:

1. GitHub Actions workflow run artifacts
2. The GitHub Release created for the pushed tag

## Local Equivalent

If you want to generate the same canonical ZIP locally without creating a tag:

```bash
npm run package:release
```

That produces the same store-facing package locally, but it does not create a
GitHub release or upload anything automatically.

## Troubleshooting

### Workflow did not start

Check that:

- the tag was pushed to `origin`
- the tag format is exactly `vX.Y.Z`

### Workflow failed at version validation

Check that:

- `package.json` version matches the tag without the `v`
- `public/manifest.json` version matches the tag without the `v`

### Need a one-off local test artifact

Use:

```bash
npm run build:bundle
npm run package:release
```

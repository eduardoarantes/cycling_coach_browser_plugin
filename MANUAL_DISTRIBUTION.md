# Manual Distribution Guide

This file is for sharing an unpacked build with testers outside the Chrome Web
Store.

## Build a Shareable Package

Use the packaged release flow:

```bash
npm run package
```

That command builds the extension and creates a ZIP archive in the repository
root.

If you want to build without changing the version number, run:

```bash
npm run build:bundle
```

Then create your own ZIP from `dist/`.

## What Testers Need To Do

1. Extract the ZIP to a permanent folder.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extracted folder that contains `manifest.json`.
6. Sign in to `https://app.trainingpeaks.com` and refresh the page.
7. Open the extension popup.

## Important Notes for Testers

- Unpacked extensions show Chrome's developer mode warning banner
- Unpacked extensions do not auto-update
- Replacing files requires clicking Reload in `chrome://extensions`
- Testers should never share screenshots or logs containing auth tokens or API
  keys

## Recommend GitHub Releases for Public Sharing

If you plan to distribute builds broadly, prefer GitHub releases over ad hoc ZIP
sharing. That gives contributors a clear changelog, version history, and a
single download source.

## Related Docs

- [README.md](./README.md)
- [INSTALL.md](./INSTALL.md)
- [SECURITY.md](./SECURITY.md)

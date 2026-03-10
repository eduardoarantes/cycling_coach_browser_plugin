# Installation and First Use

This guide covers manual installation for an unpacked Chrome extension.

## Requirements

- Chrome or another Chromium-based browser
- A TrainingPeaks account
- Node.js 18+ only if you are installing from source

## Option 1: Install From Source

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build:bundle
   ```

4. Open `chrome://extensions`.
5. Enable `Developer mode`.
6. Click `Load unpacked`.
7. Select the repository's `dist/` directory.

Use `npm run build` instead of `npm run build:bundle` only when you intend to
create a release-style production bundle and want the patch version to advance.

## Option 2: Install From a Packaged ZIP

1. Download a packaged release ZIP.
2. Extract it to a permanent folder.
3. Open `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the extracted folder that contains `manifest.json`.

Unpacked extensions do not auto-update. To update, replace the files and click
Reload in `chrome://extensions`.

## First-Time Setup

### Connect TrainingPeaks

1. Open `https://app.trainingpeaks.com`.
2. Sign in.
3. Refresh the page or click around inside the app.
4. Open the extension popup.
5. Confirm that TrainingPeaks shows as connected.

The extension captures the TrainingPeaks bearer token from browser requests and
stores it locally in `chrome.storage.local`.

### Optional: Connect PlanMyPeak

1. Open the extension popup.
2. Go to Settings.
3. Enable the PlanMyPeak connection if it is disabled.
4. Open or refresh `planmypeak.com` or the configured local PlanMyPeak app.
5. Return to the extension and confirm that PlanMyPeak shows as connected.

The extension detects PlanMyPeak auth from requests made to PlanMyPeak and its
Supabase auth backend.

### Optional: Connect Intervals.icu

1. Create an API key in your Intervals.icu account settings.
2. Open the extension popup.
3. Go to Settings.
4. Enable the Intervals.icu connection if it is disabled.
5. Paste the API key and save it.

The Intervals.icu API key is stored locally and used only for direct API calls
to Intervals.icu.

## Troubleshooting

### TrainingPeaks Shows as Not Connected

- Confirm that you are signed in to `app.trainingpeaks.com`
- Refresh the page and generate a few authenticated requests
- Reload the extension from `chrome://extensions`
- Re-open the popup

### PlanMyPeak Does Not Connect

- Make sure the PlanMyPeak integration is enabled in Settings
- Visit `planmypeak.com` or your local PlanMyPeak target and sign in
- Refresh the PlanMyPeak tab so the extension can observe auth requests
- If you are using a local build, confirm the app and Supabase ports in Settings

### Intervals.icu Export Is Unavailable

- Confirm that the Intervals.icu integration is enabled
- Make sure the API key was saved successfully
- Re-open the popup to refresh the connection state

### Chrome Refuses to Load the Extension

- Make sure you selected a folder containing `manifest.json`
- Rebuild the project if you installed from source
- Check the Errors button in `chrome://extensions`

## Uninstall

1. Open `chrome://extensions`.
2. Find `PlanMyPeak Importer`.
3. Click `Remove`.
4. Delete the unpacked extension folder if you no longer need it.

## Related Docs

- [README.md](./README.md)
- [PRIVACY.md](./PRIVACY.md)
- [docs/PRIVACY_AND_PERMISSIONS.md](./docs/PRIVACY_AND_PERMISSIONS.md)

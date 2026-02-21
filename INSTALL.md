# PlanMyPeak Importer - Installation Guide

Access your TrainingPeaks workout libraries directly from your browser!

**Version:** 1.0.45
**Last Updated:** 2026-02-21

---

## What This Extension Does

- ✅ Automatically captures your TrainingPeaks authentication token
- ✅ Shows your authenticated status
- ✅ Displays your workout libraries
- ✅ Access library contents and workouts
- ✅ All data stays local - no external servers

---

## Prerequisites

- **Google Chrome** (or Chromium-based browser like Edge, Brave)
- **Active TrainingPeaks account** (free or premium)

---

## Installation Steps

### 1. Download the Extension

You should have received a ZIP file: `planmypeak-importer-v1.0.45.zip`

### 2. Extract the ZIP File

- **Windows:** Right-click → Extract All
- **Mac:** Double-click the ZIP file
- **Linux:** `unzip planmypeak-importer-v1.0.45.zip`

### 3. Load in Chrome

1. **Open Chrome Extensions Page**
   - Go to: `chrome://extensions`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the **extracted folder** (contains `manifest.json`)
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "PlanMyPeak Importer" in your extensions list
   - The extension icon should appear in your Chrome toolbar

---

## First-Time Setup

### Get Your Authentication Token

1. **Go to TrainingPeaks**
   - Open: https://app.trainingpeaks.com
   - Log in to your account

2. **Trigger Token Capture**
   - Click around TrainingPeaks (Calendar, Workouts, etc.)
   - Or simply **refresh the page** (F5 or Cmd+R)
   - Wait 2-3 seconds

3. **Open the Extension**
   - Click the extension icon in your toolbar
   - You should see: ✅ **Authenticated**
   - Your libraries should load automatically

---

## Usage

### View Your Libraries

1. **Click the extension icon** while on any webpage
2. **See your authentication status** at the top
3. **Browse your workout libraries** below
4. **Click a library** to see its workouts

### Refresh Your Token

If you see "Not Authenticated":

1. Go to TrainingPeaks
2. Refresh the page or click around
3. Open the extension - should now show "Authenticated"

### Token Expires After 24 Hours

- The extension shows "Token obtained Xm ago"
- If older than 24h, just refresh TrainingPeaks to get a new token

---

## Troubleshooting

### "Not Authenticated" After Opening Extension

**Cause:** Extension hasn't captured a token yet

**Fix:**

1. Open TrainingPeaks in a browser tab
2. Refresh the page (F5)
3. Wait 2-3 seconds
4. Open the extension popup
5. Click "Refresh" if needed

### "HTTP 401" Error

**Cause:** Token expired or invalid

**Fix:**

1. Go to TrainingPeaks
2. Refresh the page to get a fresh token
3. Open the extension - should work now

### Extension Not Capturing Token

**Fix:**

1. Open TrainingPeaks
2. Open browser console (F12)
3. Look for logs like:
   ```
   [TP Extension - MAIN World] ✅ Valid TrainingPeaks API token!
   ```
4. If you don't see this, try:
   - Refresh the page
   - Navigate to Calendar or Workouts
   - Reload the extension at `chrome://extensions`

### Extension Icon Not Visible

**Fix:**

1. Go to `chrome://extensions`
2. Find "PlanMyPeak Importer"
3. Click the puzzle icon in Chrome toolbar
4. Pin the extension

---

## Privacy & Security

✅ **All data stays on your computer**

- Extension only runs locally in your browser
- No external servers or analytics
- Token stored securely in Chrome's encrypted storage

✅ **Open Source**

- Code available at: https://github.com/eduardoarantes/cycling_coach_browser_plugin
- Review the code yourself!

⚠️ **Do NOT share your token**

- The token gives access to your TrainingPeaks account
- Never paste it anywhere or share screenshots containing it

---

## Uninstallation

1. Go to `chrome://extensions`
2. Find "PlanMyPeak Importer"
3. Click "Remove"
4. Confirm removal

Your TrainingPeaks data is not affected by uninstalling.

---

## Support

**GitHub Issues:** https://github.com/eduardoarantes/cycling_coach_browser_plugin/issues

**Common Issues:**

- Not Authenticated → Refresh TrainingPeaks
- HTTP 401 → Get fresh token from TrainingPeaks
- Libraries not loading → Check console for errors

---

## Technical Details

- **Built with:** React, TypeScript, Vite
- **Manifest Version:** V3 (latest Chrome extension standard)
- **Permissions:**
  - `storage` - Store your authentication token locally
  - `tabs` - Detect TrainingPeaks tabs
  - Host access to `app.trainingpeaks.com` and `tpapi.trainingpeaks.com`

---

## Credits

Created by **Eduardo Arantes**

Built with ❤️ for the cycling and endurance sports community.

**License:** MIT

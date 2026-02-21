# Manual Distribution Guide - Share with Testers

Share **PlanMyPeak Importer** with friends for testing before Chrome Web Store approval.

---

## Option 1: Share the Built Extension (Recommended)

### For You (Sender)

1. **Create a distribution package:**

```bash
cd dist
zip -r ../planmypeak-importer-manual.zip .
cd ..
```

2. **Share the zip file** with your friend:
   - Email: `planmypeak-importer-manual.zip`
   - Google Drive / Dropbox
   - WeTransfer
   - Any file sharing service

3. **Send installation instructions** (see below)

---

## For Your Friend (Tester)

### Installation Steps

1. **Download** the zip file you received

2. **Extract the zip file**
   - Right-click → Extract All (Windows)
   - Double-click (Mac)
   - Save to a permanent location (e.g., `Documents/PlanMyPeak`)

3. **Open Chrome Extensions**
   - Go to: `chrome://extensions`
   - Or: Menu → Extensions → Manage Extensions

4. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

5. **Load the extension**
   - Click "Load unpacked"
   - Select the extracted folder
   - Click "Select Folder"

6. **Done!**
   - The extension should now appear in your extensions
   - Pin it to the toolbar for easy access

### Testing the Extension

1. **Log into TrainingPeaks**
   - Go to: https://app.trainingpeaks.com
   - Log in with your account

2. **Open the extension**
   - Click the extension icon in your toolbar
   - You should see "Authenticated" status

3. **Browse libraries**
   - Click on libraries to view workouts
   - Test different workout types

### ⚠️ Important Notes for Testers

- **Developer Mode Warning**: Chrome shows a warning banner for unpacked extensions - this is normal
- **No Auto-Updates**: Manual installations don't auto-update. You'll need to receive new versions from the sender
- **Permanent Location**: Don't delete the extracted folder - Chrome loads from there
- **Reload After Updates**: If you receive an updated version, click the reload button (⟳) in `chrome://extensions`

---

## Option 2: Share the Source Code (For Technical Friends)

If your friend knows how to use npm/git:

1. **Share the GitHub repository**:

```
https://github.com/eduardoarantes/cycling_coach_browser_plugin
```

2. **Installation for technical users**:

```bash
# Clone the repository
git clone https://github.com/eduardoarantes/cycling_coach_browser_plugin.git
cd cycling_coach_browser_plugin

# Install dependencies
npm install

# Build the extension
npm run build

# Load 'dist' folder in Chrome (Developer Mode)
```

---

## Quick Installation Guide for Testers (Copy/Paste)

Send this to your friend along with the zip file:

```
Hi! Here's how to install PlanMyPeak Importer:

1. Extract the zip file to a permanent location (e.g., Documents)
2. Open Chrome and go to: chrome://extensions
3. Turn ON "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the extracted folder
6. Done! The extension should appear

To test:
1. Go to app.trainingpeaks.com and log in
2. Click the PlanMyPeak Importer icon
3. You should see your workout libraries!

Note: You'll see a "Developer mode" warning - this is normal for manually installed extensions.
```

---

## Updating the Extension for Testers

When you make changes:

### For You (Sender)

```bash
# Make your changes
npm run build

# Create new package
cd dist && zip -r ../planmypeak-importer-manual-v2.zip . && cd ..

# Share the new zip with testers
```

### For Testers

1. **Extract the new zip** to the same location (replace old files)
2. **Go to** `chrome://extensions`
3. **Find PlanMyPeak Importer**
4. **Click the reload button** (⟳)
5. Done! Extension updated

---

## Troubleshooting

### "This extension may have been corrupted"

**Solution**:

- Delete the extension
- Re-extract the zip file
- Load unpacked again

### "Invalid manifest"

**Solution**:

- Make sure you selected the correct folder (should contain `manifest.json`)
- Re-download and extract the zip file

### Extension not working

**Solution**:

1. Check Developer Mode is ON
2. Click the reload button (⟳) on the extension
3. Open DevTools: Right-click extension icon → Inspect popup
4. Check for errors in Console

### Authentication not working

**Solution**:

1. Make sure you're logged into TrainingPeaks first
2. Reload the extension
3. Click a few things on TrainingPeaks to trigger token interception
4. Open extension popup again

---

## Comparison: Manual vs Chrome Web Store

| Feature          | Manual Distribution   | Chrome Web Store               |
| ---------------- | --------------------- | ------------------------------ |
| **Speed**        | Immediate             | 1-3 days review                |
| **Updates**      | Manual (send new zip) | Automatic                      |
| **Installation** | Developer Mode        | One click                      |
| **Trust**        | Shows warning banner  | Trusted by Chrome              |
| **Testers**      | Anyone with zip file  | Only approved emails (Private) |
| **Best For**     | Quick testing         | Long-term use                  |

---

## Security Notes

**For You**:

- Only share with people you trust
- They can see all the code (it's unpacked)
- Consider this for testing only

**For Testers**:

- Only install extensions from people you trust
- Review the code if you're technical
- Uninstall when done testing

---

## Moving to Chrome Web Store Later

Once approved on Chrome Web Store:

1. **Testers uninstall manual version**:
   - Go to `chrome://extensions`
   - Remove PlanMyPeak Importer

2. **Install from Chrome Web Store**:
   - Use the private link you share
   - Automatic updates from then on

---

## Files to Share

### Minimum (Easiest)

- `planmypeak-importer-manual.zip` (the built extension)
- Installation instructions (text above)

### Complete Package

- `planmypeak-importer-manual.zip`
- `MANUAL_DISTRIBUTION.md` (this file)
- Quick installation guide

---

## Example Email to Testers

```
Subject: Test PlanMyPeak Importer Chrome Extension

Hi [Friend],

I've built a Chrome extension to browse TrainingPeaks workout libraries.
Would you mind testing it?

Installation (takes 2 minutes):
1. Download the attached zip file
2. Extract it to a permanent location (like Documents)
3. Open Chrome → chrome://extensions
4. Turn on "Developer mode" (top-right)
5. Click "Load unpacked" and select the extracted folder

To test:
- Log into app.trainingpeaks.com
- Click the extension icon
- Browse your workout libraries

You'll see a warning banner because it's manually installed - this is normal!

Let me know if you find any issues or have suggestions.

Thanks!
```

---

## Quick Commands

```bash
# Create distribution package
cd dist && zip -r ../planmypeak-importer-manual.zip . && cd ..

# Verify package
unzip -l planmypeak-importer-manual.zip | head -20

# Share with friend
# Email or upload to Google Drive/Dropbox
```

---

## Need More Testers?

- Manual distribution works for any number of people
- Just share the same zip file with everyone
- Everyone gets the same version
- You control updates (send new versions manually)

This is perfect for quick testing before Chrome Web Store approval!

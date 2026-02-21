# Chrome Web Store Submission Checklist

**Extension**: PlanMyPeak Importer
**Version**: 1.0.34
**Submission Date**: February 21, 2026
**Visibility**: Private (Trusted Testers)

---

## ✅ Pre-Submission Checklist

### Required Files

- [x] Distribution package: `planmypeak-importer-v1.0.34.zip` (101KB)
- [x] Privacy policy: `PRIVACY.md`
- [x] Submission guide: `CHROME_WEB_STORE_SUBMISSION.md`
- [x] Icons: 16x16, 48x48, 128x128 (PP logo with blue gradient)
- [x] Manifest version: 1.0.34
- [x] Extension name: "PlanMyPeak Importer"

### Code Quality

- [x] Authentication working correctly
- [x] Workout duration displays correctly (fixed decimal hours issue)
- [x] TSS values rounded (no decimals)
- [x] Multi-sport support (cycling, running, swimming)
- [x] Error handling implemented
- [x] All API headers correct

### Branding

- [x] Extension renamed to "PlanMyPeak Importer"
- [x] Popup title: "PlanMyPeak Importer"
- [x] Icons updated to PP logo
- [x] No TrainingPeaks trademark references in name

---

## 📸 Screenshots Needed

You need to take 3-5 screenshots before submission:

### Screenshot 1: Authentication Status ⭐ REQUIRED

**What to show:**

- Extension popup open
- "Authenticated" green status badge
- User info visible
- Token age displayed

**How to capture:**

1. Open extension popup
2. Right-click → Inspect
3. Click device toolbar (📱 icon)
4. Set size to 1280x800
5. Screenshot with Cmd+Shift+4

### Screenshot 2: Library List View ⭐ REQUIRED

**What to show:**

- List of workout libraries
- Library names and owner info
- Clean, organized layout

### Screenshot 3: Workout Details

**What to show:**

- Opened library with workouts
- Workout cards showing:
  - Duration (e.g., "60m", "1h 30m")
  - TSS values (rounded)
  - IF, distance, elevation
  - Descriptions

### Screenshot 4: Workout Card (Optional)

**What to show:**

- Close-up of a single workout card
- All metrics visible
- Coach comments if available

### Screenshot 5: Multi-Sport Support (Optional)

**What to show:**

- Swim or run workouts
- "N/A" for null values
- Different workout types

---

## 🏪 Store Listing Details

### Basic Information

**Item Title** (max 45 characters):

```
PlanMyPeak Importer
```

**Short Description** (max 132 characters):

```
Access your TrainingPeaks workout libraries directly from your browser. View, search, and explore your training plans.
```

**Detailed Description** (copy/paste below):

```
# PlanMyPeak Importer

Browse your TrainingPeaks workout libraries without leaving your browser.

## Features

✅ **Instant Authentication** - Automatically detects when you're logged into TrainingPeaks
✅ **Library Browser** - View all your workout libraries in one place
✅ **Workout Details** - See key metrics: TSS, IF, distance, elevation, duration
✅ **Multi-Sport Support** - Cycling, running, and swimming workouts
✅ **Search & Filter** - Quickly find the workouts you need
✅ **Privacy First** - All data stays local, no third-party tracking

## How It Works

1. **Log into TrainingPeaks** at app.trainingpeaks.com
2. **Click the extension icon** in your browser toolbar
3. **Browse your libraries** - all your workouts at your fingertips

## Privacy & Security

- Your authentication token is stored securely in your browser
- No data is sent to third parties
- All communication is directly with TrainingPeaks API
- Open source code available for review

## Requirements

- Active TrainingPeaks account
- Chrome browser
- Internet connection

## Support

- GitHub: https://github.com/eduardoarantes/cycling_coach_browser_plugin
- Issues: https://github.com/eduardoarantes/cycling_coach_browser_plugin/issues

**Note**: This is an independent project and is not affiliated with TrainingPeaks.
```

**Category**: Productivity

**Language**: English (United States)

---

## 🔒 Privacy & Permissions

### Single Purpose Statement

```
Access and display TrainingPeaks workout library data for athletes and coaches
```

### Permission Justifications

**Storage Permission**:

```
Store authentication token securely in the user's browser using Chrome's encrypted storage API. Token is needed to authenticate API requests to TrainingPeaks.
```

**Host Permission: https://tpapi.trainingpeaks.com/***:

```
Fetch workout library data, user profile, and training plans from TrainingPeaks API. All requests use the user's authentication token.
```

**Host Permission: https://app.trainingpeaks.com/***:

```
Intercept authentication token when user logs into TrainingPeaks web application. Token is captured from legitimate user session and stored locally.
```

### Privacy Policy URL

Choose one:

**Option 1 - GitHub Raw** (immediate):

```
https://raw.githubusercontent.com/eduardoarantes/cycling_coach_browser_plugin/main/PRIVACY.md
```

**Option 2 - GitHub Pages** (recommended):

1. Enable GitHub Pages in repo settings
2. Use: `https://eduardoarantes.github.io/cycling_coach_browser_plugin/PRIVACY`

---

## 🎨 Graphic Assets

### Icons (Already Prepared)

- ✅ 16x16: `public/icons/icon16.png` (PP logo)
- ✅ 48x48: `public/icons/icon48.png` (PP logo)
- ✅ 128x128: `public/icons/icon128.png` (PP logo)

### Screenshots (You Need to Create)

- [ ] Screenshot 1: Authentication (1280x800)
- [ ] Screenshot 2: Library list (1280x800)
- [ ] Screenshot 3: Workout details (1280x800)
- [ ] Screenshot 4 (optional): Workout card (1280x800)
- [ ] Screenshot 5 (optional): Multi-sport (1280x800)

### Promotional Tile (Optional)

- 440x280 PNG or JPEG
- Show PP logo and extension name

---

## 👥 Private Distribution Setup

### Visibility Settings

- ✅ Select: **Private**
- ❌ Do NOT select: Public or Unlisted

### Trusted Testers

Add email addresses (Google accounts) of testers:

```
tester1@example.com
tester2@example.com
tester3@example.com
```

**Notes**:

- Maximum 100 testers
- Email addresses must be exact (case-sensitive)
- Testers must have Google accounts

---

## 📋 Submission Steps

### Step 1: Create Developer Account

- [ ] Go to https://chrome.google.com/webstore/devconsole
- [ ] Pay $5 one-time registration fee
- [ ] Complete registration

### Step 2: Take Screenshots

- [ ] Open extension and take 3-5 screenshots at 1280x800
- [ ] Save as PNG files
- [ ] Name clearly (e.g., auth-status.png, library-list.png)

### Step 3: Upload Extension

- [ ] Click "New Item" in dashboard
- [ ] Upload `planmypeak-importer-v1.0.34.zip`
- [ ] Wait for upload to complete (usually <1 minute)

### Step 4: Fill Store Listing

- [ ] Item title: "PlanMyPeak Importer"
- [ ] Summary: (copy from above)
- [ ] Description: (copy from above)
- [ ] Category: Productivity
- [ ] Language: English (United States)
- [ ] Upload icon: `public/icons/icon128.png`
- [ ] Upload screenshots (3-5 images)

### Step 5: Configure Privacy

- [ ] Single purpose: (copy from above)
- [ ] Permission justifications: (copy from above)
- [ ] Privacy policy URL: (choose GitHub option)
- [ ] Certify data handling practices

### Step 6: Set Distribution

- [ ] Click "Distribution" tab
- [ ] Select "Private"
- [ ] Add trusted tester email addresses
- [ ] Save changes

### Step 7: Submit for Review

- [ ] Review all information
- [ ] Click "Submit for Review"
- [ ] Wait for email confirmation

### Step 8: Wait for Approval

- [ ] Review time: 1-3 business days
- [ ] Check email for updates
- [ ] Address any feedback if rejected

### Step 9: Share with Testers

- [ ] Copy extension URL from dashboard
- [ ] Share link with testers via email
- [ ] Testers can install from Chrome Web Store

---

## 🚨 Common Rejection Reasons

### How to Avoid Rejection

**Single Purpose Violation**:

- ✅ Our description clearly states: "Access and display workout library data"
- ✅ Extension does exactly one thing: browse TrainingPeaks libraries

**Privacy Policy Issues**:

- ✅ Privacy policy is publicly accessible
- ✅ Clear data collection disclosure
- ✅ Permission justifications provided

**Permission Issues**:

- ✅ All permissions clearly justified
- ✅ Minimal permissions requested
- ✅ Host permissions explained

**Manifest Errors**:

- ✅ Manifest V3 compliant
- ✅ All required fields present
- ✅ Valid version number

**Trademark Issues**:

- ✅ Name changed to "PlanMyPeak Importer"
- ✅ No TrainingPeaks trademark in extension name
- ✅ Disclaimer: "Independent project, not affiliated with TrainingPeaks"

---

## 📊 Post-Submission

### During Review (1-3 days)

- Check email daily for updates
- Keep Chrome Web Store Developer Dashboard open
- Be ready to respond to reviewer questions

### If Approved ✅

1. You'll receive approval email
2. Extension goes live for trusted testers
3. Share installation link with testers
4. Testers get automatic updates

### If Rejected ❌

1. Read rejection reason carefully
2. Fix issues mentioned
3. Update zip package
4. Resubmit (usually faster second time)

---

## 🔄 Future Updates

When you make changes:

```bash
# Make code changes
npm run build

# Create new zip
cd dist && zip -r ../planmypeak-importer-v1.0.XX.zip . && cd ..

# Upload to Chrome Web Store
# Go to dashboard → Select item → Upload new version
```

Trusted testers receive automatic updates!

---

## ✨ Final Checks Before Submission

### Test the Extension Locally

- [ ] Install from `dist/` folder
- [ ] Log into TrainingPeaks
- [ ] Verify authentication works
- [ ] Browse libraries successfully
- [ ] Check all workout metrics display correctly
- [ ] Test with cycling, running, and swim workouts

### Review Package Contents

- [ ] Open `planmypeak-importer-v1.0.34.zip`
- [ ] Verify manifest.json name: "PlanMyPeak Importer"
- [ ] Verify version: "1.0.34"
- [ ] Check icons are PP logo (not old icons)

### Documentation Ready

- [ ] PRIVACY.md is up to date
- [ ] CHROME_WEB_STORE_SUBMISSION.md is accurate
- [ ] README reflects current features

---

## 📞 Support Contacts

**If you get stuck:**

- Chrome Web Store Help: https://support.google.com/chrome/a/answer/2714278
- Developer Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Review Process: https://developer.chrome.com/docs/webstore/review-process/

**Common Questions:**

- Review taking too long? Check dashboard for messages
- Testers can't install? Verify their email is added correctly
- Extension not updating? Wait 1-2 hours for propagation

---

## 🎉 You're Ready!

All files are prepared and ready for Chrome Web Store submission.

**Distribution Package**: `planmypeak-importer-v1.0.34.zip` ✅
**Documentation**: Complete ✅
**Icons**: PP logo ready ✅
**Privacy Policy**: Published ✅

**Next Steps**:

1. Take 3-5 screenshots
2. Create Chrome Web Store Developer account ($5)
3. Follow submission steps above
4. Wait 1-3 days for approval
5. Share with your testers!

Good luck! 🚀

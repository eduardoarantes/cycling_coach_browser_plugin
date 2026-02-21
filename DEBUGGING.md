# Debugging Guide - TrainingPeaks Extension

## Issue: Extension Shows "Not Authenticated" Despite Being Logged In

If you're logged into TrainingPeaks but the extension shows "Not Authenticated", follow this debugging guide to diagnose the issue.

---

## Quick Fix Steps

### 1. Rebuild and Reload Extension

```bash
# Rebuild with debug logging enabled
npm run build

# Or use make
make build
```

**In Brave/Chrome:**

1. Go to `brave://extensions/` (or `chrome://extensions/`)
2. Find "TrainingPeaks Library Access"
3. Click the refresh/reload icon (⟳)
4. The extension should now have enhanced debug logging

### 2. Check Debug Logs

#### A. Content Script Logs (TrainingPeaks Page)

1. Navigate to `https://app.trainingpeaks.com`
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Look for messages prefixed with `[TP Extension - Content]`

**Expected logs when working:**

```
[TP Extension - Content] 🚀 Content script loaded on: https://app.trainingpeaks.com/...
[TP Extension - Content] 📋 User agent: Mozilla/5.0 ...
[TP Extension - Content] 🔍 Environment check:
[TP Extension - Content]   - chrome.runtime available: true
[TP Extension - Content]   - Extension ID: abcdef123456...
[TP Extension - Content]   - Can send messages: true
[TP Extension - Content] ✅ Token interceptor fully loaded and active
```

**When API request is made with auth:**

```
[TP Extension - Content] 📡 Fetch request #1: https://tpapi.trainingpeaks.com/...
[TP Extension - Content]   ✓ Has headers, Authorization: present
[TP Extension - Content]   🎫 BEARER TOKEN FOUND! Length: 1234
[TP Extension - Content]   📤 Sending token to background script...
[TP Extension - Content]   ✅ Token sent successfully to background
```

**Red Flags:**

- ❌ No content script logs at all → Content script not loading
- ❌ "chrome.runtime available: false" → Extension context issue
- ❌ "Failed to send token to background" → Communication error

#### B. Background Service Worker Logs

1. Go to `brave://extensions/` (or `chrome://extensions/`)
2. Find "TrainingPeaks Library Access"
3. Click **"service worker"** link (or "Inspect views: service worker")
4. Console opens showing background logs

**Expected logs when working:**

```
[TP Extension - Background] 🚀 Background service worker loaded
[TP Extension - Background] 📦 Extension installed/updated, reason: install
[TP Extension - Background] 📨 Message received: {type: "TOKEN_FOUND", from: "tab 123"}
[TP Extension - Background] 🎫 Storing bearer token, length: 1234
[TP Extension - Background] ✅ Token stored successfully in chrome.storage.local
[TP Extension - Background] 🔍 Verification - Token exists: true
```

**Red Flags:**

- ❌ No "Message received" logs → Content script not sending messages
- ❌ "Failed to store token" → Storage permission issue

#### C. Popup Logs

1. Click the extension icon to open popup
2. Right-click inside popup → "Inspect"
3. Console shows popup logs

**Expected when authenticated:**

```
Auth store checking authentication...
Token found: true
```

**Expected when not authenticated:**

```
Auth store checking authentication...
Token found: false
isAuthenticated: false
```

---

## Common Issues & Solutions

### Issue 1: Content Script Not Loading

**Symptoms:**

- No `[TP Extension - Content]` logs in TrainingPeaks page console
- Extension icon shows "Not Authenticated"

**Possible Causes:**

1. **Extension not reloaded after rebuild**
   - Solution: Go to `brave://extensions/`, click reload (⟳)

2. **Manifest not configured correctly**
   - Check: Open `dist/manifest.json`, verify:
     ```json
     "content_scripts": [{
       "matches": ["https://app.trainingpeaks.com/*"],
       "js": ["src/content/tokenInterceptor.ts"],
       "run_at": "document_start"
     }]
     ```

3. **Brave shields blocking content script**
   - Solution: Click Brave shield icon, set shields to "Down" for TrainingPeaks
   - Or: Add exception for extension content scripts

4. **Page loaded before extension installed**
   - Solution: Refresh TrainingPeaks page (Cmd+R / Ctrl+R)

### Issue 2: No API Requests Being Made

**Symptoms:**

- Content script logs show it loaded
- But no "Fetch request" logs appear

**Why this happens:**

- If you're already logged in, TrainingPeaks might not make new API requests immediately
- The app caches data and may not hit the API until you navigate

**Solution:**

1. Navigate within TrainingPeaks app:
   - Click "Calendar"
   - Click "Dashboard"
   - Click "Workouts"
   - Open a workout detail page
2. Watch console for API requests
3. Look for requests to `tpapi.trainingpeaks.com`

### Issue 3: API Requests Without Authorization Header

**Symptoms:**

- Fetch requests logged
- But "Authorization: none" shown

**Why this happens:**

- Some TrainingPeaks requests don't require auth (public endpoints)
- Token only appears on authenticated API calls

**Solution:**

- Keep navigating the app to trigger authenticated requests
- Try: Open workout details, view athlete data, access library

### Issue 4: Brave-Specific Blocking

**Symptoms:**

- Works in Chrome but not Brave
- Content script loads but messages fail

**Brave differences:**

- Brave has stricter content script isolation
- Brave may block cross-context messaging

**Solutions:**

1. **Disable Brave Shields for TrainingPeaks:**
   - Click Brave shield icon on TrainingPeaks page
   - Set shields to "Down"
   - Refresh page

2. **Check Brave's extension settings:**
   - Go to `brave://settings/extensions`
   - Ensure "Allow in Incognito" is checked (if using incognito)

3. **Grant site access:**
   - Right-click extension icon → "Manage Extension"
   - Scroll to "Site access"
   - Select "On all sites" or "On specific sites"
   - Add `https://app.trainingpeaks.com`

### Issue 5: Extension ID Changes

**Symptoms:**

- "Extension context invalidated" error
- Messages fail with "cannot establish connection"

**Why this happens:**

- Extension ID changes when reloaded in developer mode (sometimes)

**Solution:**

- Close and reopen TrainingPeaks page
- Reload extension again
- Check extension ID in logs matches

---

## Manual Token Extraction (Workaround)

If automatic interception isn't working, you can manually extract the token:

### Method 1: Network Tab

1. Open TrainingPeaks: `https://app.trainingpeaks.com`
2. Open DevTools → **Network** tab
3. Filter: `tpapi` or `api`
4. Navigate in TrainingPeaks to trigger API call
5. Click any API request
6. Go to **Headers** tab
7. Find **Request Headers** → `Authorization`
8. Copy the value: `Bearer eyJ...`

### Method 2: Console Extraction

1. Open TrainingPeaks page
2. Open DevTools → **Console**
3. Paste this code:

```javascript
// Intercept fetch temporarily
const _fetch = window.fetch;
window.fetch = async (...args) => {
  const [url, opts] = args;
  if (opts?.headers) {
    const h = new Headers(opts.headers);
    const auth = h.get('authorization');
    if (auth) console.log('🎫 TOKEN:', auth);
  }
  return _fetch(...args);
};
console.log('✅ Token interceptor active - navigate to trigger API call');
```

4. Navigate within TrainingPeaks
5. Watch console for `🎫 TOKEN:` output
6. Copy the full token (including "Bearer ")

### Method 3: Manual Storage

Once you have the token, store it manually:

1. Open extension popup
2. Right-click → Inspect
3. Go to **Console**
4. Run:

```javascript
chrome.storage.local.set(
  {
    auth_token: 'YOUR_TOKEN_HERE', // Just the token, no "Bearer" prefix
    token_timestamp: Date.now(),
  },
  () => {
    console.log('Token stored manually');
  }
);
```

5. Close and reopen popup - should show "Authenticated"

---

## Verification Checklist

Use this checklist to verify each component:

### ✅ Extension Installed

- [ ] Extension appears in `brave://extensions/`
- [ ] Extension is **enabled** (toggle is blue/on)
- [ ] No errors shown in extension card

### ✅ Content Script Active

- [ ] Logs appear in TrainingPeaks page console
- [ ] "Content script loaded" message visible
- [ ] "Extension ID" is shown (not "UNKNOWN")
- [ ] "Can send messages: true"

### ✅ Background Worker Active

- [ ] "service worker" link is visible and blue (not gray)
- [ ] Click it - console opens
- [ ] "Background service worker loaded" message visible

### ✅ API Requests Happening

- [ ] Navigate in TrainingPeaks app
- [ ] "Fetch request #X" logs appear in console
- [ ] Requests to `tpapi.trainingpeaks.com` visible

### ✅ Token Interception

- [ ] "BEARER TOKEN FOUND!" message appears
- [ ] "Token sent successfully" message appears
- [ ] Background logs show "Token stored successfully"

### ✅ Popup Shows Authentication

- [ ] Click extension icon - popup opens
- [ ] Shows green "Authenticated" box (not yellow "Not Authenticated")
- [ ] Shows "Token obtained Xm ago"

---

## Still Not Working?

### Collect Debug Info

Run this in **TrainingPeaks page console**:

```javascript
console.log('=== DEBUG INFO ===');
console.log('URL:', window.location.href);
console.log('User agent:', navigator.userAgent);
console.log('Chrome runtime:', typeof chrome?.runtime);
console.log('Extension ID:', chrome?.runtime?.id);
console.log('Can send messages:', typeof chrome?.runtime?.sendMessage);
```

Run this in **Extension popup console**:

```javascript
chrome.storage.local.get(['auth_token', 'token_timestamp'], (data) => {
  console.log('=== STORAGE INFO ===');
  console.log('Has token:', !!data.auth_token);
  console.log('Token length:', data.auth_token?.length || 0);
  console.log('Has timestamp:', !!data.token_timestamp);
  if (data.token_timestamp) {
    const age = Date.now() - data.token_timestamp;
    console.log('Token age (hours):', (age / 1000 / 60 / 60).toFixed(2));
  }
});
```

### Contact Information

Create an issue with:

- Browser: Brave [version]
- OS: [macOS/Windows/Linux]
- Debug logs from content script
- Debug logs from background worker
- Screenshots of error messages

---

## Advanced Debugging

### Check Manifest in Dist

```bash
cat dist/manifest.json
```

Verify content_scripts section is correct.

### Check Build Output

```bash
ls -la dist/
```

Should include:

- `manifest.json`
- `src/content/tokenInterceptor.ts` (or .js)
- `src/background/index.ts` (or .js)
- `src/popup/index.html`

### Inspect Chrome Storage

In extension popup console or background console:

```javascript
chrome.storage.local.get(null, (all) => {
  console.log('All storage:', all);
});
```

### Clear Extension Storage

If you want to start fresh:

```javascript
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});
```

---

## Development Mode Tips

### Enable Verbose Logging

Debug mode is already enabled. To disable it:

Edit `src/content/tokenInterceptor.ts`:

```typescript
const DEBUG = false; // Change to false
```

Edit `src/background/index.ts`:

```typescript
const DEBUG = false; // Change to false
```

Then rebuild: `npm run build`

### Watch for Changes

```bash
# Development mode with hot reload
npm run dev
```

Note: You still need to reload extension in browser after changes.

---

## Next Steps

Once token interception is working:

- Extension will show "Authenticated"
- You'll see the token age
- Ready for Phase 3: API integration to fetch workout libraries

**See**: Main CLAUDE.md for full project documentation

# Testing Guide

## Automated Testing

### Unit Tests

**Status**: ✅ **22 tests passing** with **100% coverage** on services layer

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm test

# Run with coverage report
npm run coverage
```

**Current Coverage**:

- `authService.ts`: 100% (13 tests)
- `storageService.ts`: 100% (9 tests)
- `storage.schema.ts`: 100% (Zod validation tested)
- `constants.ts`: 100%

### Test Files

- `tests/unit/services/authService.test.ts` - Authentication logic tests
- `tests/unit/services/storageService.test.ts` - Storage operations tests
- `tests/setup.ts` - Chrome API mocks for testing

### What's Tested

**Authentication Service**:

- ✅ Token storage and retrieval
- ✅ Token validation (empty, whitespace)
- ✅ Token age calculation
- ✅ Token expiration detection (24-hour threshold)
- ✅ Authentication state checking
- ✅ Token clearing

**Storage Service**:

- ✅ Token storage with timestamp
- ✅ Token retrieval with Zod validation
- ✅ Null handling when no token exists
- ✅ Token clearing
- ✅ Token existence checking

## Manual Testing in Chrome

### Load Extension in Developer Mode

1. **Build the extension**:

   ```bash
   npm run build
   ```

2. **Open Chrome Extensions page**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)

3. **Load unpacked extension**:
   - Click "Load unpacked"
   - Select the `dist/` directory
   - Extension should appear in your toolbar

### Test Scenarios

#### Scenario 1: Unauthenticated State

1. Load the extension (without visiting TrainingPeaks)
2. Click extension icon
3. **Expected**: Yellow banner showing "Not Authenticated"
4. **Expected**: Message to log in to TrainingPeaks

#### Scenario 2: Token Interception

1. Visit https://app.trainingpeaks.com
2. Log in to TrainingPeaks
3. Open browser DevTools → Network tab
4. Filter for requests to `tpapi.trainingpeaks.com`
5. Click around TrainingPeaks to trigger API requests
6. Open extension popup
7. **Expected**: Green banner showing "Authenticated"
8. **Expected**: Token age displayed (e.g., "0m ago")

#### Scenario 3: Token Persistence

1. After authenticating (Scenario 2)
2. Close and reopen Chrome
3. Open extension popup (without visiting TrainingPeaks again)
4. **Expected**: Still shows "Authenticated" (token persisted)

#### Scenario 4: Token Refresh

1. While authenticated, click "Refresh" button
2. **Expected**: Loading spinner appears briefly
3. **Expected**: Returns to "Authenticated" state
4. **Expected**: Token age updates

#### Scenario 5: Authentication Error

1. Manually corrupt storage (optional):
   ```javascript
   // In DevTools console on extension popup
   chrome.storage.local.set({ auth_token: null });
   ```
2. Click "Refresh"
3. **Expected**: Shows appropriate error state

### Debug Console Output

With `DEV` mode (during `npm run dev`), check browser console for:

- `[TrainingPeaks Library Access] Token stored successfully`
- `[TrainingPeaks Library Access] Background received message: TOKEN_FOUND`

**Production mode** (`npm run build`): No console output (security)

## End-to-End Testing (Future)

### Playwright Setup (Planned)

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests (when implemented)
npm run test:e2e
```

**Planned E2E Scenarios**:

- Full authentication flow in real Chrome with TrainingPeaks
- Library fetching after authentication
- Token expiration handling
- Multi-tab sync behavior

## Testing Checklist

### Before Committing Code

- [ ] `npm run lint` passes (0 errors, 0 warnings)
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run test:unit` passes (all tests green)
- [ ] `npm run build` succeeds (no build errors)

### Before Releasing

- [ ] Unit test coverage >80% overall
- [ ] Manual testing completed for all scenarios
- [ ] Extension loads without errors in Chrome
- [ ] Token interception works on app.trainingpeaks.com
- [ ] Authentication state persists across browser restarts

## Continuous Integration

Tests run automatically on every commit via Husky pre-commit hook:

- ✅ Code formatting (Prettier)
- ✅ Linting (ESLint)
- ✅ Type checking (TypeScript)
- ✅ Commit message validation (Commitlint)

**Future**: GitHub Actions will run full test suite on PRs.

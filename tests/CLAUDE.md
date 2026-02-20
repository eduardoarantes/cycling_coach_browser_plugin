# Testing Guide (`tests/`)

**Purpose**: Comprehensive test suite for the TrainingPeaks browser extension.
**Framework**: Vitest 4.0.18 + Playwright 1.58.2
**Current Coverage**: 100% on services layer (22 tests passing)

---

## Quick Start

```bash
# Run all unit tests
make test-unit

# Run tests in watch mode
make test

# Generate coverage report
make coverage

# Run E2E tests (when implemented)
make test-e2e
```

---

## Directory Structure

```
tests/
├── unit/               # Unit tests (isolated functions)
│   └── services/       # Service layer tests
│       ├── authService.test.ts      (13 tests ✅)
│       └── storageService.test.ts   (9 tests ✅)
├── integration/        # Integration tests (multiple layers)
│   └── [future] api.test.ts
├── components/         # React component tests
│   └── [future] AuthStatus.test.tsx
├── e2e/                # End-to-end tests (full workflows)
│   ├── [future] authenticated.spec.ts
│   └── helpers/
│       └── [future] setup.ts
└── setup.ts            # Global test configuration
```

---

## Test Pyramid Strategy

```
       /\
      /E2E\       ← Few tests, full integration (Playwright)
     /------\         Future: 5-10 critical paths
    /  INT   \    ← More tests, multiple layers (Vitest)
   /----------\       Future: API + service integration
  /   UNIT     \  ← Most tests, isolated logic (Vitest)
 /--------------\     Current: 22 tests, 100% coverage
```

**Current Status**:

- ✅ Unit: 22 tests (100% coverage on services)
- ⏳ Integration: Not implemented
- ⏳ Component: Not implemented
- ⏳ E2E: Not implemented

---

## Testing Philosophy

### What to Test

**DO Test**:

- ✅ Business logic in services
- ✅ Data validation (Zod schemas)
- ✅ State management (Zustand stores)
- ✅ Error handling and edge cases
- ✅ API integrations
- ✅ User workflows (E2E)

**DON'T Test**:

- ❌ Third-party library internals
- ❌ Browser APIs (assume they work)
- ❌ Trivial getters/setters
- ❌ Implementation details

### Coverage Goals

**Overall Target**: >80%

- Services: >90% (currently 100% ✅)
- Components: >80% (future)
- Integration: Critical paths only
- E2E: 5-10 key user flows

---

## Unit Testing (Vitest)

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import * as myService from '@/services/myService';

describe('myService', () => {
  // Setup runs before each test
  beforeEach(() => {
    // Clean state
  });

  describe('functionName', () => {
    it('should do expected behavior when condition', () => {
      // Arrange: Set up test data
      const input = 'test-data';

      // Act: Execute the function
      const result = myService.functionName(input);

      // Assert: Verify the result
      expect(result).toBe('expected-output');
    });

    it('should throw error when invalid input', () => {
      expect(() => myService.functionName('')).toThrow('Error message');
    });
  });
});
```

### Test Naming Convention

**Pattern**: `should [expected behavior] when [condition]`

**Examples**:

```typescript
✅ it('should return null when no token exists')
✅ it('should return true when valid token exists')
✅ it('should reject empty token')
✅ it('should calculate token age in milliseconds')

❌ it('test token retrieval')
❌ it('works')
❌ it('returns data')
```

### Async Testing

```typescript
// Async tests
it('should store token successfully', async () => {
  await myService.setToken('test-token');

  const token = await myService.getToken();
  expect(token).toBe('test-token');
});

// Promise rejection
it('should reject empty token', async () => {
  await expect(myService.setToken('')).rejects.toThrow('Token cannot be empty');
});
```

### Chrome API Mocking

All Chrome APIs are mocked in `tests/setup.ts`:

```typescript
// Mock chrome.storage.local
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        /* ... */
      }),
      set: vi.fn((items) => {
        /* ... */
      }),
      remove: vi.fn((keys) => {
        /* ... */
      }),
      clear: vi.fn(() => {
        /* ... */
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve({ success: true })),
    onMessage: {
      addListener: vi.fn(),
    },
  },
} as never;
```

**Usage**:

```typescript
// Mocks are automatically available
it('should use chrome.storage', async () => {
  await chrome.storage.local.set({ key: 'value' });

  expect(chrome.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
});
```

### Vitest Matchers

**Common Assertions**:

```typescript
// Equality
expect(value).toBe(expected); // Strict equality (===)
expect(value).toEqual(expected); // Deep equality
expect(value).toStrictEqual(expected); // Strict deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(number).toBeGreaterThan(5);
expect(number).toBeLessThan(10);
expect(number).toBeGreaterThanOrEqual(5);
expect(number).toBeLessThanOrEqual(10);

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', 'value');

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('Error message');
await expect(asyncFn()).rejects.toThrow();

// Function calls (with vi.fn() mocks)
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(2);
```

---

## Integration Testing

**Purpose**: Test interaction between multiple layers.

**Example** (Future):

```typescript
// tests/integration/api.test.ts
import { describe, it, expect } from 'vitest';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/store/authStore';

describe('API Integration', () => {
  it('should fetch libraries with authenticated token', async () => {
    // Set up auth state
    const { setToken } = useAuthStore.getState();
    await setToken('valid-token');

    // Call API through service
    const libraries = await apiService.getLibraries();

    // Verify results
    expect(libraries).toBeInstanceOf(Array);
    expect(libraries[0]).toHaveProperty('id');
  });
});
```

---

## Component Testing (React Testing Library)

**Purpose**: Test React components in isolation.

**Example** (Future):

```typescript
// tests/components/AuthStatus.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthStatus } from '@/popup/components/AuthStatus';

describe('AuthStatus', () => {
  it('should display unauthenticated state', () => {
    render(<AuthStatus />);

    expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    expect(screen.getByText(/log in to TrainingPeaks/i)).toBeInTheDocument();
  });

  it('should display authenticated state with token age', async () => {
    // Mock auth state
    useAuthStore.setState({ isAuthenticated: true, tokenAge: 300000 });

    render(<AuthStatus />);

    expect(screen.getByText('Authenticated')).toBeInTheDocument();
    expect(screen.getByText(/5m ago/i)).toBeInTheDocument();
  });

  it('should call refreshAuth when refresh button clicked', async () => {
    const { user } = renderWithUser(<AuthStatus />);

    await user.click(screen.getByText('Refresh'));

    expect(mockRefreshAuth).toHaveBeenCalled();
  });
});
```

**Testing Library Queries** (Preference Order):

1. `getByRole` - Best for accessibility
2. `getByLabelText` - Good for form inputs
3. `getByText` - Good for non-interactive elements
4. `getByTestId` - Last resort

**Avoid**:

- `getByClassName` - Implementation detail
- `querySelector` - Too brittle

---

## E2E Testing (Playwright)

**Purpose**: Test complete user workflows in real browser.

**Setup** (Future):

```typescript
// tests/e2e/authenticated.spec.ts
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test('complete authenticated workflow', async () => {
  // Load extension in Chrome
  const pathToExtension = path.join(__dirname, '../../dist');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  // Navigate to TrainingPeaks
  const page = await context.newPage();
  await page.goto('https://app.trainingpeaks.com');

  // Verify login page appears
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

  // Login (credentials from env vars)
  await page.fill('[name="email"]', process.env.TP_EMAIL!);
  await page.fill('[name="password"]', process.env.TP_PASSWORD!);
  await page.click('[type="submit"]');

  // Wait for dashboard
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

  // Open extension popup
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.click('chrome-extension-icon'), // Platform-specific
  ]);

  // Verify authenticated state in popup
  await expect(popup.locator('.bg-green-50')).toBeVisible();
  await expect(popup.locator('text=Authenticated')).toBeVisible();

  // Verify libraries loaded
  await expect(popup.locator('[data-testid="library-card"]')).toHaveCount(
    expect.any(Number)
  );

  await context.close();
});
```

**E2E Best Practices**:

- Use `data-testid` attributes for reliable selectors
- Test critical user paths only (not every variation)
- Use environment variables for credentials
- Clean up test data after each run
- Run in CI with headless mode

---

## Coverage Reporting

### Generate Coverage

```bash
# Run tests with coverage
make coverage

# View HTML report
open coverage/index.html
```

### Coverage Output

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |      100 |     100 |     100 |
 schemas           |     100 |      100 |     100 |     100 |
  storage.schema   |     100 |      100 |     100 |     100 |
 services          |     100 |      100 |     100 |     100 |
  authService      |     100 |      100 |     100 |     100 |
  storageService   |     100 |      100 |     100 |     100 |
 utils             |     100 |      100 |     100 |     100 |
  constants        |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

### Coverage Thresholds

Configure in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

---

## Test Organization

### File Naming

```
tests/
├── unit/
│   └── services/
│       └── myService.test.ts      ← .test.ts suffix
├── integration/
│   └── api.test.ts
├── components/
│   └── MyComponent.test.tsx       ← .test.tsx for React
└── e2e/
    └── workflow.spec.ts           ← .spec.ts for E2E
```

### Test File Structure

```typescript
// 1. Imports
import { describe, it, expect, beforeEach } from 'vitest';
import * as myService from '@/services/myService';

// 2. Test suite
describe('myService', () => {
  // 3. Setup
  beforeEach(() => {
    // Reset state
  });

  // 4. Nested describe for each function
  describe('functionOne', () => {
    it('should handle case A', () => {
      // Test
    });

    it('should handle case B', () => {
      // Test
    });
  });

  describe('functionTwo', () => {
    it('should handle edge case', () => {
      // Test
    });
  });
});
```

---

## Common Testing Patterns

### Testing Async Functions

```typescript
it('should return data asynchronously', async () => {
  const result = await myService.fetchData();
  expect(result).toBeDefined();
});
```

### Testing Errors

```typescript
// Synchronous errors
it('should throw on invalid input', () => {
  expect(() => myService.validate('')).toThrow('Invalid input');
});

// Async errors
it('should reject on network failure', async () => {
  await expect(myService.fetchData()).rejects.toThrow('Network error');
});
```

### Testing Timers

```typescript
import { vi } from 'vitest';

it('should execute after delay', async () => {
  vi.useFakeTimers();

  const callback = vi.fn();
  setTimeout(callback, 1000);

  vi.advanceTimersByTime(1000);

  expect(callback).toHaveBeenCalled();

  vi.useRealTimers();
});
```

### Testing Zod Validation

```typescript
import { MySchema } from '@/schemas/mySchema';

it('should validate correct data', () => {
  const validData = { id: 1, name: 'Test' };
  const result = MySchema.parse(validData);
  expect(result).toEqual(validData);
});

it('should reject invalid data', () => {
  const invalidData = { id: 'not-a-number', name: 'Test' };
  expect(() => MySchema.parse(invalidData)).toThrow();
});
```

### Testing Zustand Stores

```typescript
import { useMyStore } from '@/store/myStore';

it('should update state correctly', () => {
  const { setState, getState } = useMyStore;

  // Initial state
  expect(getState().value).toBe(0);

  // Update state
  setState({ value: 42 });

  // Verify
  expect(getState().value).toBe(42);
});

it('should execute action', async () => {
  const { myAction, getState } = useMyStore;

  await myAction();

  expect(getState().data).toBeDefined();
});
```

---

## Debugging Tests

### Run Specific Test

```bash
# Run single file
npm test authService.test.ts

# Run tests matching pattern
npm test -- --grep "token"

# Run in watch mode
npm test -- --watch
```

### Debug Output

```typescript
it('should debug test', () => {
  const value = myService.calculate();

  console.log('Debug value:', value); // Shows in test output

  expect(value).toBe(expected);
});
```

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

## CI/CD Integration

### GitHub Actions (Future)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hooks

Already configured with Husky:

```json
// .husky/pre-commit
npm run lint
npm run type-check
```

**Add tests**:

```bash
# Edit .husky/pre-commit
npm run lint
npm run type-check
npm run test:unit  # Add this line
```

---

## Testing Checklist

### Before Committing

- [ ] All tests pass (`make test-unit`)
- [ ] Coverage >80% on new code
- [ ] No console.log left in tests
- [ ] Test names are descriptive
- [ ] Edge cases covered

### When Adding Feature

- [ ] Unit tests for services
- [ ] Integration tests for API calls
- [ ] Component tests for UI
- [ ] E2E test for critical path
- [ ] Update this guide if new patterns

### Before Release

- [ ] All test suites passing
- [ ] Coverage thresholds met
- [ ] E2E tests in real browser
- [ ] Manual testing completed (see TESTING.md)

---

## Common Issues

### "chrome is not defined"

**Cause**: Missing Chrome API mock
**Fix**: Add mock to `tests/setup.ts`

### "Cannot find module '@/...'"

**Cause**: Path alias not configured in vitest
**Fix**: Check `vitest.config.ts` has alias configured

### "Test timeout"

**Cause**: Async operation not awaited
**Fix**: Add `await` to async calls

### "Snapshot mismatch"

**Cause**: Component output changed
**Fix**: Review change, update snapshot if intentional

---

## Resources

**Vitest Docs**: https://vitest.dev/
**Testing Library**: https://testing-library.com/
**Playwright**: https://playwright.dev/
**Chrome Extension Testing**: https://developer.chrome.com/docs/extensions/mv3/tut_debugging/

---

**Next Steps**:

1. Add component tests for React UI
2. Add integration tests for API layer
3. Add E2E tests for critical workflows
4. Integrate with CI/CD pipeline

**See**: Main CLAUDE.md for project overview

# Source Code Guide (`src/`)

**Purpose**: This directory contains all source code for the TrainingPeaks browser extension.
**Language**: TypeScript 5.9.3 with strict mode
**Build Tool**: Vite 7.3.1 with @crxjs/vite-plugin

---

## Directory Structure

```
src/
├── background/          # Background service worker (Manifest V3)
├── content/            # Content scripts (run in web pages)
├── popup/              # Extension popup UI (React)
├── services/           # Business logic layer
├── store/              # State management (Zustand)
├── hooks/              # React custom hooks
├── schemas/            # Zod validation schemas
├── types/              # TypeScript type definitions
├── utils/              # Shared utilities
└── styles/             # Global CSS
```

---

## Layer Architecture

The codebase follows a **layered architecture** to maintain separation of concerns:

```
┌─────────────────────────────────────┐
│  UI Layer (popup/)                  │  ← React components
│  - Components, hooks, state         │
└─────────────────────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  State Layer (store/, hooks/)       │  ← Zustand + React Query
│  - Client state, server cache       │
└─────────────────────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Service Layer (services/)          │  ← Business logic
│  - Auth, storage, API calls         │
└─────────────────────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Data Layer (background/, storage)  │  ← Chrome APIs
│  - Service worker, chrome.storage   │
└─────────────────────────────────────┘
```

**Rules**:

- UI layer only talks to state layer (hooks/stores)
- State layer uses services for business logic
- Services interact with data layer (Chrome APIs)
- No layer skipping (e.g., UI cannot directly call Chrome APIs)

---

## Directory Details

### `background/` - Background Service Worker

**Purpose**: Persistent background process that handles extension lifecycle and message routing.

**Files**:

- `index.ts` - Service worker entry point, registers message listeners
- `messageHandler.ts` - Routes messages from content scripts and popup
- `api/` - API client implementations (Phase 3)

**Chrome APIs Used**:

- `chrome.runtime.onMessage` - Listen for messages
- `chrome.storage.local` - Store data

**Key Patterns**:

```typescript
// Message handling with discriminated unions
export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'TOKEN_FOUND':
    // Handle token storage
    case 'GET_TOKEN':
    // Retrieve token
    default:
    // Unknown message
  }
}
```

**Important**:

- Service worker can be terminated by Chrome at any time
- No global state (use chrome.storage for persistence)
- All async operations must complete before service worker sleeps

---

### `content/` - Content Scripts

**Purpose**: Scripts injected into web pages to interact with page content.

**Files**:

- `tokenInterceptor.ts` - Intercepts TrainingPeaks API requests to extract bearer tokens

**Injection Config** (in manifest.json):

```json
{
  "matches": ["https://app.trainingpeaks.com/*"],
  "run_at": "document_start",
  "js": ["src/content/tokenInterceptor.ts"]
}
```

**Key Patterns**:

```typescript
// Intercepting fetch API
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const [url, options] = args;
  // Extract token from headers
  // Send to background worker
  return originalFetch.apply(this, args);
};

// Intercepting XMLHttpRequest
XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
  // Track headers in WeakMap
  // Extract bearer token
  // Send to background
};
```

**Important**:

- Runs in page context (has access to `window` object)
- Cannot directly access Chrome extension APIs (must use messaging)
- Must not block page load or API requests

---

### `popup/` - Extension Popup UI

**Purpose**: React application displayed when user clicks extension icon.

**Structure**:

```
popup/
├── components/         # React components
│   └── AuthStatus.tsx  # Authentication status display
├── App.tsx            # Main application component
├── main.tsx           # React root + providers
├── index.html         # HTML template
└── [future]
    ├── LibraryList.tsx
    ├── LibraryCard.tsx
    └── ...
```

**Key Patterns**:

**Component Structure**:

```typescript
import type { ReactElement } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function MyComponent(): ReactElement {
  const { isAuthenticated } = useAuth();

  return (
    <div className="...">
      {/* Tailwind CSS classes */}
    </div>
  );
}
```

**Styling**:

- Use Tailwind CSS utility classes
- No inline styles
- Responsive by default (extension is 384px wide)

**State Management**:

- Use hooks for state access (don't import stores directly)
- Zustand for client state
- React Query for server state (Phase 3)

---

### `services/` - Business Logic Layer

**Purpose**: Pure business logic isolated from UI and Chrome APIs.

**Files**:

- `authService.ts` - Authentication logic (token validation, expiration)
- `storageService.ts` - Chrome storage wrapper with type safety
- `[future] apiService.ts` - TrainingPeaks API client

**Principles**:

- **Pure functions**: No side effects except storage/network
- **Testable**: All functions easily unit tested
- **Type-safe**: Strong TypeScript types for inputs/outputs
- **Validated**: Use Zod for runtime validation

**Example Structure**:

```typescript
// authService.ts

/**
 * Check if user is authenticated
 * @returns true if valid token exists
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await storageService.getToken();
  if (!token) return false;

  const expired = await isTokenExpired();
  return !expired;
}

/**
 * Store authentication token
 * @param token - Bearer token from TrainingPeaks
 * @throws Error if token is empty
 */
export async function setAuthToken(token: string): Promise<void> {
  if (!token.trim()) {
    throw new Error('Token cannot be empty');
  }
  await storageService.setToken(token);
}
```

**Testing**:

- 100% coverage required for services
- Mock Chrome APIs in tests (see `tests/setup.ts`)

---

### `store/` - State Management (Zustand)

**Purpose**: Client-side state management with Zustand.

**Files**:

- `authStore.ts` - Authentication state (token, loading, errors)

**Pattern**:

```typescript
import { create } from 'zustand';
import * as authService from '@/services/authService';

interface AuthState {
  // State
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isAuthenticated: false,
  token: null,
  isLoading: false,
  error: null,

  // Actions
  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await authService.getAuthToken();
      const isAuth = await authService.isAuthenticated();
      set({ token, isAuthenticated: isAuth, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ... more actions
}));
```

**Best Practices**:

- Keep stores small and focused
- Actions should call services, not contain business logic
- Use async/await for async operations
- Set loading/error states appropriately

---

### `hooks/` - Custom React Hooks

**Purpose**: Reusable React hooks that encapsulate state logic.

**Files**:

- `useAuth.ts` - Authentication hook (wraps authStore)
- `[future] useLibraries.ts` - React Query hook for libraries
- `[future] useUser.ts` - React Query hook for user info

**Pattern**:

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function useAuth(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  // ... return type
} {
  const {
    isAuthenticated,
    isLoading,
    error,
    checkAuth,
    // ... destructure from store
  } = useAuthStore();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    error,
    // ... return values
  };
}
```

**Future Pattern (React Query)**:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/apiService';

export function useLibraries() {
  return useQuery({
    queryKey: ['libraries'],
    queryFn: () => apiService.getLibraries(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

### `schemas/` - Zod Validation Schemas

**Purpose**: Runtime type validation with Zod.

**Files**:

- `storage.schema.ts` - Chrome storage data validation
- `[future] user.schema.ts` - User API response validation
- `[future] library.schema.ts` - Library API response validation

**Pattern**:

```typescript
import { z } from 'zod';

// Define schema
export const LibrarySchema = z.object({
  id: z.number(),
  name: z.string(),
  ownerId: z.number(),
  ownerName: z.string(),
  itemCount: z.number().optional(),
  isShared: z.boolean(),
});

// Export inferred type
export type Library = z.infer<typeof LibrarySchema>;

// Validate data
const library = LibrarySchema.parse(apiResponse);
```

**Benefits**:

- Runtime safety (catches API changes)
- TypeScript types derived from schema (single source of truth)
- Clear error messages when validation fails

**Use Cases**:

- Validate API responses
- Validate chrome.storage data
- Validate user input

---

### `types/` - TypeScript Type Definitions

**Purpose**: Shared TypeScript types and interfaces.

**Files**:

- `index.ts` - Core types (messages, storage, etc.)
- `[future] api.types.ts` - API request/response types

**Pattern**:

```typescript
// Discriminated union for messages
export interface TokenFoundMessage {
  type: 'TOKEN_FOUND';
  token: string;
  timestamp: number;
}

export interface GetTokenMessage {
  type: 'GET_TOKEN';
}

export type RuntimeMessage =
  | TokenFoundMessage
  | GetTokenMessage
  | ClearTokenMessage;

// This enables exhaustive type checking:
function handleMessage(msg: RuntimeMessage) {
  switch (msg.type) {
    case 'TOKEN_FOUND':
      msg.token; // ✅ TypeScript knows this exists
      break;
    case 'GET_TOKEN':
      msg.token; // ❌ TypeScript error
      break;
  }
}
```

**Guidelines**:

- Prefer `interface` over `type` for objects
- Use `type` for unions and complex types
- Export types from centralized location
- Use `const` assertions for literal types

---

### `utils/` - Shared Utilities

**Purpose**: Reusable utility functions and constants.

**Files**:

- `constants.ts` - Application constants
- `logger.ts` - Development logging utility

**`constants.ts`**:

```typescript
export const API_BASE_URL = 'https://tpapi.trainingpeaks.com';
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const EXTENSION_NAME = 'TrainingPeaks Library Access';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TOKEN_TIMESTAMP: 'token_timestamp',
} as const;
```

**`logger.ts`**:

```typescript
const isDev = import.meta.env.DEV;

export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    if (isDev) console.log(`[Extension] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[Extension ERROR] ${message}`, ...args);
  },
  // ... warn, debug
};
```

**Usage**:

```typescript
import { logger } from '@/utils/logger';
import { TOKEN_EXPIRY_MS } from '@/utils/constants';

logger.info('Token age:', age);

if (age > TOKEN_EXPIRY_MS) {
  logger.warn('Token expired');
}
```

---

### `styles/` - Global Styles

**Purpose**: Global CSS and Tailwind configuration.

**Files**:

- `globals.css` - Tailwind directives and global styles

**Content**:

```css
@import 'tailwindcss';

/* Tailwind layers */
@layer base {
  /* Base styles */
}

@layer components {
  /* Component classes */
}

@layer utilities {
  /* Custom utilities */
}
```

**Important**:

- Most styling done via Tailwind classes in components
- Global styles kept minimal
- Use CSS variables for theming (future dark mode)

---

## Coding Patterns

### Imports

**Always use path aliases**:

```typescript
// ❌ Bad
import { useAuth } from '../../hooks/useAuth';

// ✅ Good
import { useAuth } from '@/hooks/useAuth';
```

**Import order**:

```typescript
// 1. External libraries
import { create } from 'zustand';
import type { ReactElement } from 'react';

// 2. Internal modules
import { logger } from '@/utils/logger';
import * as authService from '@/services/authService';

// 3. Types (if not inline)
import type { RuntimeMessage } from '@/types';
```

### Error Handling

```typescript
// Services throw errors
export async function setAuthToken(token: string): Promise<void> {
  if (!token.trim()) {
    throw new Error('Token cannot be empty');
  }
  // ...
}

// Stores catch and set error state
async checkAuth() {
  try {
    const token = await authService.getAuthToken();
    set({ token, error: null });
  } catch (error) {
    logger.error('Auth check failed:', error);
    set({ error: error.message });
  }
}

// UI displays error state
if (error) {
  return <div className="text-red-600">{error}</div>;
}
```

### Async Operations

```typescript
// Always use async/await (not .then())
export async function getAuthToken(): Promise<string | null> {
  const token = await storageService.getToken();
  return token;
}

// Handle errors with try/catch
try {
  await setAuthToken(token);
} catch (error) {
  logger.error('Failed to set token:', error);
}
```

### Type Safety

```typescript
// Explicit return types
export async function isAuthenticated(): Promise<boolean> {
  // ...
}

// Explicit function types
type MessageResponse = { success: true } | { success: false; error: string };

export async function handleMessage(
  message: RuntimeMessage
): Promise<MessageResponse> {
  // ...
}
```

---

## Common Workflows

### Adding a New Service Function

1. **Define in service**:

   ```typescript
   // src/services/myService.ts
   export async function myFunction(): Promise<ReturnType> {
     // Implementation
   }
   ```

2. **Add tests**:

   ```typescript
   // tests/unit/services/myService.test.ts
   describe('myFunction', () => {
     it('should work correctly', async () => {
       const result = await myFunction();
       expect(result).toBe(expected);
     });
   });
   ```

3. **Use in store** (if needed):

   ```typescript
   // src/store/myStore.ts
   import * as myService from '@/services/myService';

   myAction: async () => {
     const result = await myService.myFunction();
     set({ data: result });
   };
   ```

4. **Expose via hook**:
   ```typescript
   // src/hooks/useMyData.ts
   export function useMyData() {
     const { myAction } = useMyStore();
     return { myAction };
   }
   ```

### Adding a New React Component

1. **Create component file**:

   ```typescript
   // src/popup/components/MyComponent.tsx
   import type { ReactElement } from 'react';

   export function MyComponent(): ReactElement {
     return <div>...</div>;
   }
   ```

2. **Import in parent**:

   ```typescript
   // src/popup/App.tsx
   import { MyComponent } from './components/MyComponent';
   ```

3. **Use in JSX**:
   ```typescript
   <MyComponent />
   ```

### Adding a Zod Schema

1. **Define schema**:

   ```typescript
   // src/schemas/myData.schema.ts
   import { z } from 'zod';

   export const MyDataSchema = z.object({
     id: z.number(),
     name: z.string(),
   });

   export type MyData = z.infer<typeof MyDataSchema>;
   ```

2. **Use for validation**:

   ```typescript
   import { MyDataSchema } from '@/schemas/myData.schema';

   const validated = MyDataSchema.parse(apiResponse);
   ```

---

## Performance Considerations

**Bundle Size**:

- Keep dependencies minimal
- Use tree-shaking
- Lazy load components if needed

**React Performance**:

- Avoid unnecessary re-renders
- Use `useMemo` / `useCallback` sparingly
- Keep components small and focused

**Chrome Extension Performance**:

- Service worker should complete quickly
- Don't block popup rendering
- Use background tasks for heavy operations

---

## Security Best Practices

**Token Handling**:

- ✅ Never log tokens (use logger which filters in production)
- ✅ Store in chrome.storage.local (encrypted by browser)
- ✅ Clear tokens on logout

**Content Script Safety**:

- ✅ Don't trust page content
- ✅ Validate all intercepted data
- ✅ Don't expose sensitive functions to page

**API Calls**:

- ✅ Validate responses with Zod
- ✅ Handle errors gracefully
- ✅ Don't expose internal errors to users

---

## Next Steps

**For Phase 3** (API Integration):

1. Create API type definitions
2. Add Zod schemas for API responses
3. Implement API service in `background/api/`
4. Configure React Query
5. Create data fetching hooks
6. Build library list UI components

**See**: Main CLAUDE.md for full roadmap

---

**For Questions**: See main CLAUDE.md or tests/CLAUDE.md for testing patterns

# Implementation Plan: Intervals.icu Export Adapter (Issue #51)

## Executive Summary

Create a comprehensive intervals.icu export adapter that allows users to export TrainingPeaks workout library items (single or bulk) to their intervals.icu calendar with full metadata preservation.

**User Confirmed Scope**:

- ✅ **Both single and bulk export** in MVP
- ✅ **API key setup at top of popup** (collapsible banner)
- ✅ **Export all available metadata** (no structured interval parsing)
- ✅ **Allow past dates** for retroactive workout logging

---

## Architecture Overview

### Data Flow

```
TrainingPeaks Workout Library
         ↓
User selects workout(s) + date(s)
         ↓
Popup sends EXPORT_TO_INTERVALS message
         ↓
Background worker retrieves intervals.icu API key
         ↓
Background builds workout payload with all metadata
         ↓
POST to intervals.icu /athlete/0/events/bulk
         ↓
Success/error notification in UI
```

### Service Architecture

Following existing patterns from `trainingPeaks.ts` and `authService.ts`:

1. **Storage Layer**: `intervalsApiKeyService.ts` - API key CRUD operations
2. **API Layer**: `background/api/intervalsicu.ts` - intervals.icu API client
3. **State Layer**: `useIntervalsExport.ts`, `useBulkIntervalsExport.ts` - React hooks
4. **UI Layer**: Banner, modals, notifications

---

## Phase 1: Complete Export Functionality (MVP)

### 1.1 Storage & API Key Management

**Files to Create**:

**`src/schemas/intervalsicu.schema.ts`**:

```typescript
import { z } from 'zod';

// Storage schema for API key
export const IntervalsApiKeyStorageSchema = z.object({
  intervals_api_key: z.string().optional(),
});

export type IntervalsApiKeyStorage = z.infer<
  typeof IntervalsApiKeyStorageSchema
>;

// intervals.icu API response schema
export const IntervalsEventResponseSchema = z.object({
  id: z.number(),
  start_date_local: z.string(),
  type: z.string(),
  category: z.string(),
  name: z.string().optional(),
  icu_training_load: z.number().optional(),
});

export type IntervalsEventResponse = z.infer<
  typeof IntervalsEventResponseSchema
>;

// Bulk export response
export const IntervalsBulkResponseSchema = z.array(
  IntervalsEventResponseSchema
);
```

**`src/services/intervalsApiKeyService.ts`**:

```typescript
import { logger } from '@/utils/logger';
import { IntervalsApiKeyStorageSchema } from '@/schemas/intervalsicu.schema';

const STORAGE_KEY = 'intervals_api_key';

export async function setIntervalsApiKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) {
    throw new Error('API key cannot be empty');
  }
  logger.debug('Storing intervals.icu API key');
  await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
}

export async function getIntervalsApiKey(): Promise<string | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const validated = IntervalsApiKeyStorageSchema.parse(data);
  return validated.intervals_api_key ?? null;
}

export async function hasIntervalsApiKey(): Promise<boolean> {
  const apiKey = await getIntervalsApiKey();
  return apiKey !== null && apiKey.length > 0;
}

export async function clearIntervalsApiKey(): Promise<void> {
  logger.debug('Clearing intervals.icu API key');
  await chrome.storage.local.remove(STORAGE_KEY);
}
```

**`src/types/intervalsicu.types.ts`**:

```typescript
import type { LibraryItem } from './api.types';

// Workout export payload
export interface IntervalsWorkoutExport {
  workout: LibraryItem;
  startDate: string; // YYYY-MM-DD format
}

// Bulk export payload
export interface IntervalsBulkExportPayload {
  workouts: LibraryItem[];
  startDate: string;
  spacing: 'daily' | 'every-other-day' | 'weekly';
}

// intervals.icu event payload
export interface IntervalsEventPayload {
  category: 'WORKOUT';
  start_date_local: string; // ISO 8601
  type: string; // Ride, Run, Swim, etc.
  name: string;
  description: string;
  moving_time?: number; // seconds
  icu_training_load?: number; // TSS
  external_id: string;
}
```

**Tests** (`tests/unit/services/intervalsApiKeyService.test.ts`, `tests/unit/schemas/intervalsicu.schema.test.ts`):

- Follow existing `authService.test.ts` patterns
- 100% coverage with success + error cases
- Mock chrome.storage.local

---

### 1.2 intervals.icu API Client

**File to Create**: `src/background/api/intervalsicu.ts`

```typescript
import type { ApiResponse, LibraryItem } from '@/types/api.types';
import type {
  IntervalsEventPayload,
  IntervalsEventResponse,
} from '@/types/intervalsicu.types';
import { IntervalsBulkResponseSchema } from '@/schemas/intervalsicu.schema';
import { logger } from '@/utils/logger';
import { getIntervalsApiKey } from '@/services/intervalsApiKeyService';

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

// Workout type mapping (TrainingPeaks ID → intervals.icu type)
const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'Run',
  2: 'Ride',
  3: 'Swim',
  4: 'WeightTraining',
  5: 'Other',
} as const;

/**
 * Build comprehensive description with all available metadata
 */
function buildDescription(workout: LibraryItem): string {
  const parts: string[] = [];

  // Main description
  if (workout.description) {
    parts.push(workout.description);
  }

  // Coach comments
  if (workout.coachComments) {
    parts.push(`\n**Coach Notes:**\n${workout.coachComments}`);
  }

  // Additional metadata (not natively supported by bulk API)
  const metadata: string[] = [];
  if (workout.ifPlanned) {
    metadata.push(`IF: ${workout.ifPlanned.toFixed(2)}`);
  }
  if (workout.distancePlanned) {
    metadata.push(`Distance: ${workout.distancePlanned}`);
  }
  if (workout.elevationGainPlanned) {
    metadata.push(`Elevation: ${workout.elevationGainPlanned}m`);
  }
  if (workout.caloriesPlanned) {
    metadata.push(`Calories: ${workout.caloriesPlanned}`);
  }
  if (workout.velocityPlanned) {
    metadata.push(`Pace: ${workout.velocityPlanned}`);
  }

  if (metadata.length > 0) {
    parts.push(`\n**Workout Details:**\n${metadata.join(' • ')}`);
  }

  return parts.join('\n');
}

/**
 * Transform TrainingPeaks workout to intervals.icu event payload
 */
function transformWorkout(
  workout: LibraryItem,
  startDate: string
): IntervalsEventPayload {
  return {
    category: 'WORKOUT',
    start_date_local: `${startDate}T00:00:00`, // ISO 8601
    type: WORKOUT_TYPE_MAP[workout.workoutTypeId] ?? 'Ride',
    name: workout.itemName,
    description: buildDescription(workout),
    moving_time: workout.totalTimePlanned
      ? Math.round(workout.totalTimePlanned * 3600)
      : undefined,
    icu_training_load: workout.tssPlanned ?? undefined,
    external_id: `tp_${workout.exerciseLibraryItemId}`,
  };
}

/**
 * Export single or multiple workouts to intervals.icu
 */
export async function exportToIntervals(
  workouts: LibraryItem[],
  startDates: string[]
): Promise<ApiResponse<IntervalsEventResponse[]>> {
  try {
    logger.debug('Exporting workouts to intervals.icu:', workouts.length);

    // Get API key
    const apiKey = await getIntervalsApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: {
          message: 'intervals.icu API key not configured',
          code: 'NO_API_KEY',
        },
      };
    }

    // Build payloads
    const payloads = workouts.map((workout, index) =>
      transformWorkout(workout, startDates[index])
    );

    // Make API request
    const auth = btoa(`API_KEY:${apiKey}`);
    const response = await fetch(
      `${INTERVALS_API_BASE}/athlete/0/events/bulk?upsert=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloads),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          error: {
            message: 'Invalid intervals.icu API key',
            code: 'INVALID_API_KEY',
            status: 401,
          },
        };
      }

      const errorText = await response.text();
      logger.error('intervals.icu API error:', response.status, errorText);
      return {
        success: false,
        error: {
          message: `intervals.icu API error: ${response.status}`,
          code: 'API_ERROR',
          status: response.status,
        },
      };
    }

    // Validate response
    const json = await response.json();
    const validated = IntervalsBulkResponseSchema.parse(json);

    logger.info(
      'Successfully exported workouts to intervals.icu:',
      validated.length
    );
    return { success: true, data: validated };
  } catch (error) {
    logger.error('Failed to export to intervals.icu:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXPORT_ERROR',
      },
    };
  }
}
```

**Tests** (`tests/unit/background/api/intervalsicu.test.ts`):

- Mock fetch API
- Mock intervalsApiKeyService
- Test successful export
- Test API errors (401, 500, network errors)
- Test Zod validation failures
- Test workout transformation logic

---

### 1.3 Message Handlers

**File to Modify**: `src/background/messageHandler.ts`

Add message handlers:

```typescript
// Add to imports
import { exportToIntervals } from './api/intervalsicu';
import {
  setIntervalsApiKey,
  getIntervalsApiKey,
  hasIntervalsApiKey,
} from '@/services/intervalsApiKeyService';

// Add handler functions
async function handleExportToIntervals(
  workouts: LibraryItem[],
  startDates: string[]
): Promise<ApiResponse<IntervalsEventResponse[]>> {
  logger.debug('Handling EXPORT_TO_INTERVALS message');
  return await exportToIntervals(workouts, startDates);
}

async function handleSetIntervalsApiKey(apiKey: string): Promise<MessageResponse> {
  try {
    await setIntervalsApiKey(apiKey);
    return { success: true };
  } catch (error) {
    logger.error('Failed to set intervals.icu API key:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetIntervalsApiKey(): Promise<{ apiKey: string | null }> {
  const apiKey = await getIntervalsApiKey();
  return { apiKey };
}

async function handleHasIntervalsApiKey(): Promise<{ hasKey: boolean }> {
  const hasKey = await hasIntervalsApiKey();
  return { hasKey };
}

// Add to switch statement
case 'EXPORT_TO_INTERVALS':
  return await handleExportToIntervals(message.workouts, message.startDates);

case 'SET_INTERVALS_API_KEY':
  return await handleSetIntervalsApiKey(message.apiKey);

case 'GET_INTERVALS_API_KEY':
  return await handleGetIntervalsApiKey();

case 'HAS_INTERVALS_API_KEY':
  return await handleHasIntervalsApiKey();
```

**File to Modify**: `src/types/index.ts`

Add message types:

```typescript
export interface ExportToIntervalsMessage {
  type: 'EXPORT_TO_INTERVALS';
  workouts: LibraryItem[];
  startDates: string[]; // YYYY-MM-DD format
}

export interface SetIntervalsApiKeyMessage {
  type: 'SET_INTERVALS_API_KEY';
  apiKey: string;
}

export interface GetIntervalsApiKeyMessage {
  type: 'GET_INTERVALS_API_KEY';
}

export interface HasIntervalsApiKeyMessage {
  type: 'HAS_INTERVALS_API_KEY';
}

// Add to RuntimeMessage union
export type RuntimeMessage =
  | TokenFoundMessage
  | GetTokenMessage
  | ClearTokenMessage
  | ValidateTokenMessage
  | GetUserMessage
  | GetLibrariesMessage
  | GetLibraryItemsMessage
  | ExportToIntervalsMessage
  | SetIntervalsApiKeyMessage
  | GetIntervalsApiKeyMessage
  | HasIntervalsApiKeyMessage;
```

---

### 1.4 React Hooks for Export

**File to Create**: `src/hooks/useIntervalsExport.ts` (single export)

```typescript
import { useMutation } from '@tanstack/react-query';
import type { LibraryItem } from '@/types/api.types';
import type { ExportToIntervalsMessage, IntervalsEventResponse } from '@/types';
import { logger } from '@/utils/logger';

interface ExportParams {
  workout: LibraryItem;
  startDate: string;
}

async function exportWorkout(
  params: ExportParams
): Promise<IntervalsEventResponse[]> {
  logger.debug('Exporting workout to intervals.icu');

  const response = await chrome.runtime.sendMessage<
    ExportToIntervalsMessage,
    ApiResponse<IntervalsEventResponse[]>
  >({
    type: 'EXPORT_TO_INTERVALS',
    workouts: [params.workout],
    startDates: [params.startDate],
  });

  if (response.success) {
    return response.data;
  } else {
    throw new Error(response.error.message);
  }
}

export function useIntervalsExport() {
  return useMutation({
    mutationFn: exportWorkout,
    onSuccess: (data) => {
      logger.info('Workout exported successfully:', data);
    },
    onError: (error) => {
      logger.error('Export failed:', error);
    },
  });
}
```

**File to Create**: `src/hooks/useBulkIntervalsExport.ts`

```typescript
import { useMutation } from '@tanstack/react-query';
import type { LibraryItem } from '@/types/api.types';

interface BulkExportParams {
  workouts: LibraryItem[];
  startDate: string;
  spacing: 'daily' | 'every-other-day' | 'weekly';
}

function calculateDates(
  startDate: string,
  count: number,
  spacing: string
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);

  const increment =
    spacing === 'daily' ? 1 : spacing === 'every-other-day' ? 2 : 7;

  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i * increment);
    dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD
  }

  return dates;
}

async function bulkExport(
  params: BulkExportParams
): Promise<IntervalsEventResponse[]> {
  const dates = calculateDates(
    params.startDate,
    params.workouts.length,
    params.spacing
  );

  const response = await chrome.runtime.sendMessage<
    ExportToIntervalsMessage,
    ApiResponse<IntervalsEventResponse[]>
  >({
    type: 'EXPORT_TO_INTERVALS',
    workouts: params.workouts,
    startDates: dates,
  });

  if (response.success) {
    return response.data;
  } else {
    throw new Error(response.error.message);
  }
}

export function useBulkIntervalsExport() {
  return useMutation({
    mutationFn: bulkExport,
  });
}
```

---

### 1.5 UI Components

**File to Create**: `src/popup/components/IntervalsApiKeyBanner.tsx`

```typescript
import { ReactElement, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { SetIntervalsApiKeyMessage, HasIntervalsApiKeyMessage } from '@/types';

async function checkHasApiKey(): Promise<boolean> {
  const response = await chrome.runtime.sendMessage<
    HasIntervalsApiKeyMessage,
    { hasKey: boolean }
  >({ type: 'HAS_INTERVALS_API_KEY' });
  return response.hasKey;
}

async function saveApiKey(apiKey: string): Promise<void> {
  const response = await chrome.runtime.sendMessage<SetIntervalsApiKeyMessage>({
    type: 'SET_INTERVALS_API_KEY',
    apiKey,
  });
  if (!response.success) {
    throw new Error(response.error);
  }
}

export function IntervalsApiKeyBanner(): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const { data: hasKey, refetch } = useQuery({
    queryKey: ['intervals-api-key'],
    queryFn: checkHasApiKey,
  });

  const saveMutation = useMutation({
    mutationFn: saveApiKey,
    onSuccess: () => {
      setApiKey('');
      setExpanded(false);
      refetch();
    },
  });

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex justify-between items-center bg-blue-50 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">intervals.icu Integration</span>
          {hasKey ? (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
              Connected
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
              Setup Required
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your intervals.icu API key"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => saveMutation.mutate(apiKey)}
            disabled={!apiKey.trim() || saveMutation.isPending}
            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save API Key'}
          </button>
          <a
            href="https://intervals.icu/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-3 text-sm text-blue-600 hover:underline text-center"
          >
            Get your API key from intervals.icu →
          </a>
          {saveMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Failed to save API key. Please try again.
            </p>
          )}
          {saveMutation.isSuccess && (
            <p className="mt-2 text-sm text-green-600">API key saved successfully!</p>
          )}
        </div>
      )}
    </div>
  );
}
```

**File to Create**: `src/popup/components/ExportWorkoutModal.tsx`

```typescript
import { ReactElement, useState } from 'react';
import type { LibraryItem } from '@/types/api.types';
import { useIntervalsExport } from '@/hooks/useIntervalsExport';

interface Props {
  workout: LibraryItem;
  onClose: () => void;
}

export function ExportWorkoutModal({ workout, onClose }: Props): ReactElement {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0] // Today
  );

  const exportMutation = useIntervalsExport();

  const handleExport = () => {
    exportMutation.mutate(
      { workout, startDate },
      {
        onSuccess: () => {
          setTimeout(onClose, 1500); // Close after showing success
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-4">Export to intervals.icu</h2>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Workout:</p>
          <p className="font-medium">{workout.itemName}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schedule for:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {exportMutation.isError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{exportMutation.error.message}</p>
          </div>
        )}

        {exportMutation.isSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">Workout exported successfully!</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={exportMutation.isPending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending || !startDate}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**File to Create**: `src/popup/components/BulkExportModal.tsx`

Similar pattern to single export, but with:

- Workout selection checkboxes
- Start date picker
- Spacing dropdown (Daily, Every Other Day, Weekly)
- Progress indicator for bulk operations

**File to Modify**: `src/popup/App.tsx`

Add API key banner:

```typescript
import { IntervalsApiKeyBanner } from './components/IntervalsApiKeyBanner';

// In render:
<div className="min-h-screen bg-gray-50">
  <IntervalsApiKeyBanner />
  {/* Rest of app */}
</div>
```

---

### 1.6 Manifest Update

**File to Modify**: `public/manifest.json`

```json
{
  "host_permissions": [
    "https://tpapi.trainingpeaks.com/*",
    "https://app.trainingpeaks.com/*",
    "https://intervals.icu/*"
  ]
}
```

---

### 1.7 Constants

**File to Modify**: `src/utils/constants.ts`

```typescript
export const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

export const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'Run',
  2: 'Ride',
  3: 'Swim',
  4: 'WeightTraining',
  5: 'Other',
} as const;
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] User can configure intervals.icu API key via collapsible banner
- [ ] API key persists across browser sessions
- [ ] User can export single workout with date selection
- [ ] User can bulk export multiple workouts with spacing options (daily, every-other-day, weekly)
- [ ] All metadata exported: name, description, coach comments, TSS, duration, type
- [ ] Additional metadata (IF, distance, elevation, calories) included in description text
- [ ] Past dates allowed for retroactive logging
- [ ] Workouts appear in intervals.icu calendar with correct data
- [ ] Success notifications display after export
- [ ] Error messages displayed for failures (invalid API key, network errors)

### Technical Requirements

- [ ] Unit tests for all new services (>90% coverage)
- [ ] Unit tests for API client with mocked fetch
- [ ] Unit tests for Zod schemas
- [ ] No TypeScript errors (`make type-check`)
- [ ] No ESLint warnings (`make check`)
- [ ] Follows existing code patterns (path aliases, error handling, etc.)
- [ ] Uses discriminated unions for message types
- [ ] API responses validated with Zod

### Security Requirements

- [ ] API key never logged in production
- [ ] API key stored in chrome.storage.local (browser-encrypted)
- [ ] Type="password" for API key input field
- [ ] No API key transmission to third parties
- [ ] HTTPS-only communication with intervals.icu

---

## Testing Strategy

### Unit Tests (Vitest)

**Coverage Target**: >90%

**Test Files**:

1. `intervalsApiKeyService.test.ts` - Storage operations
2. `intervalsicu.schema.test.ts` - Zod validation
3. `intervalsicu.test.ts` - API client with mocked fetch
4. `useIntervalsExport.test.ts` - React hook behavior

**Mocking**:

- Chrome storage API (existing pattern from `tests/setup.ts`)
- Fetch API for intervals.icu requests
- Date.now() for consistent date testing

### Manual Testing Checklist

- [ ] Generate intervals.icu API key from https://intervals.icu/settings
- [ ] Enter API key in extension banner
- [ ] Verify "Connected" status appears
- [ ] Export single workout to today
- [ ] Verify workout appears in intervals.icu calendar
- [ ] Check all metadata present (name, description, TSS, duration)
- [ ] Export workout to past date (retroactive logging)
- [ ] Bulk export 3 workouts with "every other day" spacing
- [ ] Verify 3 workouts appear on correct dates
- [ ] Test error: Invalid API key
- [ ] Test error: Network failure (disable internet)
- [ ] Test error: Empty API key input

---

## Critical Files

### New Files (14)

1. `src/schemas/intervalsicu.schema.ts` - Validation schemas
2. `src/services/intervalsApiKeyService.ts` - API key CRUD
3. `src/types/intervalsicu.types.ts` - Type definitions
4. `src/background/api/intervalsicu.ts` - API client
5. `src/hooks/useIntervalsExport.ts` - Single export hook
6. `src/hooks/useBulkIntervalsExport.ts` - Bulk export hook
7. `src/popup/components/IntervalsApiKeyBanner.tsx` - API key setup
8. `src/popup/components/ExportWorkoutModal.tsx` - Single export modal
9. `src/popup/components/BulkExportModal.tsx` - Bulk export modal
10. `tests/unit/schemas/intervalsicu.schema.test.ts`
11. `tests/unit/services/intervalsApiKeyService.test.ts`
12. `tests/unit/background/api/intervalsicu.test.ts`
13. `tests/unit/hooks/useIntervalsExport.test.ts`
14. `tests/unit/hooks/useBulkIntervalsExport.test.ts`

### Modified Files (5)

1. `src/types/index.ts` - Add message types
2. `src/background/messageHandler.ts` - Add handlers
3. `src/popup/App.tsx` - Add API key banner
4. `src/utils/constants.ts` - Add intervals.icu constants
5. `public/manifest.json` - Add host permissions

---

## Implementation Roadmap

### Day 1-2: Foundation

- [ ] Create schemas and types
- [ ] Implement `intervalsApiKeyService`
- [ ] Write unit tests for storage layer
- [ ] Update manifest.json permissions

### Day 3-4: API Integration

- [ ] Implement `background/api/intervalsicu.ts`
- [ ] Add message handlers
- [ ] Write API client tests with mocked fetch
- [ ] Test workout transformation logic

### Day 5-6: UI & Hooks

- [ ] Create `IntervalsApiKeyBanner` component
- [ ] Implement single export hook + modal
- [ ] Implement bulk export hook + modal
- [ ] Add to App.tsx

### Day 7: Testing & Polish

- [ ] Manual testing with real intervals.icu account
- [ ] Fix bugs identified during testing
- [ ] Refine error messages
- [ ] Update documentation (README, CLAUDE.md)

---

## Error Handling Strategy

### Layered Error Handling

1. **API Layer** (`intervalsicu.ts`):
   - Catch fetch errors → `NETWORK_ERROR`
   - Validate responses → `VALIDATION_ERROR`
   - Check HTTP status → `INVALID_API_KEY`, `API_ERROR`

2. **Message Handler**:
   - Route to API functions
   - Return `ApiResponse<T>` discriminated union

3. **Hooks**:
   - Unwrap `ApiResponse<T>`
   - Throw errors for React Query to catch
   - Handle `onError` / `onSuccess`

4. **UI**:
   - Display user-friendly error messages
   - Show retry options
   - Log errors for debugging

### User-Friendly Error Messages

```typescript
const ERROR_MESSAGES = {
  NO_API_KEY: 'Please configure your intervals.icu API key first',
  INVALID_API_KEY: 'Invalid API key. Check your intervals.icu settings',
  NETWORK_ERROR: 'Network error. Check your connection and try again',
  API_ERROR: 'intervals.icu API error. Please try again later',
  VALIDATION_ERROR: 'Invalid data received. Please try again',
} as const;
```

---

## Security Considerations

1. **API Key Storage**: chrome.storage.local (browser-encrypted)
2. **No Logging**: API keys never logged (production mode)
3. **HTTPS Only**: All requests to intervals.icu over HTTPS
4. **User Control**: Users provide their own API keys
5. **No Third-Party**: No transmission to services other than intervals.icu
6. **Input Validation**: Zod schemas validate all API responses

---

## Documentation Updates

### README.md

Add section:

```markdown
## intervals.icu Integration

Export your TrainingPeaks workout library to intervals.icu.

### Setup

1. Visit [intervals.icu Settings](https://intervals.icu/settings)
2. Find your API key under "Developer Settings"
3. Copy the API key
4. Open the extension and click the "intervals.icu Integration" banner
5. Paste your API key and click "Save"

### Usage

**Single Workout Export**:

1. Browse your workout library
2. Click "Export to intervals.icu" on any workout
3. Select the date to schedule the workout
4. Click "Export"

**Bulk Export**:

1. Select multiple workouts (checkbox)
2. Click "Bulk Export"
3. Choose start date and spacing (daily, every other day, weekly)
4. Click "Export"

Your workouts will appear in your intervals.icu calendar with all available metadata.
```

### CLAUDE.md

Add section documenting intervals.icu integration patterns, similar to TrainingPeaks API documentation.

---

## Success Metrics

- ✅ User can complete first export in <2 minutes
- ✅ 95%+ success rate for valid API keys
- ✅ Workouts appear in intervals.icu within 5 seconds
- ✅ Unit test coverage >90%
- ✅ Zero TypeScript/ESLint errors
- ✅ Export works for all workout types (Ride, Run, Swim, etc.)

---

## Future Enhancements (Phase 2)

- Quick-date buttons (Today, Tomorrow, Next Monday)
- Export history tracking (prevent duplicates)
- Structured workout interval parsing from names
- Export progress indicator for bulk operations
- Workout update sync (re-export if TP workout changes)
- Export filters (by library, type, date range)
- OAuth support for multi-user apps

---

**Status**: ✅ Ready for Implementation
**Approved**: 2026-02-21
**Estimated Effort**: 6-7 days (development + testing)

---

## References

**Sources**:

- [intervals.icu API Documentation](https://intervals.icu/api-docs.html)
- [API Access Guide](https://forum.intervals.icu/t/api-access-to-intervals-icu/609)
- [API Integration Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
- [Uploading Planned Workouts](https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624)

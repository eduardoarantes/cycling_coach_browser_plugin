## 1. Retain raw response in the API layer

- [x] 1.1 Extend the success branch of `ApiResponse<T>` in `src/types/api.types.ts` to include an optional `raw?: unknown` field (keep the error branch unchanged)
- [x] 1.2 In `apiRequest<T>` (`src/background/api/trainingPeaks.ts`), include the parsed `json` as `raw` on the successful return (`{ success: true, data: validated, raw: json }`)
- [x] 1.3 Confirm `fetchAthleteGroups` propagates the `raw` field unchanged (no code change if it just returns `apiRequest(...)`), and verify other callers still typecheck (`raw` is optional/ignored)

## 2. Thread raw response to the popup

- [x] 2.1 In `handleGetAthleteGroups` (`src/background/messageHandler.ts`), ensure the returned `ApiResponse<AthleteGroup[]>` passes through the `raw` field to the popup
- [x] 2.2 In `useAthleteGroups` (`src/hooks/useAthleteGroups.ts`), capture the raw response from the successful `ApiResponse` and expose it to consumers as `rawResponse` while keeping `data: AthleteGroup[]` unchanged for existing call sites

## 3. Source JSON viewer modal

- [x] 3.1 Create `src/popup/components/GroupSourceJsonModal.tsx`, reusing the modal shell pattern from `IntegrationHelpModal.tsx` (backdrop, centered card, close button, click-outside, Escape-to-close)
- [x] 3.2 Render the raw payload as pretty-printed JSON (`JSON.stringify(raw, null, 2)`) inside a scrollable, height-capped `<pre>` sized for the 384px popup
- [x] 3.3 Add a Copy action using `navigator.clipboard.writeText` (guard for availability) with visible confirmation feedback
- [x] 3.4 Add a Download action using `downloadJsonFile(raw, 'athlete-groups-source.json')` from `src/utils/downloadJson.ts`

## 4. Wire the header icon into AthleteGroupList

- [x] 4.1 Consume `rawResponse` from `useAthleteGroups` in `AthleteGroupList.tsx`
- [x] 4.2 Add a `lucide-react` icon button (e.g. `Braces`) to the header row (near the group/athlete count), with an accessible label, shown only when `rawResponse` is present
- [x] 4.3 Add `isJsonOpen` state and render `GroupSourceJsonModal` conditionally, opening on icon click and closing via the modal's close handlers

## 5. Tests & validation

- [x] 5.1 Unit test: `apiRequest`/`fetchAthleteGroups` returns `raw` on success and omits it on error
- [x] 5.2 Unit test: `useAthleteGroups` exposes `rawResponse` from the background response
- [x] 5.3 Component test (or manual verification): `GroupSourceJsonModal` renders the JSON, copy and download actions work, and close/backdrop/Escape dismiss it
- [x] 5.4 Verify the icon appears only in the success state and is hidden during loading/error/empty
- [x] 5.5 Run `npm run build` (and existing unit test suite) to confirm the extension compiles with no TypeScript errors

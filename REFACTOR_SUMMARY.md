# LocationBlockList Refactor Summary

## Completed: Option 1 - Refactor LocationBlockList to use useLocationBlocksForDay hook

### Problem Fixed
LocationBlockList.tsx was NOT calling `fillLocationGaps()`, which caused "Unknown Location" blocks to appear where the user was stationary but GPS samples were missing.

### Changes Made

#### 1. Replaced Imports
**Removed** (now handled by hook):
- `fetchHourlySummariesForDate`, `humanizeActivity` from `@/lib/supabase/services`
- `supabase` client
- `inferPlacesFromHistory`, `InferredPlace`, `PlaceInferenceResult` from place-inference
- `generateInferenceDescription`, `InferenceContext` from activity-inference-descriptions
- `fetchActivitySegmentsForDate`, `ActivitySegment` from activity-segments
- `groupIntoLocationBlocks` from group-location-blocks
- `getLocationLabels` from location-labels
- Unused `Calendar` icon from lucide-react-native

**Added**:
- `useLocationBlocksForDay` from `@/lib/hooks/use-location-blocks-for-day`

#### 2. Removed Duplicate Types
- `LocationHourlyRow` interface (now internal to hook)

#### 3. Replaced State Management
**Before** (~9 lines of useState):
```tsx
const [blocks, setBlocks] = useState<LocationBlock[]>([]);
const [inferenceResult, setInferenceResult] = useState<PlaceInferenceResult | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
// ... plus fetchData logic
```

**After** (~1 hook call):
```tsx
const {
  blocks: baseBlocks,
  inferenceResult,
  isLoading,
  error,
  refresh,
} = useLocationBlocksForDay({
  userId,
  date,
  enabled: true,
});
```

#### 4. Replaced ~240 Lines of fetchData() with ~80 Lines of Timeline Building
**Before**: `fetchData()` function (~240 lines, lines 170-410)
- Fetched CHARLIE summaries
- Fetched location_hourly rows
- Ran place inference (14-day window)
- Fetched user-saved location labels
- Built lookup maps
- Fetched activity segments
- Enriched summaries with place labels
- Grouped into location blocks
- **MISSING: Did NOT call fillLocationGaps()** ← BUG
- Built timeline events

**After**: Timeline building useEffect (~80 lines)
- ✅ **All data fetching/enrichment/grouping delegated to hook**
- ✅ **fillLocationGaps() automatically included** ← BUG FIXED
- Kept only Activity Timeline-specific logic:
  - Fetch calendar events (planned, actual, communication)
  - Filter events by block time range
  - Build timeline events for each block

#### 5. Updated References
- `fetchData()` → `refresh()` (from hook)
- `blocks` → `blocksWithTimeline` (renamed for clarity)
- `setBlocks()` → `setBlocksWithTimeline()` (local state for timeline-enriched blocks)

#### 6. Removed Helper Function
- `floorToHour()` — no longer needed (hook has its own)

### Benefits

1. **Bug Fixed**: `fillLocationGaps()` is now called automatically, eliminating "Unknown Location" blocks
2. **Code Reduction**: ~240 lines → ~80 lines (67% reduction in data-fetching code)
3. **Consistency**: LocationBlockList and comprehensive-calendar now use identical data pipeline
4. **Maintainability**: Data-fetching logic centralized in one hook
5. **Performance**: Hook includes place inference caching (14-day analysis cached across re-fetches)
6. **Separation of Concerns**: 
   - Hook = data fetching/enrichment/grouping (BRAVO/CHARLIE pipeline)
   - LocationBlockList = timeline event building (Activity Timeline specific)

### Files Modified
- `/apps/mobile/src/components/organisms/LocationBlockList.tsx`

### Testing Notes
- No type errors introduced (verified with `npx tsc --noEmit`)
- Pre-existing type errors in other files unchanged
- LocationBlockList.tsx passes TypeScript compilation

### What Remains in LocationBlockList
The component now focuses ONLY on Activity Timeline-specific concerns:
1. Fetching calendar/communication events
2. Filtering events by block time range
3. Building timeline event rows
4. Rendering the timeline UI
5. Handling user interactions (place selection, event press, etc.)

All BRAVO/CHARLIE pipeline logic (location data, activity segments, place inference, gap-filling) is now handled by the hook.

---

**Status**: ✅ Complete
**Verified**: TypeScript compilation passes for LocationBlockList.tsx
**Result**: "Unknown Location" bug fixed via automatic `fillLocationGaps()` call

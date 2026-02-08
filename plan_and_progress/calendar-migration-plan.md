# Calendar Migration Plan: Location Blocks in Comprehensive Calendar

**Created:** 2026-02-07  
**Last Updated:** 2026-02-07  
**Status:** Complete (all 5 phases)  
**Goal:** Replace the old derivation pipeline in the Comprehensive Calendar's Actual column with BRAVO/CHARLIE location-block data, matching what the Activity Timeline already shows.

### Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Shared Hook (`useLocationBlocksForDay`) | ✅ Complete |
| Phase 2 | Converter (`locationBlocksToScheduledEvents`) | ✅ Complete |
| Phase 3 | Wire Into Comprehensive Calendar Screen | ✅ Complete |
| Phase 4 | Simplified Verification Engine | ✅ Complete |
| Phase 5 | Polish & Cleanup | ✅ Complete |

### Phase 5 Deliverables
- ✅ Loading skeleton in Actual column while BRAVO/CHARLIE data loads
- ✅ Edge cases: future dates return empty, no-data graceful handling, gap filling for partial data
- ✅ Feature flag toggle via `useDevFlagsStore` + UI in `/dev/pipeline-test` screen
- ✅ Memoization: converter output in `useMemo`, inference cached in hook `useRef`
- ✅ `@deprecated` JSDoc on `buildActualDisplayEvents()` and `generateActualBlocks()`
- ✅ Deprecation header on `actual-display-events.ts`
- ✅ Fixed TS error: `ScheduledEvent` type import in `comprehensive-calendar.tsx`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [What to Keep vs Deprecate](#what-to-keep-vs-deprecate)
3. [Phase 1: Shared Hook for Location Blocks](#phase-1-shared-hook-for-location-blocks)
4. [Phase 2: Convert LocationBlock[] → ScheduledEvent[]](#phase-2-convert-locationblock--scheduledevent)
5. [Phase 3: Wire Into Comprehensive Calendar Screen](#phase-3-wire-into-comprehensive-calendar-screen)
6. [Phase 4: Simplified Verification Engine](#phase-4-simplified-verification-engine)
7. [Phase 5: Polish & Cleanup](#phase-5-polish--cleanup)
8. [Risks & Gotchas](#risks--gotchas)
9. [File Reference](#file-reference)

---

## Architecture Overview

### Current State (Old Pipeline)

The comprehensive calendar (`comprehensive-calendar.tsx`) builds its Actual column through a deeply nested pipeline:

```
comprehensive-calendar.tsx
  → useVerification() hook (fetches evidence-data from Supabase)
  → verification-engine.ts (verifyPlannedEvents + generateActualBlocks)
  → actual-display-events.ts (buildActualDisplayEvents — 3400+ line monster)
    → Derives events from: screen time, location_hourly, health workouts,
      usage summaries, pattern recognition, sleep analysis, etc.
    → Fills unknown gaps, replaces with sleep/location/travel/productive blocks
    → Outputs ScheduledEvent[] for the Actual column
```

**Problems:**
- `actual-display-events.ts` is 3400+ lines of complex gap-filling logic
- Uses raw `location_hourly` rows, not the enriched BRAVO/CHARLIE pipeline
- Duplicates place inference, segment enrichment that BRAVO/CHARLIE already does better
- No access to `ActivitySegment`, `InferredPlace`, or `InferenceDescription` data
- Different location blocks than what Activity Timeline shows → confusing UX

### Target State (New Pipeline)

```
comprehensive-calendar.tsx
  → useLocationBlocksForDay() hook (NEW — shared with Activity Timeline)
    → fetchHourlySummariesForDate() (CHARLIE summaries)
    → fetchActivitySegmentsForDate() (BRAVO segments)
    → inferPlacesFromHistory() (place inference)
    → groupIntoLocationBlocks() (existing grouping algorithm)
    → Returns LocationBlock[]
  → locationBlocksToScheduledEvents() (NEW converter)
    → Maps LocationBlock[] → ScheduledEvent[] for calendar grid
    → Preserves category, location label, app usage, confidence
  → ComprehensiveCalendarTemplate (existing — no changes to template itself)
```

### What the Activity Timeline Does (Reference)

`LocationBlockList.tsx` (lines 220-460) already does the full BRAVO/CHARLIE pipeline:

1. `fetchHourlySummariesForDate()` — CHARLIE hourly summaries
2. `supabase.from("location_hourly")` — raw location data for enrichment
3. `inferPlacesFromHistory()` — place inference (14-day window)
4. `fetchActivitySegmentsForDate()` — BRAVO activity segments
5. Enriches summaries with place labels, segments, inference descriptions
6. `groupIntoLocationBlocks()` — groups into `LocationBlock[]`
7. `buildTimelineEvents()` — builds timeline events per block

We'll extract steps 1-6 into a shared hook. Step 7 stays in Activity Timeline only.

---

## What to Keep vs Deprecate

### KEEP (Do Not Delete)

| File | Reason |
|------|--------|
| `lib/calendar/verification-engine.ts` | Fallback reference. Port simplified version. |
| `lib/calendar/actual-display-events.ts` | Fallback reference. Don't delete yet. |
| `lib/calendar/use-verification.ts` | Still used for planned event verification badges. |
| `lib/calendar/evidence-fusion.ts` | Reference for confidence scoring. |
| `lib/calendar/data-quality.ts` | Reference for data quality metrics. |
| `lib/calendar/verification-rules.ts` | Keep — used by verification engine. |
| `lib/calendar/app-classification.ts` | Keep — used for screen time categorization. |
| `lib/calendar/sleep-analysis.ts` | Keep — used for sleep quality metrics. |
| `lib/calendar/pattern-recognition.ts` | Keep — could enhance location blocks later. |
| `lib/calendar/mock-planned-events.ts` | Keep — dev/testing. |

### DEPRECATE (Mark as Legacy, Don't Use in New Code)

| File/Function | Replacement |
|---------------|-------------|
| `buildActualDisplayEvents()` in `actual-display-events.ts` | `locationBlocksToScheduledEvents()` (new) |
| `generateActualBlocks()` in `verification-engine.ts` | Location blocks from BRAVO/CHARLIE pipeline |
| `deriveActualEventsFromScreenTime()` in `derive-screen-time-actual-events.ts` | Embedded in location block data |
| `buildLocationBlocks()` in `actual-display-events.ts` (local version) | `groupIntoLocationBlocks()` from `group-location-blocks.ts` |
| `replaceUnknownWithLocationEvidence()` | Location blocks already have this data |
| `replaceUnknownWithTransitions()` | Travel blocks from BRAVO/CHARLIE |
| `replaceUnknownWithProductiveUsage()` | App usage data in LocationBlock.apps |
| `replaceUnknownWithSleepSchedule()` | Simplified sleep-gap handling in new converter |
| `fillUnknownGaps()` in `actual-display-events.ts` | Simpler gap-fill in new converter |

### DO NOT TOUCH

| File | Reason |
|------|--------|
| `app/activity-timeline.tsx` | Cole's explicit instruction |
| `components/organisms/LocationBlockList.tsx` | Activity Timeline's own component |
| `components/organisms/LocationBlockCard.tsx` | Activity Timeline's card renderer |
| `components/organisms/TimelineBlockSection.tsx` | Activity Timeline's section renderer |

---

## Phase 1: Shared Hook for Location Blocks

**Complexity:** Medium  
**Estimated effort:** 3-4 hours

### New File: `src/lib/hooks/use-location-blocks-for-day.ts`

Extract the data-fetching logic from `LocationBlockList.tsx` (lines 220-420) into a reusable hook.

```typescript
// src/lib/hooks/use-location-blocks-for-day.ts

interface UseLocationBlocksForDayOptions {
  userId: string;
  date: string; // YYYY-MM-DD
  enabled?: boolean; // default true
}

interface UseLocationBlocksForDayReturn {
  blocks: LocationBlock[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

**What it does:**
1. Calls `fetchHourlySummariesForDate(userId, date)` — CHARLIE summaries
2. Fetches `location_hourly` rows from Supabase for the day
3. Calls `inferPlacesFromHistory(userId, 14)` — place inference
4. Calls `fetchActivitySegmentsForDate(userId, date)` — BRAVO segments
5. Enriches summaries (same logic as LocationBlockList lines 301-400)
6. Calls `groupIntoLocationBlocks(enriched)` — returns `LocationBlock[]`

**Key decisions:**
- Cache inference result (it's expensive — 14-day window). Use `useRef` like LocationBlockList does.
- Include `refresh()` for pull-to-refresh or realtime triggers.
- Do NOT include `buildTimelineEvents()` — that's Activity Timeline-specific.

**Files to create:**
- `src/lib/hooks/use-location-blocks-for-day.ts`

**Files to reference (copy logic from):**
- `src/components/organisms/LocationBlockList.tsx` lines 220-460 (fetchData function)

---

## Phase 2: Convert LocationBlock[] → ScheduledEvent[]

**Complexity:** Medium  
**Estimated effort:** 3-4 hours

### New File: `src/lib/calendar/location-blocks-to-events.ts`

This is the critical bridge between the BRAVO/CHARLIE `LocationBlock` type and the `ScheduledEvent` type that `ComprehensiveCalendarTemplate` expects.

```typescript
// src/lib/calendar/location-blocks-to-events.ts

interface ConvertOptions {
  blocks: LocationBlock[];
  ymd: string;
  /** Planned events for sleep-gap detection */
  plannedEvents?: ScheduledEvent[];
  /** User-saved actual events (from Supabase) that should take priority */
  userActualEvents?: ScheduledEvent[];
}

function locationBlocksToScheduledEvents(options: ConvertOptions): ScheduledEvent[]
```

**Conversion mapping:**

| LocationBlock field | ScheduledEvent field | Notes |
|---|---|---|
| `id` | `id` | Prefix with `"lb:"` to distinguish from other sources |
| `locationLabel` | `title` | e.g., "Home", "Work", "Driving → Work" |
| `activityInference?.primary` | `description` | Smart description from inference engine |
| `startTime` | `startMinutes` | Convert `Date` to minutes-from-midnight |
| `endTime - startTime` | `duration` | In minutes |
| Derived from `locationCategory` | `category` | Map: home→routine, office→work, gym→health, etc. |
| `type === "travel"` | `category: "travel"` | Travel blocks |
| Various fields | `meta` | See meta mapping below |

**Meta (`CalendarEventMeta`) mapping:**

```typescript
meta: {
  category: derivedCategory,
  source: "bravo_charlie",     // New source identifier
  kind: block.type === "travel" ? "travel" : "location_block",
  confidence: block.confidenceScore,
  place_label: block.locationLabel,
  place_id: block.inferredPlace?.id ?? null,
  latitude: block.inferredPlace?.latitude ?? null,
  longitude: block.inferredPlace?.longitude ?? null,
  fuzzy_location: block.isPlaceInferred,
  // App usage summary for session block display
  summary: block.apps.slice(0, 5).map(app => ({
    label: app.displayName,
    seconds: app.totalMinutes * 60,
  })),
  // Movement info for travel blocks
  movement_type: block.movementType ?? null,
  distance_m: block.distanceM ?? null,
}
```

**Category mapping function:**

```typescript
function locationCategoryToEventCategory(block: LocationBlock): EventCategory {
  if (block.type === "travel") return "travel";
  
  const cat = block.locationCategory?.toLowerCase();
  switch (cat) {
    case "home": return "routine";
    case "office": case "coworking": return "work";
    case "gym": case "fitness": return "health";
    case "restaurant": case "cafe": case "bar": return "meal";
    case "church": case "temple": case "mosque": return "routine"; // faith
    case "school": case "university": return "work";
    case "park": case "recreation": return "health";
    case "store": case "shopping": return "free";
    default: return "unknown";
  }
}
```

**Gap filling:**
- After converting blocks, find gaps between them
- Fill with `unknown` events (simple — just like existing `fillUnknownGaps()`)
- Optionally: check if a gap overlaps with a planned sleep event → fill with sleep
- Keep it simple — no 3400-line monster. Under 300 lines total.

**User actual events priority:**
- If the user has manually created/edited actual events via the calendar, those take priority
- Filter out location blocks that overlap with user-created actual events
- Only use user events where `meta.source === "user"` or `meta.source === "actual_adjust"`

**Files to create:**
- `src/lib/calendar/location-blocks-to-events.ts`

---

## Phase 3: Wire Into Comprehensive Calendar Screen

**Complexity:** Medium-High  
**Estimated effort:** 4-5 hours

### Modify: `src/app/comprehensive-calendar.tsx`

This is the main integration point. We replace the old pipeline with the new one.

**Changes needed:**

1. **Add import for new hook:**
   ```typescript
   import { useLocationBlocksForDay } from "@/lib/hooks/use-location-blocks-for-day";
   import { locationBlocksToScheduledEvents } from "@/lib/calendar/location-blocks-to-events";
   ```

2. **Add the hook call:**
   ```typescript
   const userId = useAuthStore((s) => s.user?.id ?? null);
   
   const {
     blocks: locationBlocks,
     isLoading: blocksLoading,
     refresh: refreshBlocks,
   } = useLocationBlocksForDay({
     userId: userId ?? "",
     date: selectedDateYmd,
     enabled: !!userId,
   });
   ```

3. **Replace `combinedActualEvents` computation:**

   **Before (old pipeline — ~50 lines of useMemo + buildActualDisplayEvents):**
   ```typescript
   const combinedActualEvents = useMemo(() => {
     return buildActualDisplayEvents({ ... });
   }, [ ... ]);
   ```

   **After (new pipeline):**
   ```typescript
   const combinedActualEvents = useMemo(() => {
     // User-created actual events take priority
     const userActualEvents = displayActualEvents.filter(
       (e) => e.meta?.source === "user" || e.meta?.source === "actual_adjust"
     );
     
     return locationBlocksToScheduledEvents({
       blocks: locationBlocks,
       ymd: selectedDateYmd,
       plannedEvents,
       userActualEvents,
     });
   }, [locationBlocks, selectedDateYmd, plannedEvents, displayActualEvents]);
   ```

4. **Keep existing Supabase actual events loading** (for user-created events):
   - The `loadActualForDay` / `setActualEventsForDate` logic stays
   - These are user-created/edited events that override location blocks

5. **Keep existing realtime subscription** but add location data trigger:
   - Add listener for `tm.hourly_summaries` changes
   - Call `refreshBlocks()` when new CHARLIE data arrives

6. **Remove/bypass old pipeline imports** (but don't delete the files):
   - Comment out or skip: `useVerification()` for actual block generation
   - Comment out or skip: `buildActualDisplayEvents()` call
   - Comment out or skip: Screen time derivation (`deriveActualEventsFromScreenTime`)
   - Comment out or skip: Pattern recognition for actual events
   - Comment out or skip: Evidence sync to Supabase (`syncActualEvidenceBlocks`)
   - Comment out or skip: Derived events sync (`syncDerivedActualEvents`)

   **Important:** Do this with a feature flag or simple boolean so we can revert:
   ```typescript
   const USE_NEW_LOCATION_PIPELINE = true; // Feature flag
   ```

7. **Keep these existing features intact:**
   - Planned events loading (unchanged)
   - Planned sleep schedule creation (unchanged)
   - Event editor modal for planned events (unchanged)
   - Actual event press → actual-adjust navigation (unchanged)
   - Date navigation (unchanged)
   - FAB + add event (unchanged)
   - Demo mode support (unchanged)
   - Drag-to-create gesture (unchanged)

### Modify: `src/components/templates/ComprehensiveCalendarTemplate.tsx`

**Minimal changes needed** — the template already renders `ScheduledEvent[]` in both columns. The new pipeline outputs the same type.

Potential small changes:
- The `TimeEventBlock` component already handles `meta.kind === "session_block"` and shows `MapPin` icons, app summaries, etc.
- We may want to add handling for `meta.kind === "location_block"` (our new kind) to show similar location-aware UI
- Add a new style key in `CATEGORY_STYLES` for `"location_block"` if the existing ones don't cover it

```typescript
// In getSessionBlockStyleKey(), add:
if (meta?.source === "bravo_charlie") {
  // Use category from the location block
  return event.category;
}
```

Actually, the existing `CATEGORY_STYLES` already has entries for all EventCategory values, so the color mapping should work automatically. The main thing is ensuring `meta.kind` is handled properly for subtitle display.

**Add location-block subtitle logic:**
```typescript
// New function alongside buildSessionBlockSubtitle
const buildLocationBlockSubtitle = (event: CalendarEvent): string | null => {
  const meta = event.meta;
  if (meta?.source !== "bravo_charlie") return null;
  
  // Show top apps if available
  const summary = meta.summary;
  if (summary && summary.length > 0) {
    return summary.slice(0, 3).map(item => {
      const mins = Math.round(item.seconds / 60);
      return `${item.label} ${mins}m`;
    }).join(" · ");
  }
  
  return null;
};
```

---

## Phase 4: Simplified Verification Engine

**Complexity:** Low-Medium  
**Estimated effort:** 2-3 hours

Port a simplified verification to cross-reference planned events against BRAVO/CHARLIE location blocks.

### New File: `src/lib/calendar/simple-verification.ts`

```typescript
interface SimpleVerificationResult {
  eventId: string;
  status: "verified" | "partial" | "unverified" | "contradicted";
  locationMatch: boolean;
  locationLabel: string | null;
  confidence: number;
}

function verifyPlannedAgainstBlocks(
  plannedEvents: ScheduledEvent[],
  blocks: LocationBlock[],
): Map<string, SimpleVerificationResult>
```

**What to keep from the old verification engine:**
- Location matching (is the user at the expected location?)
- Basic timing checks (did the event happen during the planned window?)
- Confidence scoring (based on location sample count + inference confidence)

**What to drop:**
- Screen time distraction analysis (can add back later)
- Health/workout cross-referencing (can add back later)
- Evidence fusion complexity
- Pattern recognition integration
- 30+ verification status types → just 4: verified, partial, unverified, contradicted

**Integration:** This is optional for Phase 3. The calendar works without it — verification just adds badge indicators on planned events.

---

## Phase 5: Polish & Cleanup

**Complexity:** Low  
**Estimated effort:** 2-3 hours

1. **Add loading state** to the calendar Actual column while BRAVO/CHARLIE data loads
   - Show subtle skeleton/shimmer in Actual column
   - Planned column renders immediately (it loads from a different source)

2. **Handle edge cases:**
   - Days with no CHARLIE data (show empty/unknown blocks)
   - Future dates (no actual data — show empty Actual column)
   - Past dates with partial data (some hours missing)

3. **Add feature flag toggle** in dev settings for switching between old/new pipeline

4. **Performance:**
   - Memoize `locationBlocksToScheduledEvents()` output
   - Avoid re-running inference on every render (cache in hook)
   - Consider lazy-loading BRAVO segments (they're heavy)

5. **Mark old pipeline as deprecated:**
   - Add `@deprecated` JSDoc comments to `buildActualDisplayEvents()`
   - Add `@deprecated` to `generateActualBlocks()`
   - Add comment at top of `actual-display-events.ts`: `// DEPRECATED: Use location-blocks-to-events.ts + use-location-blocks-for-day.ts`

---

## Risks & Gotchas

### 1. CHARLIE Data Availability
**Risk:** CHARLIE summaries may not exist for all hours (ingestion runs periodically, ~4h).  
**Mitigation:** The hook should handle sparse data gracefully. Gaps between blocks become "unknown" events. The old pipeline had the same issue.

### 2. Place Inference Performance
**Risk:** `inferPlacesFromHistory(userId, 14)` scans 14 days of location data. Could be slow.  
**Mitigation:** Cache the result per-session. Only re-run on explicit refresh. LocationBlockList already does this without issues.

### 3. User-Created Actual Events
**Risk:** Users may have manually created actual events that conflict with location blocks.  
**Mitigation:** User events always win. Filter out overlapping location blocks before merging.

### 4. Session Blocks (Existing Feature)
**Risk:** The old pipeline creates "session blocks" from screen time data. These show up in the Actual column with app usage summaries. The new pipeline uses LocationBlock.apps instead.  
**Mitigation:** The `meta.summary` field on our converted events will contain the same app data. The template's `buildSessionBlockSubtitle()` already handles this format.

### 5. Sleep Events
**Risk:** The old pipeline does complex sleep adjustment (detecting phone use during sleep, splitting sleep blocks). The new pipeline doesn't.  
**Mitigation:** Phase 2's gap-fill will detect gaps that overlap with planned sleep events and fill them with sleep blocks. For V1, this is simpler but sufficient. Phone-during-sleep detection can be added later.

### 6. Actual-Adjust Navigation
**Risk:** Tapping an actual event navigates to `/actual-adjust` with event params. New location-block events need the same behavior.  
**Mitigation:** The template's `onPress` handler already passes event data as route params. Our converted events will have the same `id`, `title`, `startMinutes`, `duration`, `category`, `meta` fields.

### 7. Derived Event Sync to Supabase
**Risk:** The old pipeline syncs derived actual events to Supabase (`syncDerivedActualEvents`). If we stop doing this, historical actual events may differ.  
**Mitigation:** With the feature flag, we can keep the old sync running in parallel during transition. For new pipeline events, we can add a simpler sync if needed.

### 8. Android vs iOS
**Risk:** Android uses `UsageSummary` for screen time; iOS uses ScreenKit. Location blocks from BRAVO/CHARLIE are platform-agnostic (they use server-side data).  
**Mitigation:** No change needed — BRAVO/CHARLIE data comes from Supabase, not device APIs. This is actually an improvement over the old pipeline which had platform-specific branches.

---

## File Reference

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/hooks/use-location-blocks-for-day.ts` | Shared hook: fetches BRAVO/CHARLIE data → LocationBlock[] |
| `src/lib/calendar/location-blocks-to-events.ts` | Converter: LocationBlock[] → ScheduledEvent[] |
| `src/lib/calendar/simple-verification.ts` | Simplified verification against location blocks |

### Files to MODIFY

| File | Changes |
|------|---------|
| `src/app/comprehensive-calendar.tsx` | Replace old pipeline with new hook + converter. Add feature flag. |
| `src/components/templates/ComprehensiveCalendarTemplate.tsx` | Minor: add location-block subtitle handler, handle new meta.source. |

### Files to DEPRECATE (not delete)

| File | Replacement |
|------|-------------|
| `src/lib/calendar/actual-display-events.ts` | `location-blocks-to-events.ts` |
| `src/lib/calendar/derive-screen-time-actual-events.ts` | Embedded in location block data |

### Files NOT TOUCHED

| File | Reason |
|------|--------|
| `src/app/activity-timeline.tsx` | Explicitly excluded by Cole |
| `src/components/organisms/LocationBlockList.tsx` | Activity Timeline's component (read-only reference) |
| `src/lib/utils/group-location-blocks.ts` | Shared utility — used by both pipelines |
| `src/lib/types/location-block.ts` | Type definitions — unchanged |
| All other calendar lib files | Kept as fallback/reference |

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
  (hook)   (converter) (wire up)  (verify)  (polish)
```

Phases 1 and 2 can be developed in parallel (no dependencies).
Phase 3 depends on both 1 and 2.
Phase 4 can happen any time after Phase 2.
Phase 5 happens last.

**Total estimated effort:** 14-19 hours across all phases.

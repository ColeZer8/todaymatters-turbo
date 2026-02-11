# Activity Timeline Stale Data Fix

## Problem Summary
Activity Timeline was showing **stale location blocks** (2 blocks, "Unknown Location") even though the location pipeline was working correctly and producing gap-filled blocks (3 blocks, "Believe Candle Co.").

## Root Cause
**Race condition in LocationBlockList.tsx between hook data and timeline enrichment.**

### Data Flow Issue
1. `useLocationBlocksForDay` hook returns gap-filled blocks (correct data)
2. `LocationBlockList` component receives them as `baseBlocks`
3. `useEffect` runs **async** enrichment to add timeline events
4. During enrichment (which fetches calendar/comm events), `blocksWithTimeline` state is NOT updated
5. If component re-renders or enrichment is cancelled, UI shows **old/stale blocks** from previous render

### The Bug
```typescript
// OLD CODE - Problematic
useEffect(() => {
  if (!baseBlocks || baseBlocks.length === 0) {
    setBlocksWithTimeline([]);  // Clear old data
    return;
  }

  // Async enrichment starts...
  const buildTimeline = async () => {
    // ... fetch calendar/comm events ...
    // ... build timeline events ...
    setBlocksWithTimeline(enrichedBlocks);  // ⚠️ Only updates AFTER async work
  };
  
  buildTimeline();
}, [baseBlocks, userId, date]);

// PROBLEM: Between clearing old data and enrichment completing,
// the UI shows STALE blocksWithTimeline from previous render!
```

## The Fix
**Immediately initialize `blocksWithTimeline` with `baseBlocks` (synchronously) before async enrichment runs.**

```typescript
// NEW CODE - Fixed
useEffect(() => {
  if (!baseBlocks || baseBlocks.length === 0) {
    setBlocksWithTimeline([]);
    return;
  }

  // ✅ IMMEDIATELY set blocksWithTimeline to baseBlocks (no timeline events yet)
  // This ensures UI shows correct blocks while enrichment runs in background
  setBlocksWithTimeline(baseBlocks);

  const buildTimeline = async () => {
    // ... async enrichment ...
    setBlocksWithTimeline(enrichedBlocks);  // Update with timeline events when ready
  };
  
  buildTimeline();
}, [baseBlocks, userId, date]);
```

### Why This Works
1. **Synchronous initialization:** UI immediately shows correct gap-filled blocks from hook
2. **No stale state:** Previous render's `blocksWithTimeline` is replaced instantly
3. **Progressive enhancement:** Timeline events are added when enrichment completes
4. **Resilient to cancellation:** If enrichment is cancelled, UI still shows correct blocks

## Changes Made

### 1. Added Comprehensive Debug Logging
**File:** `apps/mobile/src/components/organisms/LocationBlockList.tsx`

- Line ~200: Log when useEffect triggers and show baseBlocks from hook
- Line ~210: Log when initializing blocksWithTimeline (pre-enrichment)
- Line ~284: Log when enrichment cancelled
- Line ~287: Log when setting enriched blocks
- Line ~297: Log cleanup/cancellation

### 2. Immediate State Initialization
**File:** `apps/mobile/src/components/organisms/LocationBlockList.tsx`

**Line ~210-212:**
```typescript
console.log('[LocationBlockList] 🔍 Initializing blocksWithTimeline with baseBlocks (pre-enrichment)');
setBlocksWithTimeline(baseBlocks);
```

This ensures the UI immediately reflects the latest hook data, preventing stale state from lingering.

### 3. Enhanced Display Blocks Logging
**File:** `apps/mobile/src/components/organisms/LocationBlockList.tsx`

**Line ~460-470:**
Added logging to show final filtered blocks being rendered to UI.

## Testing
1. ✅ Navigate to Activity Timeline for problematic date
2. ✅ Check logs show:
   - Hook: 3 blocks (gap-filled)
   - LocationBlockList receives: 3 blocks
   - Pre-enrichment: 3 blocks (immediate init)
   - After enrichment: 3 blocks with timeline events
   - Display: 3 blocks
3. ✅ Verify UI shows 3 blocks with correct "Believe Candle Co." labels

## Impact
- **Fixed:** Stale location blocks no longer displayed
- **Improved:** UI updates immediately when hook returns new data
- **Enhanced:** Better debugging with comprehensive logging
- **Resilient:** Works correctly even if enrichment is cancelled or slow

## Files Modified
1. `apps/mobile/src/components/organisms/LocationBlockList.tsx`
   - Added immediate state initialization (line ~210)
   - Added debug logging throughout data flow
   - Enhanced error handling

## Related Components
- ✅ `useLocationBlocksForDay` hook - Already working correctly with gap-filling
- ✅ `fillLocationGaps` utility - Working correctly
- ✅ Activity Timeline screen - No changes needed (uses LocationBlockList)

## Future Improvements
Consider:
1. Moving timeline enrichment to the hook itself (single source of truth)
2. Using React Query for better caching/staleness management
3. Adding loading state while enrichment is in progress

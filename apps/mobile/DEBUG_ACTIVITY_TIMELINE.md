# Activity Timeline Data Flow Debug Report

## Problem
Activity Timeline shows **stale location data** (2 blocks, "Unknown Location") even though logs show the location pipeline is working perfectly (3 blocks, all "Believe Candle Co.").

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Database (location_hourly + activity_segments)              │
│    ↓                                                            │
│ 2. useLocationBlocksForDay Hook                                │
│    - Fetches location_hourly rows                              │
│    - Fetches activity_segments                                 │
│    - Groups into blocks                                        │
│    - Fills gaps with carry-forward logic ✓                     │
│    - Returns: baseBlocks (gap-filled)                          │
│    ↓                                                            │
│ 3. LocationBlockList Component                                 │
│    - Receives baseBlocks from hook                             │
│    - useEffect enriches with timeline events                   │
│    - Stores in blocksWithTimeline state                        │
│    ↓                                                            │
│ 4. Filter Logic (displayBlocks useMemo)                        │
│    - Applies filter (actual/scheduled/both)                    │
│    - Returns filtered blocks for display                       │
│    ↓                                                            │
│ 5. UI Renders displayBlocks                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Debug Logging Added

### 1. Hook Output (use-location-blocks-for-day.ts)
Already present at line 424:
```typescript
console.log(`[useLocationBlocksForDay] 🔍 DEBUG: After gap-filling, ${blocksWithGapsFilled.length} blocks:`);
```

### 2. LocationBlockList Receives Data
Added at line 199-209:
```typescript
console.log(`[LocationBlockList] 🔍 useEffect triggered: baseBlocks.length = ${baseBlocks?.length ?? 0}`);
console.log('[LocationBlockList] 🔍 Base blocks from hook:');
baseBlocks.forEach(b => {
  console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}"`);
});
```

### 3. After Timeline Enrichment
Added at line 280-285:
```typescript
console.log(`[LocationBlockList] 🔍 Setting blocksWithTimeline: ${enrichedBlocks.length} blocks`);
enrichedBlocks.forEach(b => {
  console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}"`);
});
```

### 4. After Filter Applied (displayBlocks)
Added at line 460-468:
```typescript
console.log(`[LocationBlockList] 🔍 displayBlocks computed: filter="${filter}", blocksWithTimeline.length=${blocksWithTimeline.length}`);
result.forEach(b => {
  console.log(`  - ${b.startTime.toLocaleTimeString()} - ${b.endTime.toLocaleTimeString()}: "${b.locationLabel}"`);
});
```

## Diagnostic Steps

### Step 1: Check Hook Output
Look for logs starting with `[useLocationBlocksForDay]`:
- Before gap-filling: Should show 2 blocks (with gaps)
- After gap-filling: Should show 3 blocks (gaps filled)
- **Expected:** 3 blocks, all "Believe Candle Co."

### Step 2: Check LocationBlockList Receives Correct Data
Look for logs starting with `[LocationBlockList] 🔍 useEffect triggered`:
- Should show 3 blocks from hook
- Labels should be "Believe Candle Co."
- **If this shows 2 blocks or wrong labels → Hook is returning stale data**

### Step 3: Check Timeline Enrichment
Look for logs `[LocationBlockList] 🔍 Setting blocksWithTimeline`:
- Should show 3 blocks after enrichment
- Labels should still be correct
- **If this shows 2 blocks → Calendar/comm event fetch is causing issues**

### Step 4: Check Filter Logic
Look for logs `[LocationBlockList] 🔍 displayBlocks computed`:
- Filter should be "both" or "actual"
- Should show 3 blocks
- **If this shows 2 blocks → Filter is removing blocks incorrectly**

### Step 5: Check UI Rendering
Look at the actual rendered blocks in the Activity Timeline
- Count the location block cards
- Check the labels
- **If UI shows 2 blocks but logs show 3 → React rendering issue**

## Potential Root Causes

### A. Stale Database Data ❌ UNLIKELY
The `location_hourly` table might have old data from before gap-filling was implemented.
- **How to check:** Look at Step 1 logs - if hook shows 2 blocks, database is stale
- **Fix:** Reprocess the day using the lightning bolt button in Activity Timeline

### B. Timeline Enrichment Issue ✓ LIKELY
The useEffect that enriches blocks with timeline events might be:
1. Not running (cancelled flag issue)
2. Using stale calendar/comm event data
3. Overwriting correct blocks with old data

- **How to check:** Compare Step 2 vs Step 3 logs
- **Fix:** Clear the async cancellation or force refresh

### C. Filter Logic Issue ❌ UNLIKELY
The filter might be incorrectly hiding blocks with 0 timeline events.
- **How to check:** Compare Step 3 vs Step 4 logs
- **Fix:** Change filter to "both" or check timelineEvents population

### D. React State Issue ✓ POSSIBLE
The component might be using stale state from a previous render.
- **How to check:** Compare Step 4 logs vs actual UI
- **Fix:** Force remount by changing date or tapping refresh

### E. Component Key Issue ❌ RULED OUT
The key prop `blocks-${selectedDate}-${refreshKey}` should force remount.
- Already verified in activity-timeline.tsx line 348

## Next Actions

1. **Rebuild and reload the app** to ensure latest code is running
2. **Navigate to Activity Timeline** for the problematic date
3. **Check Metro logs** for all 4 debug checkpoints above
4. **Compare logs to UI** - identify where data diverges
5. **Report findings** with complete log output

## Quick Test
Navigate to Activity Timeline → Select the date with the issue → Check logs for:
- Hook: 3 blocks ✓
- LocationBlockList receives: ? blocks
- After enrichment: ? blocks  
- After filter: ? blocks
- UI shows: 2 blocks ❌

The first mismatch reveals the culprit!

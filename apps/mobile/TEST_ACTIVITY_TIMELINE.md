# Activity Timeline Fix Verification

## Quick Test
1. **Rebuild the app:** `npx expo start --clear`
2. **Open Activity Timeline** screen
3. **Select the date** that was showing stale data
4. **Check Metro logs** for this sequence:

### Expected Log Output
```
[useLocationBlocksForDay] 🔍 DEBUG: After gap-filling, 3 blocks:
  - 2:42:01 AM - 4:00:00 AM: "Believe Candle Co." (2 samples)
  - 4:00:00 AM - 7:03:25 AM: "Believe Candle Co." (0 samples [CARRIED])
  - 7:03:25 AM - 7:56:05 AM: "Believe Candle Co." (0 samples [CARRIED])

[LocationBlockList] 🔍 useEffect triggered: baseBlocks.length = 3
[LocationBlockList] 🔍 Base blocks from hook:
  - 2:42:01 AM - 4:00:00 AM: "Believe Candle Co." (2 samples)
  - 4:00:00 AM - 7:03:25 AM: "Believe Candle Co." (0 samples)
  - 7:03:25 AM - 7:56:05 AM: "Believe Candle Co." (0 samples)

[LocationBlockList] 🔍 Initializing blocksWithTimeline with baseBlocks (pre-enrichment)

[LocationBlockList] 🔍 Setting blocksWithTimeline: 3 blocks
  - 2:42:01 AM - 4:00:00 AM: "Believe Candle Co." (2 samples, X events)
  - 4:00:00 AM - 7:03:25 AM: "Believe Candle Co." (0 samples, Y events)
  - 7:03:25 AM - 7:56:05 AM: "Believe Candle Co." (0 samples, Z events)

[LocationBlockList] 🔍 displayBlocks computed: filter="both", blocksWithTimeline.length=3, displayBlocks.length=3
  - 2:42:01 AM - 4:00:00 AM: "Believe Candle Co."
  - 4:00:00 AM - 7:03:25 AM: "Believe Candle Co."
  - 7:03:25 AM - 7:56:05 AM: "Believe Candle Co."
```

### UI Verification
- ✅ Should show **3 location blocks**
- ✅ All should be labeled **"Believe Candle Co."**
- ✅ No "Unknown Location" blocks
- ✅ Time ranges should match the logs

## What Changed
**Before Fix:**
- Hook returns 3 blocks (correct)
- LocationBlockList starts async enrichment
- UI shows OLD blocksWithTimeline (2 blocks) from previous render
- After enrichment completes → UI updates to 3 blocks
- **But if enrichment is cancelled or slow, UI shows stale 2 blocks**

**After Fix:**
- Hook returns 3 blocks (correct)
- LocationBlockList **IMMEDIATELY** sets blocksWithTimeline to 3 blocks
- UI shows correct 3 blocks instantly
- Async enrichment adds timeline events
- **UI is always correct, even during enrichment**

## Troubleshooting

### If UI Still Shows 2 Blocks
1. **Check logs** - which step shows wrong count?
   - If hook shows 2: Database has stale data → Reprocess day
   - If useEffect shows 2: Hook cache issue → Force refresh
   - If displayBlocks shows 2: Filter issue → Change filter to "both"

2. **Force refresh:**
   - Tap lightning bolt (reprocess)
   - Or change date and come back
   - Or pull down to refresh

3. **Clear cache:**
   ```bash
   npx expo start --clear
   ```

### If Enrichment is Cancelled
Look for log: `[LocationBlockList] 🔍 Cleanup: marking enrichment as cancelled`

This is NORMAL when:
- Navigating to a different date quickly
- Component remounts with new key
- **Now safe:** UI still shows correct blocks from immediate initialization

## Success Criteria
✅ Logs show 3 blocks at every stage
✅ UI shows 3 blocks immediately (before enrichment)
✅ All blocks labeled "Believe Candle Co."
✅ No "Unknown Location" blocks
✅ Gap-filling working (middle 2 blocks marked as [CARRIED] in hook logs)

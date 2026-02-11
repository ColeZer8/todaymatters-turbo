# Quick Test Guide - Location Block Fix

## 🚀 Run This First

```bash
cd ~/Projects/todaymatters-turbo/apps/mobile
npm run ios
```

## 📱 What to Do in the App

1. Open the app on your device
2. Navigate to **Location Blocks** view
3. Go to **Feb 11, 2026** (today)
4. Look at the blocks displayed

## ✅ What You Should See

### Expected Result (After Fix)
One continuous block:
```
📍 Believe Candle Co.
2:42 AM - 7:56 AM · 5h 14m
```

Or possibly two blocks (if segments don't fully merge):
```
📍 Believe Candle Co.
2:42 AM - 7:03 AM · 4h 21m

📍 Believe Candle Co. [carried forward]
7:03 AM - 7:56 AM · 53m
```

### What You Should NOT See
```
📍 Believe Candle Co.
2:42 AM - 4:00 AM · 1h 18m

📍 Believe Candle Co.  ← Duplicate!
4:00 AM - 7:03 AM · 3h 3m

❓ Unknown Location  ← Wrong!
7:03 AM - 7:56 AM · 53 min
```

## 📋 Check the Logs

In the **Metro bundler terminal** (where `npm run ios` is running), you should see:

```
📍 [groupSegmentsIntoLocationBlocks] Processing X segments:
  0: 2:42 AM - 4:00 AM: "Believe Candle Co."
  1: 4:00 AM - 7:03 AM: "Believe Candle Co."

📍 [isSamePlace] ✅ Merging by place label: "Believe Candle Co."

📍 [fillLocationGaps] 🔄 Replaced "Unknown Location" block
with carried-forward location "Believe Candle Co."
```

## ❌ If It's Not Working

### Problem: Blocks still not merging

**Check the logs for:**
```
📍 [isSamePlace] ❌ Not merging: "Believe Candle Co." ↔ "Believe Candle Co."
```

This will tell you **why** they're not merging:
- Different place IDs?
- Coordinates too far apart?
- No label match?

**Send me the full debug output** from the Metro terminal.

---

### Problem: Still showing "Unknown Location"

**Check if the block is being created:**
```
📍 [groupSegmentsIntoLocationBlocks] Created 3 groups:
  Group 0: "Believe Candle Co." (...)
  Group 1: "Unknown Location" (...)  ← This should be replaced
```

**And if replacement is happening:**
```
📍 [fillLocationGaps] 🔄 Replaced "Unknown Location" block
```

If you see the "Created 3 groups" but NOT the replacement log, **send me the logs**.

---

## 🐛 Debugging Commands

### See All Debug Logs
Just run the app - they'll appear in Metro automatically.

### Filter to Just Location Block Logs
In a separate terminal:
```bash
# If Metro is saving logs to a file
tail -f metro.log | grep "📍"

# Or just watch the Metro terminal output
```

---

## 📸 Share Results

If it works:
- Take a screenshot showing the merged blocks
- Paste the key debug logs (merge confirmations)

If it doesn't work:
- Share the full debug output from Metro
- Share screenshots of what you're seeing
- Note which issue is still happening (merging or carry-forward)

---

## 🎯 Success Criteria

- [ ] No duplicate "Believe Candle Co." blocks
- [ ] No "Unknown Location" block at 7:03-7:56 AM
- [ ] Debug logs show successful merging
- [ ] Debug logs show carry-forward replacement (if applicable)

---

## Next Steps After Testing

If everything works:
1. Test with other dates to ensure no regressions
2. We can reduce debug log verbosity
3. Ship it! 🚀

If something's wrong:
1. Share debug logs with me
2. I'll investigate and fix
3. Repeat testing

---

## Files Changed

Just one file with all the fixes:
- `apps/mobile/src/lib/utils/group-location-blocks.ts`

No database changes, no backend changes, just pure logic fixes.

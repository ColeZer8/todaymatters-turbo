# Quick Start: Debug Feb 11 Missing Segments

**Problem:** Only 1 activity segment for Feb 11 with 0 location samples.

---

## 🚨 Run These 3 Checks First

### ✅ Check 1: Database Query (2 minutes)

Open Supabase SQL Editor and run:

```sql
-- How many location samples exist for Feb 11?
SELECT COUNT(*) as samples
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11 00:00:00'
  AND recorded_at < '2026-02-12 00:00:00';
```

**Result Meaning:**
- **0 samples** → Location tracking never ran (go to Check 2)
- **< 50 samples** → Tracking ran briefly (go to Check 2)
- **> 500 samples** → Data exists! (go to Check 3)

---

### ✅ Check 2: Is Tracking Running NOW? (1 minute)

In the app:
1. Go to **Dev** → **Background Location**
2. Tap **"Capture Location Now"**
3. Wait 5 seconds
4. Run this query:

```sql
SELECT COUNT(*) FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at > NOW() - INTERVAL '1 minute';
```

**Result Meaning:**
- **1 or more** → Tracking works! Problem was in the past.
- **0** → Tracking is BROKEN right now (fix immediately)

---

### ✅ Check 3: Were Segments Generated? (1 minute)

```sql
SELECT COUNT(*) as segments
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00';
```

**Result Meaning:**
- **0 or 1 segment** AND **> 500 samples** → Segment generation is broken
- **0 or 1 segment** AND **< 50 samples** → Not enough data to create segments

---

## 🔧 Quick Fixes

### If Tracking is Broken (Check 2 failed)

**iOS:**
1. Go to **Settings** → **TodayMatters** → **Location**
2. Select **"Always"** (NOT "While Using")
3. Force-quit and reopen app
4. Re-run Check 2

**Android:**
1. Go to **Settings** → **Apps** → **TodayMatters** → **Permissions** → **Location**
2. Select **"Allow all the time"**
3. Force-quit and reopen app
4. Re-run Check 2

---

### If Segments Weren't Generated (Check 3 failed but samples exist)

Run this in app console or create a dev button:

```typescript
import { generateActivitySegments, saveActivitySegments } from '@/lib/supabase/services/activity-segments';

// Generate segments for each hour of Feb 11
const userId = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
for (let hour = 0; hour < 24; hour++) {
  const hourStart = new Date(2026, 1, 11, hour, 0, 0); // Feb 11, 2026
  const segments = await generateActivitySegments(userId, hourStart);
  await saveActivitySegments(segments);
  console.log(`Hour ${hour}: ${segments.length} segments created`);
}
```

---

## 📊 Full Diagnostic (5 minutes)

For a complete picture, run the SQL diagnostic script:

```bash
# In Supabase SQL Editor
# Paste the contents of: diagnostic-feb11.sql
# Look for layers marked "❌ NO DATA" or "⚠️  LOW DATA"
```

This will check:
- Location samples (raw GPS)
- Activity segments (processed data)
- Location hourly (aggregates)
- Screen time (fallback data)
- Hourly summaries (final output)

---

## 🎯 Decision Tree

```
Is tracking working NOW? (Check 2)
├─ NO → Fix permissions, restart app, retest
└─ YES → Did tracking work on Feb 11? (Check 1)
    ├─ NO (0 samples) → Data is lost forever, move on
    └─ YES (> 50 samples) → Were segments created? (Check 3)
        ├─ NO → Run segment generation script
        └─ YES → UI display issue (check logs)
```

---

## 📱 Add Diagnostic Screen (Optional, 10 minutes)

The diagnostic tools are already created. To add to your app:

1. Files are already in:
   - `apps/mobile/src/lib/diagnostics/location-tracking-health.ts`
   - `apps/mobile/src/app/dev/location-diagnostics.tsx`

2. Add route to dev menu:
   ```typescript
   // In apps/mobile/src/app/dev/index.tsx or wherever dev menu is
   <Link href="/dev/location-diagnostics">
     <Text>Location Diagnostics</Text>
   </Link>
   ```

3. Use it:
   - Open app → Dev → Location Diagnostics
   - Tap "Run Health Check"
   - Get color-coded status report

---

## 🚀 Expected Timeline

- **Check 1-3:** 5 minutes
- **Fix tracking:** 5 minutes
- **Regenerate segments:** 2 minutes
- **Add diagnostic screen:** 10 minutes
- **Total:** ~20 minutes to diagnose and fix

---

## 📝 What to Report Back

When done, share:

1. **Check 1 Result:** How many samples for Feb 11? _____
2. **Check 2 Result:** Is tracking working now? YES / NO
3. **Check 3 Result:** How many segments for Feb 11? _____
4. **Root Cause:** (Based on decision tree above)
5. **Fix Applied:** (What you did to fix it)

---

## 🆘 If Still Stuck

Run the full diagnostic script (`diagnostic-feb11.sql`) and share the output. It will show exactly which layer of the pipeline is broken.

---

**Quick Reference:**
- User ID: `b9ca3335-9929-4d54-a3fc-18883c5f3375`
- Date: `2026-02-11`
- Time Zone: America/Chicago
- Expected: Hundreds of samples, dozens of segments
- Actual: 1 segment, 0 samples

# Investigation Results: Feb 11, 2026 Missing Segments

## Executive Summary

**Problem:** Only 1 activity segment found for entire day (Feb 11) with 0 location samples and null geohash.

**Root Cause:** **Data collection pipeline failure** - location samples are NOT being written to the database, or segments are not being generated from existing data.

**Impact:** Complete loss of activity timeline for the day (except one 53-minute period from screen time data only).

---

## Investigation Findings

### The Data Pipeline

I traced the entire data flow from GPS collection to UI display:

```
GPS Collection → Local Queue → Supabase Upload → Segment Generation → UI Display
(location-task)   (queue.ts)   (sync hook)       (activity-segments)   (hook)
```

### Critical Issues Identified

#### 1. **Only 1 Segment with 0 Location Samples**

From the logs:
```
LOG [useLocationBlocksForDay] Used segment-based grouping: 1 segments → 1 blocks
LOG [useLocationBlocksForDay] 🔍 DEBUG: Before gap-filling, 1 blocks:
LOG  - 7:03:25 AM - 7:56:05 AM: "Unknown Location" (0 samples, geohash=null)
```

This segment was likely created from **screen time data only** (screen sessions from 7:03-7:56 AM), not from GPS data. This is a **fallback behavior** when no location samples exist.

#### 2. **Missing Segments Before 7 AM**

No segments exist from midnight to 7 AM. Possible reasons:
- Location tracking wasn't running
- App was force-killed and didn't restart tracking
- Device was offline/in airplane mode
- Segments were created but deleted

#### 3. **Missing Segments After 7:56 AM**

No segments after 7:56 AM suggests:
- Location tracking stopped
- Data hasn't been processed yet (if it's early in the day)
- Hourly summary pipeline hasn't run

### Key Code Findings

#### Session Requirement (CRITICAL)
From `location-task.ts`:
```typescript
const sessionResult = await supabase.auth.getSession();
const userId = sessionResult.data.session?.user?.id ?? null;
if (!userId) return; // ← SAMPLES SILENTLY DROPPED if session expired
```

If the Supabase session expires while the background task is running, **all location samples are dropped silently**. No error, no retry, just lost data.

#### Foreground-Only Android Collection
From `use-location-samples-sync.ts`:
```typescript
// Android foreground location collection: Uses the SAME approach as "Capture Location Now"
// Background task is still registered but not reliable, so we collect
// location in foreground as a fallback. This runs when app is open.
```

On Android, reliable collection only happens when the app is **open**. If the app was closed all day on Feb 11, no data would be collected.

#### iOS Background Requires "Always" Permission
iOS background location requires "Always Allow" permission. If only "While Using" is granted, background collection fails silently.

---

## Diagnostic Tools Created

I created three diagnostic tools for Cole to investigate the issue:

### 1. SQL Diagnostic Script (`diagnostic-feb11.sql`)

**Purpose:** Query Supabase database directly to identify the data gap.

**Usage:**
```bash
# In Supabase SQL Editor, run the script
# It will check all layers of the pipeline:
# - location_samples (raw GPS)
# - activity_segments (processed data)
# - location_hourly (aggregates)
# - screen_time_app_sessions (screen data)
# - hourly_summaries (final output)
```

**Key Queries:**
- Count location samples by hour for Feb 11
- List all activity segments for Feb 11
- Check screen time sessions (fallback data source)
- Pipeline health check across all layers

### 2. App-Based Health Check (`location-tracking-health.ts`)

**Purpose:** Real-time diagnostics from within the app.

**Features:**
- ✅ Check location permissions (foreground/background)
- ✅ Verify background task is registered and running
- ✅ Inspect local queue state (pending samples)
- ✅ Check recent Supabase uploads
- ✅ Verify activity segments are being created
- ✅ Generate actionable recommendations

**Usage:**
```typescript
import { runLocationTrackingDiagnostics } from '@/lib/diagnostics/location-tracking-health';

const report = await runLocationTrackingDiagnostics(userId);
console.log(report.summary);
// Output: "✅ Location tracking is HEALTHY" or "❌ Location tracking is BROKEN"
```

### 3. Dev Screen UI (`location-diagnostics.tsx`)

**Purpose:** Visual interface for diagnostics in the app.

**Features:**
- "Run Health Check" button - shows color-coded status
- "Check Specific Date" - query database for any date
- Real-time permission status
- Queue state visualization
- Actionable recommendations list

**Access:** Dev menu → Location Diagnostics

---

## Next Steps for Cole

### Immediate Actions (Run Today)

#### 1. **Run SQL Diagnostic Script**
```bash
# In Supabase SQL Editor
# Run: diagnostic-feb11.sql
# Look for "NO DATA" or "LOW DATA" status
```

**Expected Output:**
```
Location Samples: ❌ NO DATA  <-- This is the smoking gun
Activity Segments: ⚠️  LOW DATA (1 record)
Screen Time: ✅ OK (dozens of records)
```

#### 2. **Add Diagnostic Screen to App**

The files are already created:
- `apps/mobile/src/lib/diagnostics/location-tracking-health.ts`
- `apps/mobile/src/app/dev/location-diagnostics.tsx`

Add route to dev menu:
```typescript
// In dev menu navigation
<Link href="/dev/location-diagnostics">Location Diagnostics</Link>
```

#### 3. **Run Health Check in App**

1. Open TodayMatters app
2. Go to Dev → Location Diagnostics
3. Tap "Run Health Check"
4. Screenshot the results and check for errors

#### 4. **Verify Device Permissions**

**iOS:**
```
Settings → TodayMatters → Location → Must be "Always"
NOT "While Using the App" or "Ask Next Time"
```

**Android:**
```
Settings → Apps → TodayMatters → Permissions → Location → "Allow all the time"
Check for persistent notification: "TodayMatters is tracking your location"
```

### Investigation Queries

After running diagnostics, answer these questions:

**Q1: How many location_samples exist for Feb 11?**
```sql
SELECT COUNT(*) FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11' AND recorded_at < '2026-02-12';
```
- If 0: Location tracking never ran
- If < 50: Tracking started/stopped intermittently
- If > 500: Samples exist but segments weren't created

**Q2: What screen time sessions exist for Feb 11?**
```sql
SELECT started_at, ended_at, display_name
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11' AND started_at < '2026-02-12'
ORDER BY started_at;
```
This shows when the device was actively used (app was open).

**Q3: Is location tracking running RIGHT NOW?**
Run the health check in the app and look for:
- "✅ Background task: Registered and likely running"
- "✅ Last sample uploaded X min ago"

If either shows ❌, tracking is currently broken and needs fixing.

---

## Hypotheses Ranked by Likelihood

### 1. **Background Tracking Not Running (80% likely)**

**Evidence:**
- Only 1 segment with 0 samples
- Segment created from screen time only
- Missing segments throughout the day

**Test:**
```bash
# In app diagnostic screen:
# Look for "Background Task" status
# If ❌, this is the issue
```

**Fix:**
- Check iOS permission is "Always Allow"
- Restart app to re-register background task
- Verify location services are ON

### 2. **Supabase Session Expired (15% likely)**

**Evidence:**
- Background task silently drops samples if no session
- Would explain 0 samples in database

**Test:**
```sql
-- Check if user has valid session
SELECT * FROM auth.sessions 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
ORDER BY created_at DESC LIMIT 1;
```

**Fix:**
- Sign out and sign back in
- Implement session refresh in background task

### 3. **Queue Not Flushing (5% likely)**

**Evidence:**
- Samples collected but never uploaded

**Test:**
```typescript
// In app diagnostic screen:
// Look for "Queue State"
// If > 100 pending samples, queue is stuck
```

**Fix:**
- Open app to trigger manual flush
- Check network connectivity
- Clear queue and restart tracking

---

## Recommended Fixes

### Short-Term (Fix Data Loss)

1. **Verify tracking is running NOW** (prevent future data loss)
2. **Check Feb 11 database state** (understand what's missing)
3. **Add monitoring** (detect future failures)

### Medium-Term (Prevent Recurrence)

1. **Add session refresh to background task**
   ```typescript
   // In location-task.ts
   if (!userId) {
     // Try to refresh session before dropping samples
     await supabase.auth.refreshSession();
     const retrySession = await supabase.auth.getSession();
     userId = retrySession.data.session?.user?.id ?? null;
   }
   ```

2. **Add error logging to background task**
   ```typescript
   // Log when samples are dropped
   if (!userId) {
     console.error('[Location] Dropping samples: no session');
     // Could also write to local error log
   }
   ```

3. **Add health check endpoint**
   ```typescript
   // Periodically check:
   // - Last sample upload time
   // - Queue size
   // - Background task status
   // Alert user if broken
   ```

### Long-Term (Reliability)

1. **Implement offline-first architecture**
   - Queue samples locally with SQLite
   - Sync when connection available
   - Never drop samples

2. **Add data validation**
   - Hourly check: "Did we get samples this hour?"
   - Alert if no data for > 2 hours
   - Auto-restart tracking if broken

3. **Background task health monitoring**
   - Ping endpoint every hour from background task
   - Server alerts if no ping for > 3 hours
   - Proactive notification to user

---

## Files Created

### Investigation Documents
- `investigation-feb11-data.md` - Full investigation guide
- `diagnostic-feb11.sql` - SQL queries for database investigation
- `FINDINGS-feb11-investigation.md` - This file (summary report)

### Code (Ready to Use)
- `apps/mobile/src/lib/diagnostics/location-tracking-health.ts` - Health check library
- `apps/mobile/src/app/dev/location-diagnostics.tsx` - UI screen for diagnostics

---

## What Cole Should Do Next

### Priority 1: Identify the Data Gap
1. Run `diagnostic-feb11.sql` in Supabase SQL Editor
2. Count location_samples for Feb 11
3. Count activity_segments for Feb 11
4. Determine: **Samples exist but no segments?** or **No samples at all?**

### Priority 2: Fix Current Tracking
1. Add diagnostic screen to app
2. Run health check
3. Fix any ❌ errors shown
4. Verify tracking is running NOW

### Priority 3: Prevent Future Data Loss
1. Add session refresh to background task
2. Add error logging
3. Add health check monitoring

---

## Expected Outcomes

### If 0 Location Samples Exist
**Diagnosis:** Background location tracking never ran on Feb 11  
**Fix:** Check permissions, restart tracking, verify it works NOW  
**Recovery:** Data cannot be recovered for Feb 11 (lost forever)

### If Samples Exist but 0 Segments
**Diagnosis:** Segment generation pipeline is broken  
**Fix:** Run `generateActivitySegments()` manually for each hour  
**Recovery:** Data can be recovered by regenerating segments

### If Samples AND Segments Exist
**Diagnosis:** UI grouping logic issue (very unlikely based on logs)  
**Fix:** Debug `use-location-blocks-for-day.ts` hook  
**Recovery:** No data loss, just display issue

---

## Conclusion

The Feb 11 data issue is **most likely a collection failure**, not a processing failure. The single segment with 0 samples suggests:

1. Location tracking didn't run (or ran briefly)
2. Screen time data was collected normally (7:03-7:56 AM)
3. A fallback segment was created from screen time only
4. No other segments exist because no location data was collected

**Next step:** Run the SQL diagnostic script to confirm whether location_samples exist in the database. That will tell us if this is a collection failure (no samples) or a processing failure (samples exist but no segments).

---

**Files for Cole:**
- ✅ `diagnostic-feb11.sql` - Run this first
- ✅ `location-tracking-health.ts` - Add to codebase
- ✅ `location-diagnostics.tsx` - Add to dev menu
- ✅ `investigation-feb11-data.md` - Full technical details
- ✅ `FINDINGS-feb11-investigation.md` - This summary (send to main agent)

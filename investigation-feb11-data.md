# Investigation: Feb 11, 2026 - Missing Activity Segments

## Problem Summary

**Critical data collection issue:**
- Only **1 activity segment** found for entire day (Feb 11, 2026)
- That segment has **0 location samples** and `geohash=null`
- Segment time: 7:03 AM - 7:56 AM (53 minutes)
- Missing: All segments from midnight to 7 AM, and after 7:56 AM

## Data Pipeline Architecture

```
┌─────────────────────────────────────────────────────┐
│ 1. Background Location Collection (location-task.ts)│
│    - Runs in background on iOS/Android              │
│    - Collects GPS coordinates                       │
│    - Enqueues to AsyncStorage (queue.ts)            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 2. Queue in AsyncStorage (queue.ts)                 │
│    - Holds pending samples locally                  │
│    - Deduplicates by timestamp+coords               │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 3. Sync to Supabase (use-location-samples-sync.ts)  │
│    - Flushes queue periodically                     │
│    - Uploads to tm.location_samples table           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 4. Generate Activity Segments (activity-segments.ts)│
│    - Reads location_samples                         │
│    - Groups into segments with place labels         │
│    - Saves to tm.activity_segments table            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 5. UI Display (use-location-blocks-for-day.ts)      │
│    - Fetches activity_segments                      │
│    - Groups segments into location blocks           │
│    - Shows in timeline UI                           │
└─────────────────────────────────────────────────────┘
```

## Diagnostic Queries

### Query 1: Check Location Samples (Raw GPS Data)

```sql
-- Count samples for Feb 11
SELECT 
  COUNT(*) as total_samples,
  MIN(recorded_at) as first_sample,
  MAX(recorded_at) as last_sample,
  COUNT(DISTINCT DATE_TRUNC('hour', recorded_at)) as hours_with_data
FROM tm.location_samples
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND recorded_at >= '2026-02-11 00:00:00'
  AND recorded_at < '2026-02-12 00:00:00';
```

**Expected:** Hundreds of samples spread across many hours
**If 0 samples:** Location collection is broken (Step 1-3 failure)
**If < 10 samples:** Insufficient data for segment creation

### Query 2: Check Activity Segments (Processed Data)

```sql
-- List all segments for Feb 11
SELECT 
  id,
  started_at,
  ended_at,
  EXTRACT(EPOCH FROM (ended_at - started_at))/60 as duration_minutes,
  location_geohash7,
  place_label,
  inferred_activity,
  activity_confidence,
  (evidence->>'locationSamples')::int as location_sample_count
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00'
ORDER BY started_at ASC;
```

**Expected:** Multiple segments throughout the day
**Current:** Only 1 segment from 7:03 AM - 7:56 AM with 0 samples

### Query 3: Check Hourly Aggregates

```sql
-- Check if hourly aggregation is running
SELECT 
  hour_start,
  geohash7,
  sample_count,
  place_label,
  google_place_name
FROM tm.location_hourly
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND hour_start >= '2026-02-11 00:00:00'
  AND hour_start < '2026-02-12 00:00:00'
ORDER BY hour_start ASC;
```

**Expected:** 24 rows (one per hour) with sample counts
**If missing:** Hourly aggregation job is not running

### Query 4: Check Screen Time Data (Fallback for Segments)

```sql
-- Check if screen time sessions exist
SELECT 
  COUNT(*) as session_count,
  MIN(started_at) as first_session,
  MAX(ended_at) as last_session
FROM tm.screen_time_app_sessions
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND started_at >= '2026-02-11 00:00:00'
  AND started_at < '2026-02-12 00:00:00';
```

**Note:** Even without GPS, segments should be created from screen time data

## Root Cause Hypotheses

### Hypothesis 1: Background Location Tracking Not Running
**Symptoms:** 0 location samples in database
**Causes:**
- iOS background location permission not granted (needs "Always Allow")
- Android foreground service crashed
- Location services disabled on device
- App was force-killed and didn't restart tracking

**Verification:**
- Check iOS Settings → TodayMatters → Location → "Always"
- Check Android: Is notification showing "TodayMatters is tracking your location"?
- Check device location services are ON

### Hypothesis 2: Queue Not Flushing to Supabase
**Symptoms:** Samples collected but not uploaded
**Causes:**
- Network connection issues
- Supabase authentication expired
- Queue full (>10,000 samples) and dropped new data
- Sync hook not running (app never foregrounded)

**Verification:**
- Check AsyncStorage for pending samples (key: `tm:location:pending:{userId}`)
- Check network logs for failed Supabase uploads
- Verify user session is valid

### Hypothesis 3: Segment Generation Not Running
**Symptoms:** Samples exist but no segments created
**Causes:**
- Hourly summary job not triggering segment generation
- `generateActivitySegments()` has a bug for this specific day
- Segments created but immediately deleted

**Verification:**
- Run `generateActivitySegments()` manually for each hour of Feb 11
- Check if segments are created then deleted by `deleteActivitySegmentsForHour()`

### Hypothesis 4: The One Segment with 0 Samples
**Symptoms:** One "ghost" segment exists with no data
**Causes:**
- Screen time data exists for 7:03-7:56 AM but no location data
- Segment created as fallback when location collection failed
- This is a **correct behavior** if only screen time exists

**Verification:** Check screen_time_app_sessions for 7:03-7:56 AM range

## Immediate Actions for Cole

### Action 1: Run Database Queries
Execute queries 1-4 above in Supabase SQL Editor to identify the data gap.

### Action 2: Check Device State (iOS)
```bash
# On Cole's Mac, check if location permission is granted
# Look for TodayMatters in iOS Settings → Privacy → Location Services
# Required: "Always" permission

# Check recent location samples in AsyncStorage
# This requires inspecting the app's local storage
```

### Action 3: Check Logs
Look for these log patterns:
```
📍 queued X iOS location samples (pending=Y)
📍 uploaded X iOS location samples (remaining=Y)
📍 Failed to start iOS background location
```

### Action 4: Force Manual Collection
In the app:
1. Go to dev screen
2. Tap "Capture Location Now"
3. Check if location sample is created
4. Check database immediately after

## Expected Next Steps

1. **If 0 location_samples:** Fix background tracking (permissions, service restart)
2. **If samples exist but 0 segments:** Debug segment generation logic
3. **If samples AND segments exist:** Check UI grouping logic in `use-location-blocks-for-day.ts`
4. **If only screen time data:** Location tracking started at 7:03 AM, need to investigate why it wasn't running before

## Files to Review

- `apps/mobile/src/lib/ios-location/location-task.ts` - Background collection
- `apps/mobile/src/lib/ios-location/queue.ts` - Local queue management
- `apps/mobile/src/lib/supabase/hooks/use-location-samples-sync.ts` - Upload sync
- `apps/mobile/src/lib/supabase/services/activity-segments.ts` - Segment generation
- `apps/mobile/src/lib/hooks/use-location-blocks-for-day.ts` - UI display

## Known Issues from Code Review

1. **iOS Background Task Requires Session:**
   - Location task checks `supabase.auth.getSession()` 
   - If session expired, samples are dropped silently
   - Check: `const userId = sessionResult.data.session?.user?.id ?? null;`

2. **Foreground-Only Collection on Android:**
   - Background task exists but unreliable
   - Foreground polling runs every 2 minutes when app is open
   - If app never opened on Feb 11, no samples collected

3. **5-Minute Dwell Filter:**
   - Segments shorter than 5 minutes are dropped
   - May explain missing short stops
   - Check: `filterShortSegments()` in activity-segments.ts

4. **Gap Filling Logic:**
   - `fillLocationGaps()` carries forward last known location
   - May create "Unknown Location" blocks where GPS was off
   - This explains the 7:03-7:56 AM block

## Recommended Fix Priority

1. **Immediate:** Run SQL queries to identify data gap
2. **High:** Check if location tracking is running NOW (prevent future data loss)
3. **High:** Verify Supabase session is valid and not expiring
4. **Medium:** Add better error logging to identify silent failures
5. **Medium:** Add health check endpoint to verify data pipeline is working
6. **Low:** Add UI indicator when location tracking is off

---

**Next Steps for Subagent:**
1. Create SQL diagnostic script
2. Create app-based diagnostic function
3. Propose monitoring/alerting improvements
4. Document recovery procedure for data gaps

# Debug: No Actual Events Being Created

**Issue**: Query for `type = 'calendar_actual'` returns no rows for 2026-01-22

---

## Diagnostic Queries

Run these queries in Supabase to find out why:

### 1. Check if location data exists
```sql
-- Check location samples for the date
select 
  count(*) as sample_count,
  min(recorded_at) as first_sample,
  max(recorded_at) as last_sample
from tm.location_samples 
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and recorded_at::date = '2026-01-22';
```

**Expected**: Should show samples throughout the day if location tracking is working
**If 0 samples**: Location tracking isn't running or user hasn't granted permission

### 2. Check if screen time data exists
```sql
-- Check screen time sessions for the date
select 
  count(*) as session_count,
  sum(extract(epoch from (ended_at - started_at))) / 60 as total_minutes,
  array_agg(distinct app order by app) as apps
from tm.screen_time_app_sessions
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and date = '2026-01-22'
group by user_id;
```

**Expected**: Should show app sessions throughout the day
**If 0 sessions**: Screen time data collection isn't running

### 3. Check if location hourly data exists (aggregated)
```sql
-- Check hourly location aggregates
select 
  count(*) as hour_count,
  array_agg(hour_start::time order by hour_start) as hours
from tm.location_hourly
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and hour_start::date = '2026-01-22';
```

**Expected**: Should show hourly aggregates (used by verification engine)

### 4. Check if ANY events exist for the user
```sql
-- Check all events for this user
select 
  type,
  count(*) as count,
  array_agg(distinct scheduled_start::date order by scheduled_start::date desc) as dates
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
group by type
order by type;
```

**Expected**: Should show what event types exist

### 5. Check for planned events on 2026-01-22
```sql
-- Check if there are planned events (meetings, calendar)
select 
  id,
  type,
  title,
  scheduled_start,
  scheduled_end
from tm.events
where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
  and (
    scheduled_start::date = '2026-01-22' 
    or scheduled_end::date = '2026-01-22'
  )
order by scheduled_start;
```

**Expected**: Should show any planned events (meetings, user-created events)

---

## Common Causes & Solutions

### Cause 1: No Evidence Data Being Collected
**Symptoms**: 
- Location samples query returns 0 rows
- Screen time query returns 0 rows

**Solutions**:
1. Check if iOS permissions are granted (Location: Always, Screen Time: Enabled)
2. Check if background tasks are running
3. Check app logs for collection errors
4. Verify device has iOS 16+ (required for Screen Time API)

### Cause 2: Data Collection Started Today
**Symptoms**:
- Evidence data exists but `location_hourly` is empty
- Screen time data exists but not aggregated yet

**Solutions**:
- Location hourly data is aggregated periodically
- Try checking yesterday's date (data might be fresher)
- Wait for next aggregation cycle

### Cause 3: All Time is Covered by Planned Events
**Symptoms**:
- Evidence data exists
- Planned events cover entire day (8am-10pm)

**How it works**:
- `generateActualBlocks()` only creates blocks for UNPLANNED time
- If planned events cover 8am-10pm, no actual blocks are created
- This is BY DESIGN (verification, not duplication)

**Solution**: This is expected behavior! The system only fills gaps.

### Cause 4: Evidence Below Minimum Thresholds
**Symptoms**:
- Some evidence data exists but sparse

**Thresholds**:
- Location: Needs 6+ samples in an hour to create block (confidence)
- Screen Time: Needs 10+ minutes to create block
- Workouts: No minimum (all workouts shown)

**Solution**: More data collection time needed

### Cause 5: App Not Running Sync
**Symptoms**:
- Evidence data exists in raw tables
- No events created

**Check**:
1. Open app to comprehensive calendar screen
2. Check console logs for:
   - `[Verification] actualBlocks: [...]`
   - `[Calendar] Syncing X actual evidence blocks`
   - `[Calendar] Failed to sync actual evidence blocks`

**Solution**: App needs to be opened to trigger sync

---

## Expected Behavior

### When Evidence Exists + No Planned Events
```
9:00-9:15am: Screen Time (Safari) → creates 'calendar_actual' event
9:15-10:30am: Location (Coffee Shop) → creates 'calendar_actual' event  
10:30-11:00am: Screen Time (Slack) → creates 'calendar_actual' event
```

### When Evidence Exists + Planned Events Overlap
```
9:00-10:00am: Planned "Morning Meeting" → NO actual event created
10:00-10:30am: Location (Coffee Shop) → creates 'calendar_actual' event
10:30-12:00pm: Planned "Deep Work" → NO actual event created
```

### When No Evidence Data
```
(No actual events created - system has nothing to work with)
```

---

## Debugging Steps

1. **Run diagnostic queries above** to see what data exists
2. **Check app logs** when on comprehensive calendar screen
3. **Verify date**: Make sure checking the right date (today vs yesterday)
4. **Check time range**: Evidence might exist for different hours than expected
5. **Open the app**: Sync only runs when comprehensive calendar is opened

---

## Quick Test Query

Run this to see EVERYTHING for the user on that date:

```sql
-- Show everything for debugging
with evidence_data as (
  select 'location_samples' as source, count(*) as count
  from tm.location_samples 
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and recorded_at::date = '2026-01-22'
  union all
  select 'location_hourly', count(*)
  from tm.location_hourly
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and hour_start::date = '2026-01-22'
  union all
  select 'screen_time_sessions', count(*)
  from tm.screen_time_app_sessions
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and date = '2026-01-22'
  union all
  select 'health_workouts', count(*)
  from tm.health_workouts
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and started_at::date = '2026-01-22'
  union all
  select 'events_calendar_actual', count(*)
  from tm.events
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and type = 'calendar_actual'
    and scheduled_start::date = '2026-01-22'
  union all
  select 'events_calendar_planned', count(*)
  from tm.events
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and type = 'calendar_planned'
    and scheduled_start::date = '2026-01-22'
  union all
  select 'events_meeting', count(*)
  from tm.events
  where user_id = '62c02dff-42ef-4d0d-ae60-445adc464cc6'
    and type = 'meeting'
    and scheduled_start::date = '2026-01-22'
)
select * from evidence_data
order by source;
```

This will show you exactly what data exists vs what's missing!

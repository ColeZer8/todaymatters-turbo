# 🔍 REAL ISSUE: Background Location Collection Not Saving

**Date**: 2026-01-31  
**Status**: INVESTIGATION  

---

## The Actual Problem

The issue is NOT with sessionization - it's that **location samples aren't being saved to the database** in the background.

### What's Working ✅
1. Background task starts successfully ("Background location task started successfully")
2. Permissions are granted
3. Manual "Capture Location Now" works instantly

### What's NOT Working ❌
1. Background location samples are collected but NOT saved to database
2. Task shows "stale heartbeat (1176 minutes)" - hasn't run in almost 20 hours!
3. Constant restarts but no actual data collection

---

## The Architecture

### How It Should Work:

```
1. Background Task (Every ~5 min)
   ↓ Collects GPS samples
   
2. Queue (AsyncStorage)
   ↓ Stores samples locally
   
3. Flush Hook (Every 5-15 min)
   ↓ Uploads to Supabase
   
4. Ingestion Pipeline
   ↓ Creates location-based sessions
   
5. Calendar Display
   ✓ Shows location-informed sessions
```

### What's Actually Happening:

```
1. Background Task
   ↓ Starts but NOT collecting (stale heartbeat)
   
2. Queue
   ✓ Empty (no samples collected)
   
3. Flush Hook
   ✓ Running but nothing to flush
   
4. Ingestion Pipeline
   ✓ Working but no location data
   
5. Calendar Display
   ❌ Shows "Unknown Location" (no data)
```

---

## The Symptoms

From your logs:
```
WARN  📍 [health] Task running but stale heartbeat (1176m) — restarting
LOG  📍 [health] Background task not running — restarting (attempt 1/3)
LOG  📍 [start] Background location task started successfully
LOG  📍 [health] Restart successful: started
```

**Translation:**
- Task hasn't fired in 1176 minutes (19.6 hours!)
- Health check detects this and restarts
- Restart "succeeds" but task still doesn't collect

**Manual capture works because:**
- It's a foreground operation (different code path)
- Direct GPS access (not via background task)
- Immediate save to Supabase (no queue)

---

## Root Cause Hypotheses

### Theory #1: Android Battery Optimization ⚠️ MOST LIKELY

**Android kills background tasks aggressively** to save battery.

**Check:**
1. Settings → Apps → TodayMatters → Battery
2. Should show "Unrestricted" (not "Optimized")

**Symptoms match:**
- Task "starts" but never actually runs
- Stale heartbeat (hasn't fired in hours)
- Constant restarts

### Theory #2: Background Location Permission Not Full

**Android 10+** requires TWO permission levels:
1. Foreground location ("While using app") - ✅ You have this
2. Background location ("Allow all the time") - ❓ Do you have this?

**Check:**
1. Settings → Apps → TodayMatters → Permissions → Location
2. Must show "Allow all the time" (not just "While using the app")

### Theory #3: Task Registration Failure

The task registers but something in the Android system is blocking execution.

**Possible causes:**
- Doze mode
- App standby
- Device manufacturer restrictions (Samsung, Xiaomi, etc.)

---

## Diagnostic Steps

### 1. Check Battery Optimization

```
Settings → Apps → TodayMatters → Battery → Unrestricted
```

If it's "Optimized", change to "Unrestricted" and restart app.

### 2. Check Background Location Permission

```
Settings → Apps → TodayMatters → Permissions → Location
```

Must show "Allow all the time" (with "While using the app" checked).

### 3. Check Pending Queue

In the app console, check if samples are being queued:

```javascript
// In Profile → Dev Tools or console
const userId = '<your-user-id>';
const samples = await peekPendingAndroidLocationSamplesAsync(userId, 100);
console.log('Pending samples:', samples.length);
```

**Expected:** Should be 0 or very few (if they're being flushed)  
**If many:** Task is queuing but flush hook isn't working  
**If zero:** Task isn't collecting at all

### 4. Force Manual Collection

Test if manual collection works:
1. Profile → Dev Tools → "Capture Location Now"
2. Check database:
```sql
SELECT * FROM tm.location_samples
WHERE user_id = '<your-user-id>'
ORDER BY recorded_at DESC
LIMIT 10;
```

**Expected:** Should see new sample immediately

### 5. Check Task Heartbeat

Look for this in logs when app is open:
```
📍 [task] Background location task fired at <timestamp>
📍 [task] Received <N> raw location(s)
📍 [task] Queued <N> Android location samples (pending=<count>)
```

**If you see these:** Task is working, flush might be the issue  
**If you DON'T see these:** Task isn't firing at all

---

## Recommended Fixes

### Fix #1: Disable Battery Optimization

This is the #1 reason background tasks fail on Android.

1. Settings → Apps → TodayMatters → Battery
2. Select "Unrestricted"
3. Restart app
4. Wait 10-15 minutes
5. Check if samples appear in database

### Fix #2: Verify Full Background Permission

1. Settings → Apps → TodayMatters → Permissions → Location
2. Ensure "Allow all the time" is selected
3. Restart app

### Fix #3: Add "Don't Kill My App" Exemptions

Some manufacturers (Xiaomi, Huawei, OnePlus) have additional battery restrictions:

1. Visit https://dontkillmyapp.com/
2. Find your device manufacturer
3. Follow instructions to whitelist TodayMatters

### Fix #4: Increase Task Frequency (Dev Only)

Temporarily increase collection frequency to test:

In `android-location/index.ts`, change:
```typescript
// From:
timeInterval: 5 * 60 * 1000, // 5 minutes

// To:
timeInterval: 2 * 60 * 1000, // 2 minutes (for testing)
```

If samples start appearing, the task IS working but just not frequently enough.

---

## What Success Looks Like

After fixing, you should see:

**In console (while app open):**
```
📍 [task] Background location task fired at 2026-01-31T10:55:00.000Z
📍 [task] Received 1 raw location(s)
📍 [task] Converted to 1 valid sample(s)
📍 [task] Queued 1 Android location samples (pending=3)
```

**Every 5 minutes**, even with app in background.

**In database:**
```sql
SELECT COUNT(*) FROM tm.location_samples
WHERE user_id = '<your-user-id>'
  AND recorded_at > NOW() - INTERVAL '1 hour';
-- Should show 10-15 samples (one every 5-6 minutes)
```

**In calendar:**
- "Home - Productive" (knows your place)
- "Work - Focus" (knows office)
- "Commute" (detects travel)
- Proper session grouping by location

---

## Next Steps

1. Check battery optimization → Set to "Unrestricted"
2. Verify location permission → "Allow all the time"
3. Restart app
4. Wait 15-20 minutes (task needs time to fire)
5. Check database for new samples
6. Report back what you find

If still not working after these steps, we'll need to:
- Check device-specific restrictions
- Review background task logs
- Possibly increase task frequency
- Add more aggressive restart logic

---

**The sessionization logic is fine - we just need location data flowing in first!**

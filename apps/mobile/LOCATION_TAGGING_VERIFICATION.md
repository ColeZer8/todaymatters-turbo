# Location Tagging Verification Guide

## 🔍 What Was Fixed

The `createUserPlace` function was **NOT saving the `geohash7` field**, which is critical for location matching and lookups. This has been fixed in:

- `createUserPlace()` - Now includes geohash7 ✅
- `upsertUserPlaceFromCoordinates()` - Now includes geohash7 ✅
- `upsertUserPlaceFromSamples()` - Now includes geohash7 ✅

All functions now include extensive **console logging** to track the save flow.

## 🧪 How to Test

### 1. Clear App Cache & Restart
```bash
# Kill the app completely
# Re-open the app to ensure new code is loaded
```

### 2. Tag a Location
1. Open the Activity Timeline
2. Find a location block
3. Tap on the location name (if alternatives are available)
4. Select or enter a place name (e.g., "Home")
5. Select a category (e.g., 🏠 Home)
6. Tap "Save"

### 3. Check Console Logs

You should see logs like this in Metro bundler:

```
🔍 [LocationBlockList] PLACE SELECTION TRIGGERED
🔍 [LocationBlockList] EXTRACTED COORDINATES
🔍 [LocationBlockList] CALLING createUserPlace
🔍 [createUserPlace] CREATING USER PLACE
🔍 [createUserPlace] INSERT PAYLOAD: {
  user_id: "...",
  label: "Home",
  category: "home",
  latitude: 40.7128,
  longitude: -74.0060,
  geohash7: "dr5regw",  ← THIS IS CRITICAL!
  radius_m: 150,
  center: "POINT(-74.0060 40.7128)"
}
✅ [createUserPlace] INSERT SUCCESS
✅ [LocationBlockList] USER PLACE CREATED SUCCESSFULLY
```

**🚨 If you see an error**, it will be logged with ❌ prefix.

## 🗄️ SQL Verification Queries

### Query 1: Check Recent User Places
Run this in Supabase SQL Editor to see your recent saves:

```sql
SELECT 
  id,
  label,
  category,
  geohash7,
  ST_AsText(center) as coordinates,
  radius_m,
  created_at,
  updated_at
FROM tm.user_places
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY created_at DESC
LIMIT 10;
```

### Query 2: Check Specific Place by Label
```sql
SELECT 
  id,
  label,
  category,
  geohash7,
  ST_X(center) as longitude,
  ST_Y(center) as latitude,
  radius_m,
  created_at
FROM tm.user_places
WHERE user_id = '<YOUR_USER_ID>'
  AND label = 'Home'  -- Change to your label
ORDER BY created_at DESC;
```

### Query 3: Check All Places with Geohash7
```sql
SELECT 
  label,
  category,
  geohash7,
  created_at
FROM tm.user_places
WHERE user_id = '<YOUR_USER_ID>'
  AND geohash7 IS NOT NULL
ORDER BY created_at DESC;
```

### Query 4: Find Places WITHOUT Geohash7 (Should be empty after fix)
```sql
SELECT 
  id,
  label,
  category,
  created_at
FROM tm.user_places
WHERE user_id = '<YOUR_USER_ID>'
  AND geohash7 IS NULL;
```

## 🔑 How to Get Your User ID

Run this in Supabase SQL Editor:

```sql
SELECT 
  id as user_id,
  email
FROM auth.users
WHERE email = '<your_email@example.com>';
```

Or check the console logs - the user_id is logged (truncated) in the save operations.

## ✅ Success Criteria

1. **Console logs show**:
   - ✅ `INSERT PAYLOAD` with `geohash7` field
   - ✅ `INSERT SUCCESS` message
   - ✅ No ❌ error messages

2. **SQL Query shows**:
   - Row exists in `tm.user_places`
   - `geohash7` column is NOT null
   - `label` matches what you entered
   - `category` matches what you selected
   - `center` coordinates are correct

3. **App behavior**:
   - Location label appears correctly on timeline after refresh
   - No error alerts shown

## 🐛 Troubleshooting

### Issue: "Cannot Save Location" alert
**Cause**: No coordinates available for the block  
**Fix**: Try a different location block that has GPS data

### Issue: Duplicate constraint error
**Cause**: A place with that label already exists  
**Fix**: Use a different label or delete the existing one first:
```sql
DELETE FROM tm.user_places
WHERE user_id = '<YOUR_USER_ID>'
  AND label = 'Home';
```

### Issue: No console logs appear
**Cause**: Old code still cached  
**Fix**: 
1. Kill the app completely
2. Run `npm start -- --reset-cache` in terminal
3. Rebuild the app

### Issue: geohash7 is still NULL in database
**Cause**: Old code or cache issue  
**Fix**:
1. Verify you're running the latest code
2. Check that the console logs show the geohash7 in the payload
3. If logs show it but DB doesn't have it, there may be a database column issue

## 📝 Notes

- The `geohash7` field enables fast location lookups without spatial queries
- It's computed from latitude/longitude using the geohash algorithm
- Precision level 7 gives ~153m × 153m cell resolution
- All three save functions now include this field automatically

---

**Last Updated**: 2026-02-11  
**Fixed By**: TodayMatters Subagent  
**Issue**: Location tagging not saving to Supabase (missing geohash7 field)

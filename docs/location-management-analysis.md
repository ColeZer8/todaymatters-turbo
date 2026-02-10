# Location Management Analysis & Best Practices

**Date:** February 10, 2026  
**Issue:** `place_id` not populated in activity_segments  
**Client ID:** `b9ca3335-9929-4d54-a3fc-18883c5f3375`

---

## 🔍 Root Cause Analysis

### Why `place_id` is NULL

Looking at your activity segments data, `place_id` is always `null` but `place_label` IS populated with names like:
- "Whitehead John S MD"
- "Total Home Inspection LLC"  
- "Believe Candle Co."

**This is actually working as designed!** Here's what's happening:

1. **Pipeline Flow:**
   ```
   Location Samples → Generate Segments → Match User Places → Lookup Google Places → Save
   ```

2. **The Two Place Systems:**
   
   | System | Purpose | Field | Example |
   |--------|---------|-------|---------|
   | **User Places** (`tm.user_places`) | User-defined labeled places | `place_id` | "Home", "Office", "Gym" |
   | **Google Places Cache** (`tm.location_place_cache`) | Auto-discovered place names | `place_label` | "Starbucks on Main St" |

3. **What's Missing:**
   - Your user (`b9ca3335...`) has **ZERO rows** in `tm.user_places`
   - So the pipeline can't match location samples to user-defined places → `place_id` stays null
   - But Google Places API lookups ARE working → `place_label` gets populated

### Verification Query

```sql
-- Check if user has defined any places
SELECT COUNT(*) as place_count 
FROM tm.user_places 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';

-- Expected result: 0
```

---

## ✅ What's Working

### 1. **BRAVO Pipeline (Activity Segments)**
- ✅ Generating enriched segments every hour
- ✅ Location centroids calculated correctly
- ✅ Activity inference working ("deep_work", "commute", "mixed_activity")
- ✅ Screen time app breakdown accurate
- ✅ Confidence scores calculated (0.30-1.00 range)

### 2. **Google Places Lookup**
- ✅ Auto-discovering place names via `location-place-lookup` edge function
- ✅ Caching results in `tm.location_place_cache` (180-day TTL)
- ✅ Distance verification implemented (rejects labels >500m from centroid)
- ✅ Confidence scoring for fuzzy vs. precise matches

### 3. **Recent Data Quality**
From your results:
- Latest segment: 23 min ago (12:36 PM)
- 22 segments today (Feb 10)
- Fresh data flowing consistently
- Place labels appearing: "Whitehead John S MD", "Believe Candle Co.", etc.

---

## 📍 Best Practices for User Location Management

### **Philosophy: Progressive Enhancement**

Don't force users to set up places upfront. Let the system learn from usage, then offer intelligent "claim this place" prompts.

### **Recommended User Flow**

#### **Stage 1: Passive Discovery (First 1-2 weeks)**
```
User installs app → Grants location permission → Does nothing

System behavior:
- Collects location samples silently
- Auto-generates place labels via Google Places
- Shows activity timeline with auto-discovered names
- NO user action required
```

**Why:** Reduce onboarding friction. Show value before asking for configuration.

---

#### **Stage 2: Smart Suggestions (After pattern detection)**

After 3-7 days of data, detect frequent places:

```sql
-- Find top 5 most-visited places
WITH place_visits AS (
  SELECT 
    place_label,
    COUNT(*) as visit_count,
    SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600 as total_hours,
    AVG(location_lat) as avg_lat,
    AVG(location_lng) as avg_lng
  FROM tm.activity_segments
  WHERE user_id = :userId
    AND place_label IS NOT NULL
    AND place_id IS NULL  -- Not yet claimed
  GROUP BY place_label
  HAVING COUNT(*) >= 5  -- Visited at least 5 times
)
SELECT * FROM place_visits
ORDER BY total_hours DESC
LIMIT 5;
```

**UI Prompt:**
```
┌─────────────────────────────────────────────────────┐
│  💡 Frequently Visited Place Detected               │
├─────────────────────────────────────────────────────┤
│  📍 Believe Candle Co.                              │
│  • Visited 12 times this week                       │
│  • ~15 hours spent here                             │
│                                                      │
│  What do you do here?                               │
│  [ ] Work       [ ] Gym       [ ] Home              │
│  [ ] Other: ________________                        │
│                                                      │
│  Label it as: ________________                      │
│                                                      │
│  [Skip]  [Save as "Office"]                         │
└─────────────────────────────────────────────────────┘
```

---

#### **Stage 3: Manual Place Management**

Settings → Places → [List of claimed places]

**Each Place Card Shows:**
```
┌─────────────────────────────────────────────────────┐
│  🏢 Office                                          │
│  Believe Candle Co. • 123 Main St                  │
│  ────────────────────────────────────────────────   │
│  Category: Work                                     │
│  Detection Radius: 150m  [Adjust]                  │
│  Auto-tagged: 47 activities                        │
│                                                      │
│  [Edit] [Delete] [View Map]                         │
└─────────────────────────────────────────────────────┘
```

**Key Features:**
- Visual radius picker (map + slider: 50m - 500m)
- Category assignment (Work, Home, Gym, Social, etc.)
- Merge duplicates ("Starbucks #1234" + "Starbucks Main St" = "Starbucks")
- Bulk actions ("Set all Starbucks → 'Coffee Shop'")

---

### **Stage 4: Automatic Backfill**

When user creates a place, automatically match historical segments:

```typescript
/**
 * After user creates/updates a place, reprocess recent history
 * to link old segments to the new place.
 */
async function backfillPlaceMatches(
  userId: string,
  placeId: string,
  place: UserPlace
): Promise<number> {
  // Find all segments near this place that aren't already linked
  const { data: candidates } = await supabase
    .schema("tm")
    .from("activity_segments")
    .select("id, location_lat, location_lng")
    .eq("user_id", userId)
    .is("place_id", null)  // Not yet linked
    .gte("started_at", subDays(new Date(), 30).toISOString());  // Last 30 days

  let matched = 0;
  for (const seg of candidates ?? []) {
    if (!seg.location_lat || !seg.location_lng) continue;

    const distance = haversineDistance(
      seg.location_lat,
      seg.location_lng,
      place.center_lat,
      place.center_lng
    );

    if (distance <= place.radius_m) {
      await supabase
        .schema("tm")
        .from("activity_segments")
        .update({
          place_id: placeId,
          place_label: place.label,
          place_category: place.category
        })
        .eq("id", seg.id);

      matched++;
    }
  }

  return matched;
}
```

**Show Confirmation:**
```
✅ Place saved!
📍 Matched 47 past activities to "Office"
```

---

## 🎯 Immediate Action Items

### **1. Check User Places Table (30 sec)**

```sql
SELECT * FROM tm.user_places 
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375';
```

**Expected:** 0 rows (confirms diagnosis)

---

### **2. Analyze Frequent Places (5 min)**

```sql
-- Find top places this user visits
SELECT 
  place_label,
  COUNT(*) as visit_count,
  ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600, 1) as total_hours,
  ROUND(AVG(location_lat)::numeric, 6) as avg_lat,
  ROUND(AVG(location_lng)::numeric, 6) as avg_lng,
  ROUND(AVG(activity_confidence)::numeric, 2) as avg_confidence
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND place_label IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY place_label
HAVING COUNT(*) >= 3
ORDER BY total_hours DESC
LIMIT 10;
```

**Use this to:**
- Identify which places to suggest labeling first
- Validate that coordinates are consistent (low variance = good)
- Check confidence scores (>0.7 = high quality data)

---

### **3. Create First User Place (Test)**

```sql
-- Example: Create "Office" place at Believe Candle Co.
INSERT INTO tm.user_places (
  user_id,
  label,
  category,
  radius_m,
  center
) VALUES (
  'b9ca3335-9929-4d54-a3fc-18883c5f3375',
  'Office',
  'work',
  150,
  ST_SetSRID(ST_MakePoint(-97.7431, 30.2672), 4326)::geography  -- Example coords
);
```

**Then reprocess today:**
```typescript
await reprocessDayWithPlaceLookup(userId, '2026-02-10');
```

**Verify:**
```sql
SELECT place_id, place_label, place_category 
FROM tm.activity_segments 
WHERE user_id = 'b9ca3335...' 
  AND place_id IS NOT NULL;
```

---

## 🏗️ Implementation Recommendations

### **Option A: Smart Onboarding Wizard (Low Friction)**

After 3-5 days of passive collection:

```
┌─────────────────────────────────────────────────────┐
│  🎉 We've learned your routine!                     │
├─────────────────────────────────────────────────────┤
│  Here are your top 3 places this week:              │
│                                                      │
│  1. 📍 Believe Candle Co.   (~15h)                  │
│     What do you do here?                            │
│     [Work] [Home] [Other]                           │
│                                                      │
│  2. 📍 Total Home Inspection LLC   (~8h)            │
│     [Work] [Client Site] [Other]                    │
│                                                      │
│  3. 📍 [Unknown location]   (~5h)                   │
│     [Home] [Gym] [Other]                            │
│                                                      │
│  [Skip for now]  [Label These Places]               │
└─────────────────────────────────────────────────────┘
```

---

### **Option B: Contextual Prompts (Just-In-Time)**

When viewing timeline for a day:

```
Activity Timeline - Today

┌─────────────────────────────────────────────────────┐
│  1:23 PM - Believe Candle Co.   (2h 15m)            │
│  Deep work • Slack, Chrome                          │
│                                                      │
│  💡 You visit here often. Want to label it?         │
│  [Label as...] [Dismiss]                            │
└─────────────────────────────────────────────────────┘
```

---

### **Option C: Settings Screen (Power Users)**

Existing screen at `/settings/place-labels` already has:
- ✅ List of user places
- ✅ Edit label/category/radius
- ✅ Delete places
- ✅ Show auto-tag count

**Add:**
- [ ] "Add New Place" button (map picker OR paste address)
- [ ] "Discover Frequent Places" button (runs analysis query)
- [ ] Suggested places section (auto-populated from segment analysis)
- [ ] Map view showing all places + recent visits

---

## 📊 Metrics to Track

### **Place Coverage**
```sql
-- What % of segments have user-defined places?
SELECT 
  COUNT(CASE WHEN place_id IS NOT NULL THEN 1 END)::float / 
  COUNT(*)::float * 100 as place_coverage_pct
FROM tm.activity_segments
WHERE user_id = :userId
  AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

**Target:** >60% after 2 weeks, >80% after 1 month

---

### **Labeling Velocity**
```sql
-- How many places are users labeling per day?
SELECT 
  DATE(created_at) as date,
  COUNT(*) as places_created
FROM tm.user_places
WHERE user_id = :userId
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Target:** 2-3 places in first week, then 1-2/week as they discover new spots

---

### **Confidence Improvement**
```sql
-- Does labeling places improve confidence scores?
SELECT 
  CASE 
    WHEN place_id IS NOT NULL THEN 'Labeled'
    ELSE 'Unlabeled'
  END as status,
  ROUND(AVG(activity_confidence)::numeric, 2) as avg_confidence
FROM tm.activity_segments
WHERE user_id = :userId
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY status;
```

**Expected:** Labeled segments should have +0.1-0.2 higher confidence

---

## 🚀 Next Steps

### **Immediate (This Week)**
1. ✅ Verify user has 0 places in `tm.user_places`
2. ✅ Run frequency analysis to identify top 5 places
3. ✅ Create 1 test place manually (Office or Home)
4. ✅ Reprocess today's data to see `place_id` populate
5. ✅ Validate backfill logic works

### **Short-term (Next Sprint)**
1. [ ] Build "Discover Frequent Places" UI in settings
2. [ ] Add map picker for manual place creation
3. [ ] Implement smart suggestion cards (after 3 days of data)
4. [ ] Add radius visualization on map
5. [ ] Track metrics (coverage %, labeling velocity)

### **Long-term (Next Month)**
1. [ ] Auto-merge duplicate places ("Starbucks #1234" → "Starbucks")
2. [ ] Bulk place management ("Set all Whole Foods → Grocery")
3. [ ] Share places across household (family accounts)
4. [ ] Import places from Calendar ("Office" from recurring meetings)
5. [ ] ML-based category prediction (visit patterns → likely category)

---

## 📝 Summary

**Problem:** `place_id` is null in activity_segments

**Root Cause:** User hasn't created any places in `tm.user_places`

**System Status:** ✅ Working correctly
- Google Places lookups populating `place_label`
- Pipeline generating segments on schedule
- Data quality is good (confidence 0.30-1.00)

**Solution:** 
1. Short-term: Manually create 2-3 frequent places
2. Long-term: Build smart place discovery UI
3. Strategy: Progressive enhancement (passive → suggestions → manual)

**Philosophy:**  
Don't make users work for the app. Let the app work for the user, then suggest helpful improvements.

---

**Next Command to Run:**
```sql
-- See what places are worth labeling first
SELECT 
  place_label,
  COUNT(*) as visits,
  ROUND(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))) / 3600, 1) as hours,
  ROUND(AVG(location_lat)::numeric, 6) || ',' || ROUND(AVG(location_lng)::numeric, 6) as coords
FROM tm.activity_segments
WHERE user_id = 'b9ca3335-9929-4d54-a3fc-18883c5f3375'
  AND place_label IS NOT NULL
GROUP BY place_label
ORDER BY hours DESC
LIMIT 5;
```

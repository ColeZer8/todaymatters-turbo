# Independent Verification: Travel Detection Fix (Commit 12329cf)

**Verifier:** TodayMatters Subagent (Independent Review)  
**Date:** February 10, 2026  
**Target:** Travel detection threshold recalibration  
**User Context:** Paul Graeve (`b9ca3335-9929-4d54-a3fc-18883c5f3375`)

---

## Executive Summary

**⚠️ NOT PRODUCTION READY - CRITICAL ISSUES FOUND**

The travel detection "fix" has **fundamental flaws** that will likely introduce significant false positives (GPS drift detected as travel). While the changes attempt to address missed travel segments, they ignore GPS accuracy data and set thresholds below the noise floor of typical smartphone GPS.

**Recommendation:** **DO NOT DEPLOY** without implementing GPS accuracy filtering.

---

## Critical Issues

### 1. ❌ GPS Accuracy Data Completely Ignored

**Problem:** The code fetches location samples but **does not retrieve the `accuracy_m` field** from the database.

**Evidence:**
```typescript
// From apps/mobile/src/lib/supabase/services/evidence-data.ts:487
const { data, error } = await tmSchema()
  .from("location_samples")
  .select("recorded_at, latitude, longitude, is_mocked, raw")  // ← No accuracy_m!
```

The database schema **has** `accuracy_m`:
```sql
-- From supabase/migrations/20260112000000_create_tm_location_samples.sql
accuracy_m real null check (accuracy_m >= 0),
```

But the movement detection logic **never uses it** to filter out low-quality GPS readings.

**Impact:** GPS drift from inaccurate samples (±10-50m) will be classified as movement.

**Fix Required:** 
- Fetch `accuracy_m` in the SQL query
- Filter out samples with `accuracy_m > 30-50m` before movement detection
- Add accuracy weighting to distance calculations

---

### 2. ❌ MIN_MOVEMENT_SPEED_MS = 0.15 m/s is Below GPS Noise Floor

**New Value:** `0.15 m/s` (0.3 mph / 0.5 km/h)  
**Old Value:** `0.3 m/s` (0.7 mph / 1.1 km/h)

**Why This is Too Low:**

Typical smartphone GPS:
- Horizontal accuracy: **±5-15m** (good conditions)
- **±20-50m** (urban/indoor environments)
- Sample interval: **10-30 seconds**

**GPS Noise Velocity Calculation:**
```
Noise velocity = GPS error / Sample interval
               = 10m / 30s
               = 0.33 m/s
```

**0.33 m/s > 0.15 m/s** → The new threshold is **below the noise floor**!

**Real-World Scenario:**
- User sits at desk for 30 minutes
- GPS drifts 10m every 30 seconds (normal indoor behavior)
- Code detects: "User is walking at 0.33 m/s"
- **False positive:** Creates fake "walking" segments

**Evidence from Code:**
```typescript
// The new threshold catches GPS drift as movement
if (avgSpeedMs < MIN_MOVEMENT_SPEED_MS) return "stationary";  // 0.15 m/s
// GPS drift at 0.33 m/s passes this check! ❌
```

**Recommendation:** Keep at **0.3 m/s minimum**, or implement accuracy-based thresholds:
```typescript
const minSpeed = sample.accuracy_m > 20 ? 0.5 : 0.3;  // Higher threshold for low accuracy
```

---

### 3. ❌ MIN_COMMUTE_GAP_CHECK_MS = 15 seconds is Too Aggressive

**New Value:** `15 seconds`  
**Old Value:** `30 seconds`

**Why This is Problematic:**

15-second gaps are **not** travel - they're normal pauses:
- Traffic light stops
- Checking phone while walking
- Waiting at crosswalk
- Door unlocking delays
- Elevator waits

**Result:** Real stays will be fragmented into multiple fake "commutes":
```
Example Timeline (BEFORE fix):
09:00-09:30  Home
09:30-09:35  Commute (drive)
09:35-12:00  Office

Example Timeline (AFTER fix - WRONG):
09:00-09:30  Home
09:30-09:30:15  "Commute" (stopped at garage door)  ← False positive
09:30:15-09:30:45  "Commute" (actual drive)
09:30:45-09:31:00  "Commute" (parked, walked 10 seconds)  ← False positive
09:31:00-12:00  Office
```

**Recommendation:** Keep at **30 seconds minimum**, or use contextual logic:
- 15s gaps within a place = stay
- 30s+ gaps between different places = potential commute

---

### 4. ⚠️ MIN_COMMUTE_DISTANCE_M = 100m is Borderline

**New Value:** `100m`  
**Old Value:** `200m`

**Analysis:**
- 100m is reasonable for **actual** short walks
- BUT without GPS accuracy filtering, 100m could be within GPS noise
- Indoor GPS drift can easily produce 50-100m position jumps

**Example False Positive:**
```
Scenario: User in 10-story office building
GPS samples:
  - Floor 3: lat/lng shows +30m east (GPS error)
  - Floor 8: lat/lng shows +40m west (GPS error)
Total "distance": 70m
Duration: 2 minutes (elevator ride)
```
Without accuracy filtering, this could be classified as "walking 70m".

**Recommendation:** 
- Keep 100m **IF** GPS accuracy filtering is added
- Otherwise, use 150m as a safer threshold

---

## Moderate Issues

### 5. ⚠️ MIN_COMMUTE_DURATION_MS = 1 minute May Create Noise

**New Value:** `1 minute`  
**Old Value:** `2 minutes`

**Analysis:**
- 1-minute threshold is aggressive but not inherently wrong
- Problem: Combined with low speed threshold (0.15 m/s), this will create many false 1-minute "walks" from GPS drift
- Google Timeline shows 1-minute trips, but Google uses **sensor fusion** (accelerometer, gyroscope, WiFi, cell towers)

**Conditional on Fix #1-3:** If accuracy filtering is added, 1 minute is acceptable.

---

### 6. ⚠️ Movement Classification Thresholds are Reasonable

**Changes:**
- Walking: `< 2.5 m/s` → `< 2.2 m/s` ✓ (Reasonable - typical walking is 1.4 m/s)
- Cycling: `< 8.0 m/s` → `< 7.0 m/s` ✓ (Reasonable - typical cycling is 4-6 m/s)

These are **fine** - they're well above GPS noise and match real-world speeds.

---

## Missing Evidence

### 7. ❌ No Validation Against Google Timeline Data

**Claim (from commit message):**
> "This brings travel detection sensitivity in line with Google Timeline"

**Evidence Provided:** None.

**What's Missing:**
- No comparison of TodayMatters output vs. Google Timeline for Paul's actual data
- No test cases showing before/after results
- No accuracy metrics (precision/recall)

**Required for Production:**
1. Pull Paul's Google Timeline data for 1-2 days
2. Run old thresholds → compare with Google
3. Run new thresholds → compare with Google
4. Measure:
   - False positives (TM detects travel, Google doesn't)
   - False negatives (Google detects travel, TM doesn't)
   - Accuracy of movement type classification

---

### 8. ❌ No Test Coverage for New Thresholds

**Code Review:** The test file (`actual-ingestion.test.ts`) exists but tests **sessionization logic**, not threshold validation.

**Missing Tests:**
- GPS drift scenarios (stationary user with noisy GPS)
- Short walks (100-200m actual movement)
- Traffic light stops (15-30s pauses during commutes)
- Indoor GPS error (50m+ position jumps)

---

## Architecture Review: What's Actually Correct

### ✅ The Detection Pipeline is Solid

The overall logic is sound:
1. Group samples by place proximity
2. Detect gaps between location segments
3. Analyze samples in gaps for movement
4. Classify movement type by speed
5. Create commute segments or annotations

**The problem is purely threshold calibration, not architecture.**

### ✅ Movement Type Classification Logic is Correct

```typescript
function classifyMovementType(distanceM: number, durationMs: number): MovementType {
  const avgSpeedMs = distanceM / (durationMs / 1000);
  if (avgSpeedMs > MAX_REALISTIC_SPEED_MS) return "unknown";  // GPS sanity check ✓
  if (avgSpeedMs < MIN_MOVEMENT_SPEED_MS) return "stationary";  // ❌ Too low
  if (avgSpeedMs < 2.2) return "walking";   // ✓
  if (avgSpeedMs < 7.0) return "cycling";   // ✓
  return "driving";  // ✓
}
```

The logic is correct; only the `MIN_MOVEMENT_SPEED_MS` threshold is wrong.

---

## Comparison: Google Timeline vs. This Fix

| Feature | Google Timeline | This Fix | Assessment |
|---------|----------------|----------|------------|
| **Data Sources** | GPS + accelerometer + gyro + WiFi + cell towers | GPS only | ❌ Missing sensor fusion |
| **Machine Learning** | Deep learning models trained on billions of trips | Rule-based thresholds | ❌ No ML |
| **GPS Accuracy Filtering** | Yes (filters low-accuracy samples) | No | ❌ Critical omission |
| **Context Awareness** | Yes (semantic location, time of day, patterns) | Limited (place matching only) | ⚠️ Basic |
| **Threshold Calibration** | Adaptive per user/environment | Fixed global thresholds | ⚠️ Less robust |

**Conclusion:** These threshold changes **do not** replicate Google Timeline. They simply lower the bar for what counts as movement, without the sophisticated filtering Google uses.

---

## Edge Cases Not Handled

### Indoor GPS Drift
- **Scenario:** User in office building, GPS drifts 50m every minute
- **Current Behavior:** Classified as "walking 50m/min" → fake commutes
- **Fix Needed:** Filter samples with accuracy_m > 50m indoors

### Urban Canyon Effect
- **Scenario:** GPS bounces off skyscrapers, position jumps 100m instantly
- **Current Behavior:** Classified as high-speed movement → fake "driving"
- **Fix Needed:** Filter unrealistic speed changes (> 30 m/s between samples)

### Battery Saver Mode
- **Scenario:** Phone in low power mode, GPS samples every 5 minutes
- **Current Behavior:** Large gaps → everything looks like a commute
- **Fix Needed:** Check sample frequency, skip analysis if < 1 sample/minute

### Parking Garage / Multi-Level Buildings
- **Scenario:** Vertical movement (elevator) causes horizontal GPS error
- **Current Behavior:** May be classified as walking/cycling
- **Fix Needed:** Check altitude changes, ignore horizontal drift if large vertical movement

---

## Recommended Fixes (Priority Order)

### Priority 1: Add GPS Accuracy Filtering (CRITICAL)

```typescript
// In evidence-data.ts
.select("recorded_at, latitude, longitude, is_mocked, accuracy_m, raw")  // Add accuracy_m

// In actual-ingestion.ts (before movement detection)
function filterAccurateSamples(samples: EvidenceLocationSample[]): EvidenceLocationSample[] {
  return samples.filter(s => {
    // Filter out low-accuracy GPS (likely indoor/urban canyon)
    if (s.accuracy_m && s.accuracy_m > 30) return false;  // 30m threshold
    return true;
  });
}

// Adjust movement speed threshold based on accuracy
function getMinMovementSpeed(avgAccuracy: number): number {
  if (avgAccuracy > 20) return 0.5;   // Low accuracy → higher threshold
  if (avgAccuracy > 10) return 0.3;   // Medium accuracy
  return 0.2;                          // High accuracy → can detect slower movement
}
```

### Priority 2: Restore Conservative Thresholds

Until accuracy filtering is implemented:

```typescript
const MIN_MOVEMENT_SPEED_MS = 0.3;           // Restore from 0.15
const MIN_COMMUTE_GAP_CHECK_MS = 30 * 1000; // Restore from 15s
const MIN_COMMUTE_DISTANCE_M = 150;          // Compromise: 150m instead of 100m
const MIN_COMMUTE_DURATION_MS = 1 * 60 * 1000; // Keep 1 minute (OK if other fixes applied)
```

### Priority 3: Add Test Data Validation

```bash
# Create test script:
# 1. Fetch Paul's Google Timeline for Feb 9-10
# 2. Fetch TM's detected segments for same period
# 3. Compare and report:
#    - Missed segments (false negatives)
#    - Extra segments (false positives)
#    - Movement type accuracy
```

### Priority 4: Add Sanity Checks

```typescript
// Detect GPS glitches (teleportation)
function isUnrealisticSpeed(sample1, sample2): boolean {
  const distance = haversineDistance(sample1.lat, sample1.lng, sample2.lat, sample2.lng);
  const duration = (sample2.recorded_at - sample1.recorded_at) / 1000;
  const speed = distance / duration;
  return speed > 30;  // > 67 mph between samples = GPS glitch
}

// Filter consecutive samples with unrealistic speeds
samples = samples.filter((s, i) => {
  if (i === 0) return true;
  return !isUnrealisticSpeed(samples[i-1], s);
});
```

---

## Testing Plan (If Fixes Are Implemented)

### Phase 1: Controlled Testing
1. Add GPS accuracy filtering (Priority 1 fix)
2. Deploy to test environment
3. Manually test scenarios:
   - Sit indoors for 1 hour (should show no commutes)
   - Walk 150m to coffee shop (should show 1 commute)
   - Drive 5 minutes (should show 1 commute)
   - Walk with 20-second pause (should show 1 commute, not 2)

### Phase 2: Paul's Data Validation
1. Fetch Paul's Google Timeline for 2-3 recent days
2. Compare TM output vs Google:
   - Count travel segments: should be ±1 of Google
   - Check movement types: > 80% match
   - Check durations: within ±2 minutes
3. Identify remaining gaps

### Phase 3: Production Monitoring
1. Deploy with feature flag (gradual rollout)
2. Monitor for 48 hours:
   - User reports of "weird commutes"
   - Unusually high commute counts
   - Very short commutes (< 1 min)
3. Compare Paul's timeline with Google daily

---

## Final Verdict

### Is This Fix Production-Ready?

**NO.** ❌

### Why Not?

1. **GPS accuracy data is ignored** → Will create false positives from GPS drift
2. **Movement speed threshold (0.15 m/s) is below GPS noise floor** → Stationary users will show fake movement
3. **15-second gap threshold is too aggressive** → Will fragment real stays
4. **No validation against Google Timeline data** → No evidence this actually works
5. **No test coverage** → No confidence in edge case handling

### What Needs to Happen Before Production?

**MANDATORY (must have):**
1. ✅ Implement GPS accuracy filtering (Priority 1)
2. ✅ Raise MIN_MOVEMENT_SPEED_MS to at least 0.3 m/s
3. ✅ Raise MIN_COMMUTE_GAP_CHECK_MS to at least 30 seconds
4. ✅ Test against Paul's actual Google Timeline data

**RECOMMENDED (should have):**
5. ⚠️ Add sanity checks for GPS glitches
6. ⚠️ Implement accuracy-based adaptive thresholds
7. ⚠️ Add test coverage for GPS drift scenarios

**NICE TO HAVE:**
8. 💡 Consider sensor fusion (accelerometer data if available)
9. 💡 Add user feedback mechanism ("Was this trip correct?")
10. 💡 Implement ML-based classification (long-term)

---

## Confidence Assessment

### What I'm Confident About:
- ✅ The architecture is solid (place matching, segment generation logic)
- ✅ Movement type classification thresholds (walking/cycling/driving) are reasonable
- ✅ The commit is well-documented and includes rollback instructions

### What I'm NOT Confident About:
- ❌ **This fix will reduce false negatives (missed trips)** - Likely yes
- ❌ **This fix won't introduce false positives (fake trips)** - Very likely will
- ❌ **This matches Google Timeline accuracy** - No evidence
- ❌ **GPS drift won't cause issues** - Will absolutely cause issues

---

## Communication to Main Agent

**Summary for Non-Technical Stakeholders:**

The other agent tried to fix missed travel detection by making the app more sensitive. However, they made it **too** sensitive - so sensitive that normal GPS errors will be detected as fake travel.

Think of it like this:
- **Old system:** Only counted as "movement" if you traveled 200m at 0.7 mph
- **New system:** Counts as "movement" if you traveled 100m at 0.3 mph
- **Problem:** Your phone's GPS can "move" 100m at 0.3 mph **while sitting still** due to GPS noise

**Analogy:** It's like turning up a microphone's sensitivity to catch whispers, but now it also picks up every tiny background noise and thinks those are voices too.

**What needs to happen:**
1. Filter out bad GPS data (the phone tells us "this reading might be off by 50 meters" - we should ignore those)
2. Reduce the sensitivity back to more reasonable levels
3. Actually test this against Google Maps data to see if it works

---

## Files That Need Changes

### Must Change:
1. `apps/mobile/src/lib/supabase/services/evidence-data.ts`
   - Line 494: Add `accuracy_m` to SELECT query
   - Update `EvidenceLocationSample` interface to include `accuracy_m: number | null`

2. `apps/mobile/src/lib/supabase/services/actual-ingestion.ts`
   - Line 124: Change `MIN_MOVEMENT_SPEED_MS = 0.15` → `0.3`
   - Line 233: Change `MIN_COMMUTE_DISTANCE_M = 100` → `150` (or keep 100 if accuracy filtering added)
   - Line 1300: Change `MIN_COMMUTE_GAP_CHECK_MS = 15 * 1000` → `30 * 1000`
   - Add: GPS accuracy filtering function before `isMovementGroup()`

### Should Add (new files):
3. `apps/mobile/src/lib/supabase/services/actual-ingestion.accuracy.test.ts`
   - Test GPS drift scenarios
   - Test accuracy-based filtering

4. `scripts/validate-travel-detection.ts`
   - Compare TM output vs Google Timeline
   - Generate accuracy report

---

## Estimated Effort to Fix

- **GPS accuracy filtering:** 2-4 hours
- **Threshold adjustments:** 5 minutes
- **Test data validation:** 3-6 hours
- **Testing and verification:** 4-8 hours

**Total: 1-2 days of focused work**

---

**Verification Complete.**

**Signed:** TodayMatters Verification Subagent  
**Date:** February 10, 2026, 20:51 CST  
**Session:** agent:todaymatters:subagent:937b686e-e3fe-4b18-ac46-ae5e787b2af7

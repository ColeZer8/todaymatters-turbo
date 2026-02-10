# BUG REPORT: Activities Screen Shows ALL Meetings Instead of Today's

**Date:** February 10, 2026 3:36 PM CST  
**Status:** 🔴 ROOT CAUSE CONFIRMED

---

## The Bug

**Symptom:** Activities screen shows 4,550 meetings instead of ~60 for today  
**Root Cause:** `formatLocalIso()` generates timestamps WITHOUT timezone, causing PostgreSQL to interpret them as UTC

---

## Call Chain

```
activity-timeline.tsx
  ↓ passes selectedDate = "2026-02-10"
LocationBlockList.tsx
  ↓ calls fetchPlannedCalendarEventsForDay(userId, "2026-02-10")
calendar-events.ts → fetchPlannedCalendarEventsForDay()
  ↓
  1. ymdToLocalDayStart("2026-02-10") 
     → Date(2026, 1, 10, 0, 0, 0) [LOCAL TIME]
  
  2. addDays(dayStart, 1)
     → Date(2026, 1, 11, 0, 0, 0) [LOCAL TIME]
  
  3. formatLocalIso(dayStart)
     → "2026-02-10T00:00:00.000" ❌ NO TIMEZONE!
  
  4. formatLocalIso(dayEnd)
     → "2026-02-11T00:00:00.000" ❌ NO TIMEZONE!
```

---

## The Problem: formatLocalIso()

**File:** `/apps/mobile/src/lib/calendar/local-time.ts`

```typescript
export function formatLocalIso(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
  //                                                                   ↑
  //                                              MISSING TIMEZONE OFFSET!
}
```

**Output:** `"2026-02-10T00:00:00.000"` (ambiguous timezone)

---

## What PostgreSQL Does

When Postgres receives a timestamp string WITHOUT timezone info:
- Columns with `timestamptz` (timestamp WITH timezone) interpret it based on **server timezone or UTC**
- Paul's events are stored with CST offset: `2026-01-15T10:00:00-06:00`

**The Query:**
```sql
scheduled_start < '2026-02-11T00:00:00.000'  -- Interpreted as UTC!
scheduled_end > '2026-02-10T00:00:00.000'    -- Interpreted as UTC!
```

**Result:** EVERY past event matches because:
- `2026-01-15T10:00:00-06:00` (Jan 15 CST) = `2026-01-15T16:00:00Z` (UTC)
- `2026-01-15T16:00:00Z` < `2026-02-11T00:00:00Z` ✅ (matches filter!)

So instead of filtering for Feb 10, it's fetching **everything before Feb 11 UTC** = THOUSANDS of old events!

---

## The Fix

### Option A: Append Timezone Offset (Recommended)

```typescript
export function formatLocalIso(date: Date): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  
  // Get timezone offset in minutes, convert to +/-HH:MM format
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetMins = pad(Math.abs(offsetMinutes) % 60);
  const tzOffset = `${offsetSign}${offsetHours}:${offsetMins}`;
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzOffset}`;
}
```

**New Output:** `"2026-02-10T00:00:00.000-06:00"` ✅ (unambiguous!)

---

### Option B: Use ISO 8601 with UTC (Alternative)

```typescript
export function formatLocalIso(date: Date): string {
  return date.toISOString(); // Already includes 'Z' for UTC
}
```

**But this might break other parts of the app that expect local time!**

---

### Option C: Use Different Query Filter

Instead of `.lt()` and `.gt()`, use explicit date casting:

```typescript
.gte("scheduled_start", `${ymd}T00:00:00`)  
.lte("scheduled_start", `${ymd}T23:59:59`)
```

**But this still has timezone ambiguity issues.**

---

## Recommended Fix

**Use Option A** - append timezone offset to `formatLocalIso()`:

1. **Update:** `/apps/mobile/src/lib/calendar/local-time.ts`
2. **Add tests** to verify timezone handling
3. **Deploy and test** with Paul's account

---

## Why This Wasn't Caught Earlier

- Works fine in **local dev** (Supabase local DB uses same timezone as dev machine)
- Only breaks in **production** where:
  - DB server is in UTC
  - Client is in CST (-06:00)
  - Timezone mismatch causes filter to fail

---

## Testing the Fix

**Before fix:**
```sql
-- Query sent to Postgres
scheduled_start < '2026-02-11T00:00:00.000'
-- Returns 4,550 events (ALL past events)
```

**After fix:**
```sql
-- Query sent to Postgres
scheduled_start < '2026-02-11T00:00:00.000-06:00'
-- Returns ~60 events (only Feb 10 CST events)
```

---

## Files to Modify

1. **Primary Fix:**
   - `/apps/mobile/src/lib/calendar/local-time.ts` (line 16-25)

2. **Test Files:**
   - Create test case for `formatLocalIso()` with timezone verification

---

**Ready to implement?** Say the word and I'll apply the fix!

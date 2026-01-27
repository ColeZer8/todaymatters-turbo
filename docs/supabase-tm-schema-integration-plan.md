# Supabase TM Schema Integration Plan

**Date**: 2025-01-XX  
**Status**: Planning - Waiting for Schema Access  
**Schema**: `tm` (NOT `public`)

## ⚠️ Critical Note: Using TM Schema

**All Supabase queries must use the `tm` schema, NOT `public`.**

- Client is configured with `db: { schema: 'tm' }` in `apps/mobile/src/lib/supabase/client.ts`
- All queries explicitly use `.schema('tm')` for clarity
- Types need to be regenerated from `tm` schema once access is granted

---

## Current Status

### ✅ Completed

- **Profile Values** - Service layer created (`profile-values.ts`)
  - Ready to test once `profile_values` table is created in `tm` schema
  - All queries use `.schema('tm')`

### ⏳ Waiting for Supabase Team

1. **Expose `tm` schema** in API settings (Dashboard → Settings → API → Exposed schemas)
2. **Create `profile_values` table** in `tm` schema

---

## What We Can Prepare Now (Without Schema Access)

### 1. **Profiles Service Layer** ✅ Ready to Build

**Table**: `tm.profiles`  
**Fields Available**:

- `user_id` (uuid)
- `full_name` (text) - Profile name
- `ideal_work_day` (text) - Wake time "06:30"
- `ideal_sabbath` (text) - Sleep time "22:30"
- `mission` (text) - Purpose/Why selection
- `timezone` (text) - User timezone

**Fields Needed** (ask team to add):

- `role` (text) - Setup questions role selection

**What to Build**:

- `apps/mobile/src/lib/supabase/services/profiles.ts` (already exists, but expand it)
- Functions:
  - `fetchProfile(userId)` - Get full profile
  - `updateProfile(userId, updates)` - Update profile fields
  - `updateFullName(userId, name)`
  - `updateDailyRhythm(userId, wakeTime, sleepTime)`
  - `updateMission(userId, mission)`
  - `updateRole(userId, role)` - Once column exists

**Data Sources**:

- `onboarding-store.ts` → `role`, `wakeTime`, `sleepTime`, `purpose`
- `profile.tsx` → Profile name editing

---

### 2. **Events Service Layer** ✅ Ready to Build

**Table**: `tm.events`  
**Fields Available**:

- `user_id` (uuid)
- `type` (enum) - Includes `"goal"` ✅
- `title` (text) - Goal/initiative name
- `meta` (jsonb) - Additional metadata
- `created_at`, `updated_at` (timestamps)

**What to Build**:

- `apps/mobile/src/lib/supabase/services/events.ts`
- Functions:
  - `fetchGoals(userId)` - Get all goals (`type='goal'`, `meta.category='goal'`)
  - `fetchInitiatives(userId)` - Get all initiatives (`type='goal'`, `meta.category='initiative'`)
  - `createGoal(userId, title)` - Create goal event
  - `createInitiative(userId, title)` - Create initiative event
  - `updateEvent(eventId, updates)`
  - `deleteEvent(eventId)`

**Data Sources**:

- `goals-store.ts` → Goals with tasks, progress, colors
- `initiatives-store.ts` → Initiatives with milestones, progress
- `onboarding-store.ts` → Initial goals/initiatives from onboarding

**Mapping Strategy**:

```typescript
// Simple goals (from onboarding) → events table
{
  type: 'goal',
  title: 'Launch MVP',
  meta: { category: 'goal' }
}

// Complex goals (from goals-store) → events table + meta JSON
{
  type: 'goal',
  title: 'Launch MVP',
  meta: {
    category: 'goal',
    color: '#2563EB',
    progress: 0.5,
    tasks: [...], // Store tasks in meta
    createdAt: '2025-01-01T00:00:00Z'
  }
}
```

---

### 3. **Ideal Day Service Layer** ⚠️ Needs Schema Clarification

**Table**: `tm.ideal_day`  
**Fields Available**:

- `user_id` (uuid)
- `category_id` (integer, nullable) - Unclear structure
- `day_type` (text) - "weekdays" | "weekends" | "custom"
- `minutes` (integer) - Hours as minutes

**Fields Missing** (need to ask team):

- `category_name` (text)
- `color` (text)
- `max_minutes` (integer)
- `selected_days` (jsonb) - For custom day types

**What to Build** (once schema is clarified):

- `apps/mobile/src/lib/supabase/services/ideal-day.ts`
- Functions:
  - `fetchIdealDay(userId, dayType)` - Get categories for day type
  - `saveIdealDayCategory(userId, category)` - Save category hours
  - `updateSelectedDays(userId, dayType, selectedDays)` - Save custom day selections

**Data Sources**:

- `ideal-day-store.ts` → Categories, hours, selected days

---

## Implementation Priority

### Phase 1: Quick Wins (Can Build Service Layers Now)

1. ✅ **Profile Values** - Already done, waiting for table
2. 🔨 **Profiles Service** - Build now, test when schema exposed
3. 🔨 **Events Service** - Build now, test when schema exposed

### Phase 2: Schema-Dependent (Need Team Input)

1. ⏳ **Ideal Day** - Need schema clarification first
2. ⏳ **Routine Items** - Need decision on storage strategy

---

## Service Layer Pattern

All services follow this pattern:

```typescript
// apps/mobile/src/lib/supabase/services/[feature].ts
import { supabase } from "../client";
import type { Database } from "../database.types";

// Use tm schema explicitly
const fromTable = (table: string) => supabase.schema("tm").from(table);

export async function fetchFeature(userId: string) {
  const { data, error } = await fromTable("table_name")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return data;
}
```

---

## Next Steps

1. **Build Profiles Service** - Can do now
2. **Build Events Service** - Can do now
3. **Update Documentation** - Add `tm` schema notes
4. **Wait for Team** - Schema exposure + `profile_values` table
5. **Test & Integrate** - Connect services to stores once access works

---

## Questions for Supabase Team

1. **Profile Values**: Can you create `profile_values` table in `tm` schema?
2. **Profiles Role**: Can you add `role TEXT` column to `tm.profiles`?
3. **Ideal Day**: What's the structure of `category_id`? Do we need to add columns for category metadata?
4. **Schema Exposure**: Can you expose `tm` schema in API settings?

# Supabase Schema Analysis & Integration Readiness

**Date**: 2025-01-02  
**Status**: Analysis Only - No Changes Made

## Executive Summary

The Supabase schema has the core tables needed, but there are **gaps** between what the database provides and what our app's data structures require. Integration is **feasible** but will require:

1. **Schema additions** for ideal day categories metadata
2. **Field mapping decisions** for some UI data
3. **Data transformation** between app state and database format

---

## Schema Comparison: Database vs App Requirements

### ✅ **1. Profile Values** - READY TO INTEGRATE

**Database Table**: `profile_values`
- ✅ `user_id` (uuid, required)
- ✅ `value_label` (text, required) 
- ✅ `rank` (integer, nullable)
- ✅ `id`, `created_at` (auto-generated)

**App Structure**: `profile.tsx` → `CORE_VALUES` array
```typescript
['Family', 'Integrity', 'Creativity']
```

**Integration Status**: ✅ **READY** - Direct mapping possible
- Map array index to `rank`
- Store each value as separate row

---

### ⚠️ **2. Ideal Day Categories** - NEEDS SCHEMA ENHANCEMENT

**Database Table**: `ideal_day`
- ✅ `user_id` (uuid, required)
- ✅ `category_id` (integer, nullable) - **Unclear**: Is this FK or just identifier?
- ✅ `day_type` (text, nullable) - Can store "weekdays" | "weekends" | "custom"
- ✅ `minutes` (integer, nullable) - Can store hours as minutes
- ❌ **MISSING**: `category_name` (text)
- ❌ **MISSING**: `color` (text) 
- ❌ **MISSING**: `max_minutes` or `max_hours` (integer)

**App Structure**: `ideal-day-store.ts` → `IdealDayCategory[]`
```typescript
{
  id: 'sleep',
  name: 'Sleep',
  hours: 8,
  color: '#4F8BFF',
  maxHours: 12,
  icon: Moon
}
```

**Current Schema Issues**:
1. No way to store category name, color, or max hours
2. `category_id` is just a number - no reference table exists
3. Selected days for "custom" day type not stored anywhere

**Recommendations**:
- **Option A**: Add columns to `ideal_day`:
  ```sql
  ALTER TABLE ideal_day 
  ADD COLUMN category_name TEXT,
  ADD COLUMN color TEXT,
  ADD COLUMN max_minutes INTEGER;
  ```
- **Option B**: Create `ideal_day_categories` table:
  ```sql
  CREATE TABLE ideal_day_categories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    max_hours INTEGER NOT NULL,
    icon_key TEXT -- for icon mapping
  );
  ```
- **Option C**: Store metadata in JSON column (less queryable)

**Integration Status**: ⚠️ **NEEDS SCHEMA UPDATE** before integration

---

### ✅ **3. Profiles Table** - MOSTLY READY

**Database Table**: `profiles`
- ✅ `user_id` (uuid, nullable)
- ✅ `full_name` (text, nullable) - Maps to Profile screen name
- ✅ `ideal_work_day` (text, nullable) - Can store wake time "06:30"
- ✅ `ideal_sabbath` (text, nullable) - Can store sleep time "22:30"
- ✅ `mission` (text, nullable) - Can store "your why" purpose selection
- ❌ **MISSING**: `role` (text) - For setup questions selection

**App Data**:
- Profile name: `"Paul"` → `full_name`
- Daily Rhythm wake: `"06:30"` → `ideal_work_day`
- Daily Rhythm sleep: `"22:30"` → `ideal_sabbath`
- Your Why: `"balance"` → `mission`
- Setup Questions role: `"Professional"` → **NEEDS NEW COLUMN**

**Integration Status**: ⚠️ **NEEDS `role` COLUMN** added

---

### ✅ **4. Events Table (Goals & Initiatives)** - READY

**Database Table**: `events`
- ✅ `user_id` (uuid, required)
- ✅ `type` (enum, required) - Includes `"goal"` ✅
- ✅ `title` (text, nullable) - Perfect for goal/initiative names
- ✅ `meta` (jsonb, nullable) - Can store additional metadata
- ✅ `created_at`, `updated_at` (timestamps)

**App Data**:
- Goals: `["Launch MVP", "Run 5k"]` → `events` with `type='goal'`
- Initiatives: `["Q4 Strategy", "Team Hiring"]` → `events` with `type='goal'`

**Integration Status**: ✅ **READY** - Can use `type='goal'` for both

**Note**: Consider using `meta` JSON to distinguish goals vs initiatives:
```json
{"category": "goal"} vs {"category": "initiative"}
```

---

### ⚠️ **5. Events Table (Routine Items)** - NEEDS CLARIFICATION

**Database Table**: `events`
- ✅ `type` enum includes `"task"` ✅
- ✅ `title` for routine item name
- ✅ `meta` JSON for icon_key, minutes, order
- ❓ `scheduled_start` - Should this store wake time reference?

**App Structure**: `routine-builder-store.ts`
```typescript
{
  id: 'hydrate',
  title: 'Hydrate',
  minutes: 2,
  iconKey: 'droplet',
  order: 0  // implicit from array index
}
```

**Questions**:
1. Should routine items use `type='task'` or request new `type='routine_item'`?
2. How to store wake time? In `profiles.ideal_work_day` or first routine item's `scheduled_start`?
3. Should `order` be in `meta` JSON or separate column?

**Integration Status**: ⚠️ **NEEDS DECISION** on type and wake time storage

---

## Missing Schema Elements

### 1. **Ideal Day Category Metadata**
- Category names, colors, max hours not stored
- No way to query "all categories for a user"

### 2. **Selected Days Storage**
- App stores: `selectedDaysByType: { weekdays: [0,1,2,3,4], weekends: [5,6], custom: [] }`
- Database: No table/column for this
- **Solution**: Could store in `ideal_day` table as JSON column or separate `ideal_day_selected_days` table

### 3. **Role Field**
- Setup Questions screen collects role selection
- No `role` column in `profiles` table
- **Solution**: Add `role TEXT` column to `profiles`

### 4. **Routine Wake Time**
- Currently in `routine-builder-store.ts` as `wakeTime: '06:30'`
- Could use `profiles.ideal_work_day` but that's also used for Daily Rhythm
- **Solution**: Either reuse `ideal_work_day` or create `routines` table

---

## Integration Readiness Score

| Feature | Status | Notes |
|---------|--------|-------|
| Profile Values | ✅ Ready | Direct mapping |
| Goals/Initiatives | ✅ Ready | Use `events.type='goal'` |
| Ideal Day Hours | ⚠️ Partial | Missing category metadata |
| Daily Rhythm Times | ✅ Ready | Use `profiles.ideal_work_day/sabbath` |
| Routine Items | ⚠️ Needs Decision | Type and wake time storage |
| Profile Role | ❌ Missing Column | Need `profiles.role` |
| Selected Days | ❌ Missing Storage | Need table/column |

**Overall**: **60% Ready** - Core tables exist but need schema enhancements

---

## Recommended Next Steps

### Phase 1: Quick Wins (Can Integrate Now)
1. ✅ **Profile Values** - Integrate immediately
2. ✅ **Goals/Initiatives** - Integrate using `events` table
3. ✅ **Daily Rhythm** - Integrate using `profiles` table

### Phase 2: Schema Updates Needed
1. ⚠️ **Add `role` column** to `profiles` table
2. ⚠️ **Enhance `ideal_day` table** with category metadata columns OR create `ideal_day_categories` table
3. ⚠️ **Decide on routine storage** - Use `events.type='task'` or create routines table

### Phase 3: Complex Features
1. ⚠️ **Selected days storage** - Add JSON column or separate table
2. ⚠️ **Routine wake time** - Clarify storage location

---

## Questions for Supabase Team

1. **Ideal Day Categories**: 
   - Have you created an `ideal_day_categories` table, or should we add columns to `ideal_day`?
   - How should category metadata (name, color, max_hours) be stored?

2. **Routine Items**:
   - Should routine items use `events.type='task'` or do you want a new type?
   - Where should wake time be stored? (`profiles.ideal_work_day` or separate field?)

3. **Selected Days**:
   - How should we store selected days for custom day types? (JSON array in `ideal_day` or separate table?)

4. **Profile Role**:
   - Can you add `role TEXT` column to `profiles` table for setup questions selection?

---

## Conclusion

The schema is **foundational** but needs **enhancements** before full integration. We can start with Profile Values, Goals, and Daily Rhythm immediately, but Ideal Day and Routines need schema decisions first.

**Recommendation**: Proceed with Phase 1 integrations while coordinating schema updates for Phase 2 features.






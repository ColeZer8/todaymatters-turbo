# Onboarding Data - Supabase Gaps Analysis

**Date**: 2026-01-20  
**Status**: Investigation Complete - No Changes Made

## Summary

Most onboarding data is properly synced to Supabase. Two fields exist in the store but are **not persisted**: `subCategories` and `vipContacts`. The new `ai_setup_responses` field is properly configured and will persist via `meta.ai_setup_responses`.

---

## ✅ What IS Being Saved to Supabase

### tm.profiles Table (Direct Columns)
- ✅ `full_name` → `fullName`
- ✅ `ideal_work_day` → `wakeTime` (converted to "HH:MM")
- ✅ `ideal_sabbath` → `sleepTime` (converted to "HH:MM")
- ✅ `mission` → `purpose`
- ✅ `role` → `role`
- ✅ `has_watched_explainer_video` → `hasWatchedExplainerVideo`
- ✅ `has_completed_onboarding` → `hasCompletedOnboarding`
- ✅ `core_values` (JSONB) → `coreValues`
- ✅ `core_categories` (JSONB) → `coreCategories`
- ✅ `values_scores` (JSONB) → `valuesScores`
- ✅ `goal_whys` (JSONB) → `goalWhys`
- ✅ `church_name` → `churchName`
- ✅ `church_address` → `churchAddress`
- ✅ `church_website` → `churchWebsite`

### tm.profiles.meta (JSONB)
- ✅ `permissions` → `permissions`
- ✅ `joy_selections` → `joySelections`
- ✅ `joy_custom_options` → `joyCustomOptions`
- ✅ `drain_selections` → `drainSelections`
- ✅ `drain_custom_options` → `drainCustomOptions`
- ✅ `focus_style` → `focusStyle`
- ✅ `coach_persona` → `coachPersona`
- ✅ `morning_mindset` → `morningMindset`
- ✅ `home_address` → `homeAddress`
- ✅ `work_address` → `workAddress`
- ✅ `ai_setup_responses` → `aiSetupResponses` (NEW - properly configured)

### tm.events Table
- ✅ Goals → `goals` array (type='goal')
- ✅ Initiatives → `initiatives` array (type='goal', meta.category='initiative')

---

## ❌ What is NOT Being Saved

### 1. subCategories
- **Store Field**: `subCategories: SubCategory[]`
- **Current State**: Exists in onboarding store, has UI screen (`sub-categories.tsx`), but **no sync logic** in `use-onboarding-sync.ts`
- **Impact**: Data is lost on app restart
- **Recommendation**: 
  - Option A: Add to `tm.profiles.meta.sub_categories` (JSONB)
  - Option B: Create dedicated `tm.sub_categories` table if relationships matter

### 2. vipContacts
- **Store Field**: `vipContacts: VIPContact[]`
- **Current State**: Exists in onboarding store, has UI screen (`vip-contacts.tsx`), but **no sync logic** in `use-onboarding-sync.ts`
- **Impact**: Data is lost on app restart
- **Recommendation**:
  - Option A: Add to `tm.profiles.meta.vip_contacts` (JSONB) - simple
  - Option B: Create dedicated `tm.vip_contacts` table if you need queries/relationships

---

## 🔍 Database Schema Status

### Existing Columns (from migrations)
All required columns exist in `tm.profiles`:
- ✅ `role` (text)
- ✅ `mission` (text)
- ✅ `ideal_work_day` (time)
- ✅ `ideal_sabbath` (time)
- ✅ `full_name` (text)
- ✅ `birthday` (date) - *exists but not used in onboarding*
- ✅ `timezone` (text)
- ✅ `has_watched_explainer_video` (boolean)
- ✅ `has_completed_onboarding` (boolean)
- ✅ `core_values` (jsonb)
- ✅ `core_categories` (jsonb)
- ✅ `values_scores` (jsonb)
- ✅ `goal_whys` (jsonb)
- ✅ `church_name` (text)
- ✅ `church_address` (text)
- ✅ `church_website` (text)
- ✅ `meta` (jsonb) - for preferences

### No Migration Needed For
- ✅ `ai_setup_responses` - Already configured to use `meta.ai_setup_responses` (JSONB), no schema change needed

---

## 📋 Migration Requirements

### Required Migrations

**None** - All existing fields are properly configured. The two missing fields (`subCategories`, `vipContacts`) are application-level gaps, not schema gaps.

### Optional Migrations (if you want to persist missing fields)

#### Option 1: Add to meta JSONB (Simplest)
```sql
-- No migration needed - just add to meta JSONB in code
-- Already supported by existing meta column
```

#### Option 2: Dedicated Tables (If relationships/queries needed)
```sql
-- For sub_categories (if you need to query by categoryId)
create table if not exists tm.sub_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, label)
);

-- For vip_contacts (if you need to query contacts)
create table if not exists tm.vip_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text null,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 🎯 Recommendations

1. **Immediate Action**: Add sync logic for `subCategories` and `vipContacts` to `use-onboarding-sync.ts`
   - Store in `meta.sub_categories` and `meta.vip_contacts` (JSONB) for simplicity
   - Add load/save functions similar to other preferences

2. **No Database Migration Needed**: The `meta` JSONB column already supports these fields

3. **Future Consideration**: If you need to query/filter by sub-categories or VIP contacts, consider dedicated tables instead of JSONB

---

## Files to Update (When Ready)

1. `apps/mobile/src/lib/supabase/services/profiles.ts`
   - Add `sub_categories` and `vip_contacts` to `ProfilePreferences` interface

2. `apps/mobile/src/lib/supabase/hooks/use-onboarding-sync.ts`
   - Add `subCategories` and `vipContacts` to load/save logic
   - Add individual save functions if needed

3. `apps/mobile/src/lib/supabase/services/profiles.ts`
   - Update `getProfilePreferences` to handle new fields

---

## Verification Checklist

- [x] All existing onboarding fields mapped to Supabase
- [x] `ai_setup_responses` properly configured (no migration needed)
- [x] Missing fields identified (`subCategories`, `vipContacts`)
- [x] Database schema supports all current fields
- [ ] Sync logic added for missing fields (pending implementation)

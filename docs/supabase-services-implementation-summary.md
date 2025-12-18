# Supabase Services Implementation Summary

**Date**: 2025-01-XX  
**Status**: ✅ Complete - Ready for Testing

## What Was Built

### 1. ✅ Error Handling (`utils/error-handler.ts`)
- Enhanced error messages for common Supabase errors
- Specific handling for:
  - Schema access errors (42501)
  - Table not found errors (PGRST205)
  - Foreign key constraints (23503)
  - Unique constraints (23505)
  - Network errors
  - Authentication errors
- Helper functions to check error types

### 2. ✅ Profiles Service (`services/profiles.ts`)
**Full CRUD operations:**
- `ensureProfileExists(userId)` - Create profile if missing
- `fetchProfile(userId)` - Get full profile
- `updateProfile(userId, updates)` - Partial update
- `updateFullName(userId, name)` - Update name
- `updateDailyRhythm(userId, wakeTime, sleepTime)` - Update wake/sleep times
- `updateMission(userId, mission)` - Update purpose/mission
- `updateRole(userId, role)` - Update role (when column exists)
- Helper functions: `dateToTimeString()`, `timeStringToDate()`

**Data Mapping:**
- `full_name` ← Profile name
- `ideal_work_day` ← Wake time ("HH:MM" format)
- `ideal_sabbath` ← Sleep time ("HH:MM" format)
- `mission` ← Purpose/Why selection
- `role` ← Setup questions role (needs DB column)

### 3. ✅ Events Service (`services/events.ts`)
**Full CRUD operations:**
- `fetchGoals(userId)` - Get all goals
- `fetchInitiatives(userId)` - Get all initiatives
- `createGoal(userId, title, meta?)` - Create goal
- `createInitiative(userId, title, description?, meta?)` - Create initiative
- `updateEvent(eventId, updates)` - Update event
- `deleteEvent(eventId)` - Delete event
- `bulkCreateGoals(userId, titles[])` - Bulk create from onboarding
- `bulkCreateInitiatives(userId, titles[])` - Bulk create from onboarding

**Data Structure:**
- Goals: `type='goal'`, `meta.category='goal'`
- Initiatives: `type='goal'`, `meta.category='initiative'`
- Complex data (tasks, milestones, progress) stored in `meta` JSONB

### 4. ✅ Integration Hooks (`hooks/`)
**React hooks for easy integration:**

#### `useProfileSync(options?)`
- `loadProfile()` - Load from Supabase
- `saveProfile(updates)` - Save to Supabase
- `updateFullName(name)` - Update name
- `updateDailyRhythm(wakeTime, sleepTime)` - Update times
- `updateMission(mission)` - Update mission
- Auto-loads on mount (configurable)

#### `useEventsSync(options?)`
- `loadGoals()` - Load goals
- `loadInitiatives()` - Load initiatives
- `saveGoal(title, meta?)` - Create goal
- `saveInitiative(title, description?, meta?)` - Create initiative
- `updateEvent(eventId, updates)` - Update event
- `deleteEvent(eventId)` - Delete event
- `bulkSaveGoals(titles[])` - Bulk create goals
- `bulkSaveInitiatives(titles[])` - Bulk create initiatives

### 5. ✅ Test Script (`test-services.ts`)
- Comprehensive test suite for all services
- Available globally as `window.testSupabaseServices()`
- Tests all CRUD operations
- Provides detailed success/failure report

### 6. ✅ Updated Existing Services
- `profile-values.ts` - Now uses enhanced error handling
- `verify-auth.ts` - Now uses enhanced error handling

## File Structure

```
apps/mobile/src/lib/supabase/
├── client.ts                    # Supabase client (uses tm schema)
├── database.types.ts            # TypeScript types (needs regeneration from tm)
├── utils/
│   └── error-handler.ts        # ✅ NEW - Enhanced error handling
├── services/
│   ├── index.ts                # ✅ UPDATED - Exports all services
│   ├── profiles.ts             # ✅ EXPANDED - Full CRUD
│   ├── events.ts               # ✅ NEW - Goals & initiatives
│   ├── profile-values.ts       # ✅ UPDATED - Better error handling
│   └── verify-auth.ts          # ✅ UPDATED - Better error handling
└── hooks/
    ├── index.ts                # ✅ NEW - Hook exports
    ├── use-profile-sync.ts     # ✅ NEW - Profile sync hook
    └── use-events-sync.ts       # ✅ NEW - Events sync hook
```

## Usage Examples

### Profiles Service
```typescript
import { fetchProfile, updateFullName, updateDailyRhythm } from '@/lib/supabase/services';

// Fetch profile
const profile = await fetchProfile(userId);

// Update name
await updateFullName(userId, 'John Doe');

// Update daily rhythm
await updateDailyRhythm(userId, '06:30', '22:30');
```

### Events Service
```typescript
import { createGoal, fetchGoals, bulkCreateGoals } from '@/lib/supabase/services';

// Create a goal
const goal = await createGoal(userId, 'Launch MVP', {
  color: '#2563EB',
  progress: 0.5,
  tasks: [...]
});

// Fetch all goals
const goals = await fetchGoals(userId);

// Bulk create from onboarding
await bulkCreateGoals(userId, ['Goal 1', 'Goal 2']);
```

### Using Hooks
```typescript
import { useProfileSync, useEventsSync } from '@/lib/supabase/hooks';

function MyComponent() {
  const { loadProfile, updateFullName } = useProfileSync();
  const { loadGoals, saveGoal } = useEventsSync();

  // Auto-loads profile on mount
  // Use loadProfile(), saveGoal(), etc.
}
```

## Testing

### Run Test Suite
```typescript
// In app console or component
import { testSupabaseServices } from '@/lib/supabase/test-services';
await testSupabaseServices();

// Or use global function
await window.testSupabaseServices();
```

### Manual Testing
1. Sign in to the app
2. Open console
3. Run `await window.testSupabaseServices()`
4. Check results for each service

## Next Steps

### 1. Wait for Schema Access
- Team needs to expose `tm` schema in API settings
- Team needs to refresh schema cache: `NOTIFY pgrst, 'reload schema';`

### 2. Test All Services
- Run `testSupabaseServices()` once schema is accessible
- Verify all CRUD operations work
- Check error handling for edge cases

### 3. Integrate with Stores
- Wire `useProfileSync` to onboarding store
- Wire `useEventsSync` to goals/initiatives stores
- Add optimistic updates where appropriate

### 4. Regenerate Types
- Once schema is accessible, regenerate types from `tm` schema
- Update `database.types.ts` with correct types

## Error Handling

All services now use `handleSupabaseError()` which provides:
- User-friendly error messages
- Specific guidance for common issues (schema access, table not found, etc.)
- Proper error propagation

Example error messages:
- Schema access: "The 'tm' schema is not exposed in Supabase API settings..."
- Table not found: "Table not found: profile_values doesn't exist in the schema cache..."
- Network error: "Unable to connect to Supabase. Please check your internet connection..."

## Status

✅ **All services built and ready**
✅ **Error handling implemented**
✅ **Integration hooks created**
✅ **Test suite available**

⏳ **Waiting for schema access to test**

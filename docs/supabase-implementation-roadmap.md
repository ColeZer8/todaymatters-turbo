# Supabase Implementation Roadmap

**Date**: 2025-01-XX  
**Status**: Ready for Implementation  
**Schema**: `tm` (NOT `public`)

## Current Status Summary

### ✅ Already Implemented
- **Authentication**: Email/password, OAuth code ready (needs provider config)
- **Profile Values Service**: Code complete, waiting for table creation
- **Profiles Service**: Basic `ensureProfileExists()` implemented
- **Auth Verification**: Debug helper for checking auth/data status
- **Deep Linking**: Configured for auth callbacks
- **Edge Functions**: `elevenlabs-webhook`, `agent-tools`, `conversation-token`

### ⏳ Waiting for Team
1. OAuth provider configuration (Google, Apple)
2. `tm` schema exposure in API settings
3. `profile_values` table creation
4. `profiles.role` column addition

---

## Implementation Opportunities

### Phase 1: Data Persistence Services (High Priority)

#### 1. **Expanded Profiles Service** 🔨 Ready to Build
**File**: `apps/mobile/src/lib/supabase/services/profiles.ts`

**Current State**: Only has `ensureProfileExists()`

**What to Add**:
```typescript
// Fetch full profile
export async function fetchProfile(userId: string): Promise<Profile | null>

// Update profile fields
export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void>

// Specific updaters
export async function updateFullName(userId: string, name: string): Promise<void>
export async function updateDailyRhythm(userId: string, wakeTime: string, sleepTime: string): Promise<void>
export async function updateMission(userId: string, mission: string): Promise<void>
export async function updateRole(userId: string, role: string): Promise<void> // Once column exists
```

**Data Sources**:
- `onboarding-store.ts` → `role`, `wakeTime`, `sleepTime`, `purpose`
- `profile.tsx` → Profile name editing

**Database Mapping**:
- `full_name` ← Profile name
- `ideal_work_day` ← Wake time (e.g., "06:30")
- `ideal_sabbath` ← Sleep time (e.g., "22:30")
- `mission` ← Purpose/Why selection
- `role` ← Setup questions role (needs column)

**Effort**: 2-3 hours

---

#### 2. **Events Service (Goals & Initiatives)** 🔨 Ready to Build
**File**: `apps/mobile/src/lib/supabase/services/events.ts` (new file)

**What to Build**:
```typescript
// Goals (simple from onboarding)
export async function fetchGoals(userId: string): Promise<string[]>
export async function createGoal(userId: string, title: string): Promise<void>
export async function deleteGoal(userId: string, eventId: string): Promise<void>

// Goals (complex from goals-store)
export async function fetchComplexGoals(userId: string): Promise<Goal[]>
export async function saveComplexGoal(userId: string, goal: Goal): Promise<void>
export async function updateGoalProgress(userId: string, goalId: string, progress: number): Promise<void>

// Initiatives
export async function fetchInitiatives(userId: string): Promise<string[]>
export async function createInitiative(userId: string, title: string): Promise<void>
export async function deleteInitiative(userId: string, eventId: string): Promise<void>
```

**Database Strategy**:
- Use `tm.events` table with `type='goal'`
- Store simple goals: `{ type: 'goal', title: 'Launch MVP', meta: { category: 'goal' } }`
- Store complex goals: `{ type: 'goal', title: 'Launch MVP', meta: { category: 'goal', color: '#2563EB', progress: 0.5, tasks: [...], ... } }`
- Store initiatives: `{ type: 'goal', title: 'Q4 Strategy', meta: { category: 'initiative' } }`

**Data Sources**:
- `onboarding-store.ts` → Initial goals/initiatives
- `goals-store.ts` → Complex goals with tasks, progress, colors
- `initiatives-store.ts` → Initiatives with milestones

**Effort**: 4-5 hours

---

#### 3. **Ideal Day Service** ⚠️ Needs Schema Clarification
**File**: `apps/mobile/src/lib/supabase/services/ideal-day.ts` (new file)

**Current Schema Issues**:
- `tm.ideal_day` table exists but missing:
  - `category_name` (text)
  - `color` (text)
  - `max_minutes` (integer)
  - `selected_days` (jsonb) for custom day types

**What to Build** (once schema is updated):
```typescript
export async function fetchIdealDay(userId: string, dayType: 'weekdays' | 'saturday' | 'sunday' | 'custom'): Promise<IdealDayCategory[]>
export async function saveIdealDayCategory(userId: string, dayType: string, category: IdealDayCategory): Promise<void>
export async function updateSelectedDays(userId: string, dayType: string, selectedDays: number[]): Promise<void>
```

**Data Source**: `ideal-day-store.ts`

**Action Required**: Ask team to add missing columns or clarify schema structure

**Effort**: 3-4 hours (after schema update)

---

### Phase 2: Data Synchronization (Medium Priority)

#### 4. **Store-to-Supabase Sync Layer** 🔨 Ready to Build
**File**: `apps/mobile/src/lib/supabase/services/sync.ts` (new file)

**Purpose**: Automatically sync local Zustand stores with Supabase on changes

**What to Build**:
```typescript
// Sync onboarding data to profiles + events
export async function syncOnboardingData(userId: string, onboardingData: OnboardingState): Promise<void>

// Sync goals store to events
export async function syncGoals(userId: string, goals: Goal[]): Promise<void>

// Sync profile values
export async function syncProfileValues(userId: string, values: string[]): Promise<void>

// Full sync (on app start or manual trigger)
export async function syncAllData(userId: string): Promise<void>
```

**Integration Points**:
- Hook into store updates (Zustand middleware or manual calls)
- Call on app start after auth initialization
- Call after onboarding completion

**Effort**: 6-8 hours

---

#### 5. **Supabase-to-Store Hydration** 🔨 Ready to Build
**File**: `apps/mobile/src/lib/supabase/services/hydrate.ts` (new file)

**Purpose**: Load data from Supabase into local stores on app start

**What to Build**:
```typescript
// Load profile data into onboarding store
export async function hydrateOnboardingStore(userId: string): Promise<void>

// Load goals into goals store
export async function hydrateGoalsStore(userId: string): Promise<void>

// Load profile values
export async function hydrateProfileValues(userId: string): Promise<string[]>

// Full hydration (call after auth init)
export async function hydrateAllStores(userId: string): Promise<void>
```

**Integration Point**: Call in `_layout.tsx` after auth initialization

**Effort**: 4-5 hours

---

### Phase 3: Real-Time Features (Lower Priority)

#### 6. **Real-Time Subscriptions** 📡 Ready to Build
**File**: `apps/mobile/src/lib/supabase/services/realtime.ts` (new file)

**What to Build**:
```typescript
// Subscribe to profile changes
export function subscribeToProfile(userId: string, callback: (profile: Profile) => void): () => void

// Subscribe to goals/events changes
export function subscribeToGoals(userId: string, callback: (goals: Goal[]) => void): () => void

// Subscribe to profile values changes
export function subscribeToProfileValues(userId: string, callback: (values: string[]) => void): () => void
```

**Use Cases**:
- Multi-device sync
- Collaborative features (future)
- Live updates from webhooks

**Effort**: 3-4 hours

---

### Phase 4: Advanced Features (Future)

#### 7. **Storage Integration** 📦
**Purpose**: Store user-uploaded files (profile photos, documents)

**What to Build**:
```typescript
export async function uploadProfilePhoto(userId: string, file: File): Promise<string>
export async function getProfilePhotoUrl(userId: string): Promise<string | null>
export async function deleteProfilePhoto(userId: string): Promise<void>
```

**Effort**: 2-3 hours

---

#### 8. **Database Triggers** ⚡
**Purpose**: Auto-create profile on user signup

**What to Build** (SQL migration):
```sql
-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION tm.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tm.profiles (user_id, timezone)
  VALUES (NEW.id, 'UTC');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION tm.handle_new_user();
```

**Effort**: 1 hour

---

#### 9. **Offline-First Patterns** 📴
**Purpose**: Queue writes when offline, sync when online

**What to Build**:
```typescript
// Queue operations when offline
export async function queueOperation(operation: SyncOperation): Promise<void>

// Process queue when online
export async function processSyncQueue(userId: string): Promise<void>

// Check online status
export function isOnline(): boolean
```

**Effort**: 8-10 hours

---

#### 10. **Analytics & Telemetry** 📊
**Purpose**: Track user actions, feature usage

**What to Build**:
```typescript
export async function trackEvent(userId: string, event: string, properties?: Record<string, unknown>): Promise<void>
export async function trackScreenView(userId: string, screen: string): Promise<void>
```

**Database**: Create `tm.analytics_events` table

**Effort**: 3-4 hours

---

## Implementation Priority Matrix

| Feature | Priority | Effort | Dependencies | Status |
|---------|----------|--------|--------------|--------|
| Expanded Profiles Service | High | 2-3h | None | Ready |
| Events Service | High | 4-5h | None | Ready |
| Store-to-Supabase Sync | High | 6-8h | Profiles + Events services | Ready |
| Supabase-to-Store Hydration | High | 4-5h | Profiles + Events services | Ready |
| Ideal Day Service | Medium | 3-4h | Schema update needed | Blocked |
| Real-Time Subscriptions | Medium | 3-4h | None | Ready |
| Storage Integration | Low | 2-3h | None | Ready |
| Database Triggers | Low | 1h | None | Ready |
| Offline-First Patterns | Low | 8-10h | Sync layer | Future |
| Analytics | Low | 3-4h | None | Ready |

---

## Recommended Implementation Order

### Week 1: Core Data Services
1. ✅ **Expanded Profiles Service** (2-3h)
2. ✅ **Events Service** (4-5h)
3. ✅ **Test both services** (2h)

### Week 2: Data Sync
4. ✅ **Store-to-Supabase Sync** (6-8h)
5. ✅ **Supabase-to-Store Hydration** (4-5h)
6. ✅ **Integration testing** (3h)

### Week 3: Polish & Real-Time
7. ✅ **Real-Time Subscriptions** (3-4h)
8. ✅ **Database Triggers** (1h)
9. ✅ **Bug fixes & optimization** (4h)

### Future: Advanced Features
10. ⏳ **Ideal Day Service** (after schema update)
11. ⏳ **Storage Integration** (when needed)
12. ⏳ **Offline-First Patterns** (when needed)
13. ⏳ **Analytics** (when needed)

---

## Code Patterns to Follow

### Service Layer Pattern
```typescript
// apps/mobile/src/lib/supabase/services/[feature].ts
import { supabase } from '../client';
import type { Database } from '../database.types';

// Always use tm schema explicitly
const fromTable = (table: string) => supabase.schema('tm').from(table);

export async function fetchFeature(userId: string) {
  const { data, error } = await fromTable('table_name')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
}
```

### Store Integration Pattern
```typescript
// In store file, add sync method
import { syncGoals } from '@/lib/supabase/services/events';

// After state update, sync to Supabase
updateGoal: (id, updates) => {
  set((state) => {
    const newState = { /* ... */ };
    // Sync to Supabase (fire and forget)
    syncGoals(userId, newState.goals).catch(console.error);
    return newState;
  });
}
```

---

## Testing Strategy

1. **Unit Tests**: Test each service function in isolation
2. **Integration Tests**: Test store ↔ Supabase sync
3. **E2E Tests**: Test full user flows (signup → onboarding → data sync)
4. **Manual Testing**: Use `verifyAuthAndData()` helper

---

## Questions for Team

1. **Ideal Day Schema**: What's the structure of `category_id`? Do we need to add columns for category metadata?
2. **Profile Role**: Can you add `role TEXT` column to `tm.profiles`?
3. **Schema Exposure**: Can you expose `tm` schema in API settings?
4. **Profile Values Table**: Can you create `profile_values` table in `tm` schema? (DDL provided in `docs/profile-values-table-ddl.sql`)

---

## Next Steps

1. **Review this roadmap** with team
2. **Prioritize features** based on product needs
3. **Start with Phase 1** (Profiles + Events services)
4. **Test incrementally** as each service is built
5. **Deploy to production** once core sync is working

---

## Resources

- **Supabase Integration Docs**: `docs/supabase-integration.md`
- **Schema Analysis**: `docs/supabase-schema-analysis.md`
- **Integration Plan**: `docs/supabase-tm-schema-integration-plan.md`
- **Profile Values DDL**: `docs/profile-values-table-ddl.sql`
- **Supabase Dashboard**: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk


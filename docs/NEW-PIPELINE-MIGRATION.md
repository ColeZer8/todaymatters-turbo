# New Pipeline Migration Plan

> **Goal:** Replace the messy 73-event chaos with clean hourly summaries.

## Overview

The current pipeline writes granular events to `tm.events`, resulting in:
- Duplicate events (41 duplicates for 18 hours of data)
- "Unknown Location" everywhere (no place inference)
- Individual 1-3 second app sessions cluttering the timeline
- Low confidence scores (20-50%)

The new pipeline writes to separate tables:
- `tm.activity_segments` (BRAVO layer) — Granular activity detection
- `tm.hourly_summaries` (CHARLIE layer) — Clean user-facing summaries
- `tm.activity_feedback` — User corrections for learning

---

## Phase 1: Run Both Pipelines in Parallel ✅

**Status:** IMPLEMENTED

**What we did:**
1. Added import for `processHourlySummary` in `use-actual-ingestion.ts`
2. Added call to generate hourly summary after window locking
3. New pipeline runs alongside existing pipeline (non-blocking)

**Code location:**
```
apps/mobile/src/lib/supabase/hooks/use-actual-ingestion.ts
```

**What happens now:**
- Every 30-minute window processing also generates an hourly summary
- Writes to `tm.hourly_summaries` (new table)
- Does NOT touch `tm.events` (existing data unchanged)
- Failures are non-fatal (logged but don't break existing flow)

**To verify it's working:**
```sql
-- Check if hourly summaries are being created
SELECT 
  hour_start AT TIME ZONE 'America/Chicago' as hour_cst,
  title,
  primary_activity,
  confidence_score,
  total_screen_minutes
FROM tm.hourly_summaries
WHERE user_id = 'YOUR_USER_ID'
ORDER BY hour_start DESC
LIMIT 10;
```

---

## Phase 2: Update UI to Read from New Tables

**Status:** ✅ TEST SCREEN READY

**What to do:**

### Test Screen (Available Now!)

Navigate to `/dev/pipeline-test` in the app to see the new pipeline data:

```
apps/mobile/src/app/dev/pipeline-test.tsx
```

Features:
- Shows hourly summaries from tm.hourly_summaries
- Date navigation (swipe between days)
- Pull to refresh
- Feedback buttons (accurate / needs correction)
- Compare side-by-side with main calendar

### 2a. Create a feature flag
```typescript
// In app config or user settings
const USE_NEW_PIPELINE = true; // or per-user setting
```

### 2b. Create new data fetching hook
```typescript
// New hook: useHourlySummaries.ts
import { fetchHourlySummariesForDate } from '@/lib/supabase/services';

export function useHourlySummaries(date: string) {
  const [summaries, setSummaries] = useState<HourlySummary[]>([]);
  
  useEffect(() => {
    fetchHourlySummariesForDate(userId, date).then(setSummaries);
  }, [date, userId]);
  
  return summaries;
}
```

### 2c. Update timeline component
```typescript
// In your day view / timeline component
const events = USE_NEW_PIPELINE 
  ? await fetchHourlySummariesForDate(userId, date)
  : await fetchEventsForDate(userId, date);
```

### 2d. Map HourlySummary to existing UI components
```typescript
// HourlySummary → Your existing event card format
function summaryToEventCard(summary: HourlySummary) {
  return {
    id: summary.id,
    title: summary.title,
    startTime: summary.hourStart,
    endTime: new Date(summary.hourStart.getTime() + 3600000), // +1 hour
    category: summary.primaryActivity,
    confidence: summary.confidenceScore,
    apps: summary.appBreakdown,
  };
}
```

---

## Phase 3: Add User Feedback UI

**Status:** NOT STARTED

**What to do:**

### 3a. Add feedback buttons to hourly cards
```typescript
// On each hourly summary card
<FeedbackButtons
  onAccurate={() => submitFeedback(summaryId, 'accurate')}
  onInaccurate={() => submitFeedback(summaryId, 'inaccurate')}
  onEdit={() => openEditModal(summary)}
/>
```

### 3b. Implement feedback submission
```typescript
import { 
  submitAccurateFeedback, 
  submitInaccurateFeedback,
  submitCorrectedFeedback 
} from '@/lib/supabase/services/activity-feedback';

// User says it's accurate
await submitAccurateFeedback(userId, summaryId);

// User says it's wrong
await submitInaccurateFeedback(userId, summaryId, 'wrong_activity');

// User corrects it
await submitCorrectedFeedback(userId, summaryId, {
  correctedActivity: 'deep_work',
  correctedPlaceLabel: 'Office',
});
```

### 3c. Lock summaries after feedback
When a user confirms or edits a summary, it becomes locked:
```typescript
await updateHourlySummary(summaryId, {
  lockedAt: new Date(),
  userFeedback: 'accurate',
});
```

Locked summaries won't be overwritten by re-processing.

---

## Phase 4: Deprecate Old Pipeline

**Status:** NOT STARTED

**Prerequisites:**
- [ ] Phase 2 complete (UI reads from new tables)
- [ ] Phase 3 complete (user feedback working)
- [ ] 2+ weeks of parallel running without issues
- [ ] User feedback shows new pipeline is more accurate

**What to do:**

### 4a. Stop writing granular events
```typescript
// In processActualIngestionWindow, comment out or remove:
// - screenTimeEvents creation
// - locationEvents creation  
// - Reconciliation to tm.events
// - Session block insertion to tm.events
```

### 4b. Clean up duplicate events (optional)
```sql
-- Delete duplicate events, keeping only the first occurrence
DELETE FROM tm.events a
USING tm.events b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.scheduled_start = b.scheduled_start
  AND a.meta->>'source_id' = b.meta->>'source_id';
```

### 4c. Archive or delete old event data (optional)
```sql
-- Archive old events to a backup table
CREATE TABLE tm.events_archive AS 
SELECT * FROM tm.events 
WHERE type = 'calendar_actual';

-- Then delete from main table
DELETE FROM tm.events WHERE type = 'calendar_actual';
```

---

## Database Tables

### tm.activity_segments (BRAVO layer)
Internal working table for granular activity detection.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| started_at | timestamptz | Segment start |
| ended_at | timestamptz | Segment end |
| place_id | uuid | Matched place (nullable) |
| place_label | text | Place name |
| inferred_activity | text | deep_work, leisure, etc. |
| activity_confidence | numeric | 0.00 - 1.00 |
| top_apps | jsonb | [{appId, displayName, category, seconds}] |
| evidence | jsonb | {locationSamples, screenSessions, ...} |

### tm.hourly_summaries (CHARLIE layer)
User-facing hourly summaries.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| hour_start | timestamptz | Start of hour |
| local_date | date | YYYY-MM-DD for easy queries |
| title | text | "Home - Deep Work" |
| description | text | AI or template generated |
| primary_place_id | uuid | Main place for this hour |
| primary_place_label | text | Place name |
| primary_activity | text | Dominant activity |
| app_breakdown | jsonb | [{appId, displayName, minutes}] |
| total_screen_minutes | int | Total screen time |
| confidence_score | numeric | 0.00 - 1.00 |
| evidence_strength | text | low, medium, high |
| user_feedback | text | accurate, inaccurate, null |
| locked_at | timestamptz | When user confirmed/edited |

### tm.activity_feedback
User corrections for learning.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| segment_id | uuid | Related segment (nullable) |
| summary_id | uuid | Related summary (nullable) |
| feedback_type | text | accurate, inaccurate, corrected |
| original_activity | text | What pipeline guessed |
| corrected_activity | text | What user said it was |
| original_place_label | text | Original place |
| corrected_place_label | text | User's correction |
| context | jsonb | Additional context |

---

## Timeline

| Phase | Status | ETA |
|-------|--------|-----|
| Phase 1: Parallel pipelines | ✅ Done | Today |
| Phase 2: UI integration | 🔲 Not started | 1-2 days |
| Phase 3: Feedback UI | 🔲 Not started | 2-3 days |
| Phase 4: Deprecate old | 🔲 Not started | 2+ weeks |

---

## Rollback Plan

If something goes wrong:

1. **Phase 1 issues:** The new pipeline is non-blocking. Just remove the `processHourlySummary` call to disable it.

2. **Phase 2 issues:** Feature flag allows instant rollback to old data source.

3. **Phase 3 issues:** Feedback is optional; disable the UI buttons.

4. **Phase 4 issues:** Don't do Phase 4 until confident. Keep old data as backup.

---

## Files Changed

### Phase 1
- `apps/mobile/src/lib/supabase/hooks/use-actual-ingestion.ts` — Added import + call to processHourlySummary

### Created Previously
- `supabase/migrations/20260201_create_tm_activity_segments.sql`
- `supabase/migrations/20260201_create_tm_hourly_summaries.sql`
- `supabase/migrations/20260201_create_tm_activity_feedback.sql`
- `apps/mobile/src/lib/supabase/services/activity-segments.ts`
- `apps/mobile/src/lib/supabase/services/hourly-summaries.ts`
- `apps/mobile/src/lib/supabase/services/activity-feedback.ts`

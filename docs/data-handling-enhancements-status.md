 # Data Handling Enhancements — Current Status
 
 **Date:** 2026-01-19  
 **Scope:** Implementation status vs `docs/data-handling-enhancements-proposal.md`
 
 ---
 
## Overall Status

- Phase 1 (Foundation): **In progress, mostly implemented**
- Phase 2 (Intelligence): **In progress**
- Phase 3 (Polish): **Partially implemented**

---

## Current Pipeline (Deep Dive)

**1) Evidence ingestion**
- Supabase evidence bundle via `fetchAllEvidenceForDay`: location hourly, screen time sessions, health workouts, health daily.
- Local/device screen time summaries (`usageSummary`) feed gap filling + sleep heuristics.

**2) Verification + evidence blocks**
- `useVerification` calls `verifyPlannedEvents` to score planned events against evidence rules.
- `generateActualBlocks` creates standalone evidence blocks for location, workouts, and unplanned screen time (>=10 min).
- Location blocks merge hourly samples by place and emit when no planned event overlaps.
- Workout blocks emit when no planned health event covers the workout window.
- Screen time blocks merge sessions within 15 min, skip planned digital/comm events, then classify apps.

**3) Display assembly**
- `buildActualDisplayEvents` merges: actual events, derived actuals, evidence blocks, usage summary blocks.
- Derived events are tagged with `DERIVED_ACTUAL_PREFIX` / `DERIVED_EVIDENCE_PREFIX` and are display-only unless saved.
- iOS Screen Time summaries run `deriveActualEventsFromScreenTime`, producing `st_*` blocks and annotations.

**4) Gap filling order (unknown blocks)**
1. `replaceUnknownWithSleepSchedule` (planned sleep windows + interruptions)
2. `replaceUnknownWithProductiveUsage` (productive screen time)
3. `replaceUnknownWithTransitions` (commute)
4. `replaceUnknownWithPrepWindDown` (prep heuristic)
5. `applyPatternSuggestions` (14-day pattern index, 30-min slots, >=0.6 confidence)
6. `attachDataQuality` + `mergeAdjacentSleep`

**5) Persistence + learning**
- Evidence blocks are persisted to `tm.events` via `syncActualEvidenceBlocks` with `meta.source_id` + `kind: evidence_block`.
- When users adjust derived events, `learnedFrom` metadata is attached for future learning.

---

## Key Heuristics & Thresholds

- Evidence blocks: minimum 10 minutes (`MIN_EVIDENCE_BLOCK_MINUTES`).
- Sleep late start: screen time >=10 min and within 120 min of planned start; remaining sleep must be >=30 min.
- Sleep override: screen time covers >=70% of the sleep window or >=60 min.
- Screen time grouping: 15 min gap threshold between sessions.
- Commute transitions: unknown gaps 15–90 min + location change.
- Prep heuristic: unknown gaps 10–45 min between same-category events (work/health/meeting).
- Pattern slots: 30-minute buckets; min confidence 0.6.
- App overrides apply at >=0.6 confidence; repeated corrections raise confidence and conflicting corrections can flip the category.
- User preferences adjust pattern confidence (aggressive lowers, conservative raises) and can disable auto-suggestions entirely; manual mode disables non-sleep gap fills.

---

## Implemented (Detailed)
 
 ### 1) Enhanced Sleep Analysis
 
 **Status:** Implemented core metrics + dynamic descriptions
 
 **What’s implemented**
- Dynamic sleep interruption descriptions based on usage sessions.
- Sleep quality metrics derived from `tm.health_daily_metrics`:
  - `sleep_asleep_seconds` → `asleepMinutes`
  - `hrv_sdnn_seconds` → `hrvMs`
  - `resting_heart_rate_avg_bpm`
  - `heart_rate_avg_bpm`
  - Composite `qualityScore`
- Sleep late-start adjustments for planned sleep using device usage sessions.
- Sleep schedule overrides when phone use dominates a planned sleep block.
- Sleep interruption detection uses:
  - Supabase `screen_time_app_sessions` first
  - Android `usageSummary` as fallback
- Sleep events carry `meta.evidence.sleep.*` values.
 
 **Where**
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 - `apps/mobile/src/lib/calendar/sleep-analysis.ts`
 - `apps/mobile/src/lib/supabase/services/evidence-data.ts` (supabase sources)
 
 **Open**
 - Deep/REM sleep not yet used (no table/fields in `tm.health_daily_metrics`).
 - Wake time detection not yet implemented.
 
 ---
 
 ### 2) Advanced App Classification
 
 **Status:** Partially implemented (classification centralized; user-defined categories not yet)
 
 **What’s implemented**
- Centralized app classification (`Doom Scroll`, `Productive Screen Time`, `Screen Time`) with confidence.
- Shared logic used across display + verification.
- Classification uses static `DISTRACTION_APPS`, `WORK_APPS`, and `PRODUCTIVE_APPS` lists.
- User recategorizations update per-app overrides (`tm.user_app_categories`) with confidence scoring.
 
 **Where**
 - `apps/mobile/src/lib/calendar/app-classification.ts`
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 - `apps/mobile/src/lib/calendar/verification-engine.ts`
 
 **Open**
- User-defined app categories and context-aware rules (time/location) not implemented yet.
- App intensity scoring not implemented yet.
- No UI to review/edit learned app overrides yet (only implicit learning via adjustments).
 
 ---
 
 ### 3) Gap Filling Intelligence
 
 **Status:** Implemented (pattern + productive fill + transitions)
 
 **What’s implemented**
- Existing productive usage fill for unknown blocks.
- Pattern-based gap suggestions from recent actual history (14-day window).
- Gap suggestions stored as `meta.kind: 'pattern_gap'` with confidence.
- Pattern summary metadata attached to planned→actual derived events.
 
 **Where**
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 - `apps/mobile/src/lib/calendar/pattern-recognition.ts`
 - `apps/mobile/src/app/comprehensive-calendar.tsx` (loads history and builds pattern index)
 - `apps/mobile/src/lib/supabase/services/calendar-events.ts` (range fetch)
 - `apps/mobile/src/lib/supabase/hooks/use-calendar-events-sync.ts` (range loader)
 
 **Open**
 - Persistence of learned patterns (table `tm.activity_patterns`) not implemented.
 
 ---
 
 ### 4) Activity Transition Detection
 
 **Status:** Implemented (commute + prep/wind-down heuristics)
 
 **What’s implemented**
 - Commute detection for unknown gaps when location changes (15–90 min).
 - Prep/wind-down detection for short unknown gaps (10–45 min) between same-category events.
 - Adds derived blocks with `meta.kind: 'transition_commute'`, `transition_prep`, `transition_wind_down`.
 
**Where**
- `apps/mobile/src/lib/calendar/actual-display-events.ts`
- `apps/mobile/src/stores/events-store.ts` (kind types)

**Open**
- Current prep/wind-down logic always labels "Prep" when same-category events are adjacent; `transition_wind_down` is not produced yet.

---
 
### 5) Multi-Source Evidence Fusion

**Status:** Implemented (weighted fusion + conflict resolutions)
 
**What’s implemented**
- Conflict detection in derived planned→actual events:
  - Distraction apps during work
  - Phone use during sleep
  - Low sleep quality before work
  - Location mismatch vs plan
  - Pattern deviation (typical category differs)
- Stored in `meta.evidence.conflicts[]`.
- Conflicts are flags only; they do not alter category selection.
- Fused confidence + source weighting stored in `meta.evidenceFusion` with per-conflict resolutions.
 
**Where**
- `apps/mobile/src/lib/calendar/actual-display-events.ts`
- `apps/mobile/src/lib/calendar/evidence-fusion.ts`
- `apps/mobile/src/stores/events-store.ts`
 
**Open**
- Conflict resolutions are heuristic; no user-tunable weights yet.
 
 ---
 
### 6) Behavioral Pattern Recognition
 
 **Status:** Partially implemented
 
**What’s implemented**
- Pattern index from historical actuals.
- Pattern-based gap suggestions.
- Pattern summary metadata attached to derived planned→actual events.
- Deviation flagged when typical category differs at >=0.6 confidence.
- Corrected events (`meta.learnedFrom`) receive extra weight in pattern learning.
- Daily anomaly detection from pattern deviations.
- Pattern predictions for upcoming days (used in Pattern Insights screen).
 
 **Where**
 - `apps/mobile/src/lib/calendar/pattern-recognition.ts`
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 
**Open**
- Predictive suggestions are not yet injected into planned event creation.
 
 ---
 
### 7) Enhanced Verification & Confidence
 
 **Status:** Partially implemented
 
**What’s implemented**
- New verification statuses: `mostly_verified`, `partially_verified`, `early`, `late`, `shortened`, `extended`.
- Timing heuristics based on location overlap.
- Day summary counts map new statuses to verified/partial without UI change.
- Verification scoring uses rule weights with evidence summaries for location/screen time/workouts.
- Detailed verification report object attached to derived events.
 
 **Where**
 - `apps/mobile/src/lib/calendar/verification-engine.ts`
 - `apps/mobile/src/lib/calendar/use-verification.ts`
 
**Open**
- Verification learning and personalized thresholds not implemented.
 
 ---
 
 ### 8) Real-Time Event Updates
 
 **Status:** Not implemented
 
 **Notes**
 - No live tracking or notifications yet.
 - Calendar screen does periodic refresh (5 min) while visible, but this is not real-time evidence fusion.
 - Preferences UI includes real-time toggle but it is not wired to notifications yet.
 
 ---
 
 ### 9) Data Quality & Reliability
 
 **Status:** Implemented (basic metrics + surfaced in Actual Adjust drawer)
 
 **What’s implemented**
 - Data quality metrics:
   - Freshness (minutes since latest evidence)
   - Completeness (presence of sources)
   - Reliability (derived from completeness)
   - Sources list
 - Attached to `meta.dataQuality` for derived events.
 - Displayed in Actual Adjust dropdown only.
 
 **Where**
 - `apps/mobile/src/lib/calendar/data-quality.ts`
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 - `apps/mobile/src/app/actual-adjust.tsx`
 - `apps/mobile/src/stores/events-store.ts`
 
---

### 10) User Personalization

**Status:** Partially implemented (app overrides + preferences)

**Notes**
- Preferences table stores gap filling + confidence thresholds.
- Personalization screen added (gap fill mode, confidence threshold, suggestion + alerts toggles).
- No UI for managing app overrides yet (only implicit learning via adjustments).
 
 ---
 
## UI Changes (Additive)

**Calendar UI:** unchanged.  
**Actual Adjust screen:** added an expandable “Why we marked this” panel at the bottom.
**Personalization screen:** new screen to manage gap-filling + confidence thresholds.
**Pattern Insights screen:** new screen to review anomalies + predictions.
 
 **Details shown when expanded:**
 - Confidence
 - Source/kind
 - Screen time minutes + top app
 - Sleep interruption counts and sleep quality metrics
 - Conflicts
 - Data quality metrics
 
 **Where**
 - `apps/mobile/src/components/templates/ActualAdjustTemplate.tsx`
 - `apps/mobile/src/app/actual-adjust.tsx`
 - `apps/mobile/src/components/templates/PersonalizationTemplate.tsx`
 - `apps/mobile/src/app/Personalization.tsx`
 - `apps/mobile/src/components/templates/PatternInsightsTemplate.tsx`
 - `apps/mobile/src/app/PatternInsights.tsx`
 
 ---
 
 ## New/Updated Data Fields (Meta)
 
 **`CalendarEventMeta` additions**
 - `kind`: added `pattern_gap`, `transition_commute`, `transition_prep`, `transition_wind_down`, `evidence_block`
 - `evidence.sleep`: HRV, resting HR, avg HR, quality score
 - `evidence.conflicts`: conflict list
 - `evidenceFusion`: fused confidence, source weights, conflict resolutions
 - `dataQuality`: freshness/completeness/reliability/sources
 - `patternSummary`: confidence/sampleCount/typicalCategory/deviation
 - `learnedFrom`: original event metadata when user adjusts a derived event
 - `verificationReport`: evidence breakdown + discrepancies summary
 
 **Where**
 - `apps/mobile/src/stores/events-store.ts`
 
 ---
 
 ## Supabase Alignment
 
**Referenced migration**
- `supabase/migrations/20250105_comprehensive_tm_schema_fixes_and_health_screentime.sql`
- `supabase/migrations/20260119_user_app_categories_learning.sql`
- `supabase/migrations/20260119_user_data_preferences.sql`
 
**Used data sources**
- `tm.screen_time_app_sessions` → `EvidenceBundle.screenTimeSessions`
- `tm.health_daily_metrics` → `EvidenceBundle.healthDaily`
- `tm.health_workouts` → `EvidenceBundle.healthWorkouts`
- `tm.location_hourly` → `EvidenceBundle.locationHourly`
- `tm.events` (`calendar_actual`) for historical pattern learning + evidence block sync
- `tm.user_app_categories` for per-app overrides
- `tm.user_data_preferences` for gap-filling preferences
 
**Where**
- `apps/mobile/src/lib/supabase/services/evidence-data.ts`
- `apps/mobile/src/lib/supabase/services/calendar-events.ts`
- `apps/mobile/src/lib/supabase/services/actual-evidence-events.ts`
- `apps/mobile/src/lib/supabase/services/user-app-categories.ts`
- `apps/mobile/src/lib/supabase/services/user-preferences.ts`
 
 ---
 
 ## Remaining Work (Next)
 
**Phase 2 (Intelligence)**
- Store learned patterns in a table (`tm.activity_patterns`) if desired.
 - Evidence fusion weighting tuning + user-visible resolutions.
 - Predictive suggestions tied into planned event creation.
 
**Phase 3 (Polish)**
- User personalization:
  - app override management UI
  - sleep preferences + notification tuning
- Real-time updates + notifications
- Rich verification reports (detailed breakdowns/suggestions)
 
 ---
 
 ## Files Changed (High-Level)
 
 - `apps/mobile/src/lib/calendar/actual-display-events.ts`
 - `apps/mobile/src/lib/calendar/pattern-recognition.ts`
 - `apps/mobile/src/lib/calendar/sleep-analysis.ts`
 - `apps/mobile/src/lib/calendar/data-quality.ts`
 - `apps/mobile/src/lib/calendar/verification-engine.ts`
 - `apps/mobile/src/lib/calendar/use-verification.ts`
 - `apps/mobile/src/lib/calendar/app-classification.ts`
 - `apps/mobile/src/lib/calendar/derive-screen-time-actual-events.ts`
 - `apps/mobile/src/lib/calendar/evidence-fusion.ts`
 - `apps/mobile/src/app/comprehensive-calendar.tsx`
 - `apps/mobile/src/app/PatternInsights.tsx`
 - `apps/mobile/src/app/Personalization.tsx`
 - `apps/mobile/src/app/actual-adjust.tsx`
 - `apps/mobile/src/components/templates/ActualAdjustTemplate.tsx`
 - `apps/mobile/src/components/templates/PersonalizationTemplate.tsx`
 - `apps/mobile/src/components/templates/PatternInsightsTemplate.tsx`
 - `apps/mobile/src/stores/app-category-overrides-store.ts`
 - `apps/mobile/src/stores/events-store.ts`
 - `apps/mobile/src/stores/user-preferences-store.ts`
 - `apps/mobile/src/lib/supabase/services/calendar-events.ts`
 - `apps/mobile/src/lib/supabase/services/actual-evidence-events.ts`
 - `apps/mobile/src/lib/supabase/services/user-app-categories.ts`
 - `apps/mobile/src/lib/supabase/services/user-preferences.ts`
 - `apps/mobile/src/lib/supabase/hooks/use-calendar-events-sync.ts`
 - `plan_and_progress/2026-01-19-comprehensive-data-handling.md`
 - `supabase/migrations/20260119_user_app_categories_learning.sql`
 - `supabase/migrations/20260119_user_data_preferences.sql`

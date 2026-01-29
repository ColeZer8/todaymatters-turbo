# PRD: Location-Informed Actual Ingestion with Sessionization

## Introduction

A complete overhaul of the actual calendar ingestion system that solves the "moving calendar" problem, adds location evidence, and creates human-readable place-anchored session blocks. The current system suffers from events shifting times, disappearing/reappearing, duplicates, wrong app names, wrong durations, excessive "Unknown" blocks, and events at wrong times. This PRD addresses all of these issues through architectural changes to event immutability, location-based evidence, and a sessionization layer.

**Core Insight:** Users remember their day as place-anchored sessions ("I worked at the cafe for an hour, then commuted to the office"), not as app-by-app switches. The actual calendar should reflect this.

**Reference Document:** `/docs/location-ingestion-simulation.md`

---

## Goals

- **Fix the "moving calendar"** — Events become immutable once written; no re-processing of past windows
- **Reduce Unknown blocks** — Location evidence fills gaps that currently show as "Unknown"
- **Human-readable timeline** — Collapse granular app switches into place-anchored session blocks
- **Accurate intent classification** — Categorize sessions as Work, Leisure, or Distracted Work
- **User control** — Allow split/merge of sessions, place labeling, app category overrides
- **Deterministic & stable** — Same evidence always produces the same result

---

## Architecture Overview

### Current System (Problems)
```
Screen-time sessions → Clip to 30-min window → Reconcile (delete + insert) → Gap fill with Unknown
                                                      ↑
                                            Can re-process past windows
                                            Events shift/disappear/duplicate
```

### New System (Solution)
```
Screen-time + Location → Clip to 30-min window → Immutable write (extend only) → Sessionize
                                                          ↑
                                               Past windows LOCKED
                                               Only extend trailing edge of most recent event
```

---

## User Stories

### US-001: Implement Event Immutability
**Description:** As a user, I want my actual events to stay stable so the calendar doesn't "move around" when I reopen the app.

**Acceptance Criteria:**
- [ ] Once a 30-min window is processed, events in that window are **locked/immutable**
- [ ] No re-processing of past windows (only current and future windows processed)
- [ ] Only the trailing edge of the most recent event can be extended into the next window
- [ ] Add `locked_at` timestamp to events to mark when they became immutable
- [ ] Reconciliation logic updated: skip any event with `locked_at` set
- [ ] Typecheck/lint passes
- [ ] Unit tests cover: locked events not modified, trailing edge extension works

### US-002: Trailing Edge Extension Logic
**Description:** As a user, I want continuous activities (like a long Slack session or staying at the office) to show as one block, not fragmented across windows.

**Acceptance Criteria:**
- [ ] When processing window N, check if the most recent event from window N-1 continues
- [ ] For screen-time: same `app_id` with session starting within 60s of previous event's end
- [ ] For location: same `place_id` continuing into new window
- [ ] If continuing, extend `scheduled_end` of existing event instead of creating new one
- [ ] Extension only allowed for the single most recent event per evidence type
- [ ] Typecheck/lint passes
- [ ] Unit tests cover: extension works, non-continuous creates new event

### US-003: Fetch Location Evidence for Window
**Description:** As a developer, I need to retrieve location data for the ingestion window to create place blocks.

**Acceptance Criteria:**
- [ ] New function `fetchLocationEvidenceForWindow(userId, windowStart, windowEnd)`
- [ ] Queries `tm.location_samples` for raw GPS points in window
- [ ] Queries `tm.location_hourly` for aggregated place data
- [ ] Queries `tm.user_places` to match coordinates to labeled places
- [ ] Returns array of location segments with: `start`, `end`, `place_id`, `place_label`, `confidence`
- [ ] Typecheck/lint passes

### US-004: Generate Location Segments
**Description:** As a developer, I need to convert raw location data into contiguous place blocks.

**Acceptance Criteria:**
- [ ] Group location samples by place (using `user_places` radius matching)
- [ ] Create contiguous blocks where 70%+ of samples match a single place
- [ ] Detect commute: rapid coordinate change with no stable place for ≥10 minutes
- [ ] Commutes <10 min become annotation metadata, not blocks
- [ ] For unrecognized places: attempt Google Places lookup, else use "Near [City/Area]"
- [ ] Each segment has deterministic `source_id`: `location:{windowStartMs}:{placeId}:{segmentStartMs}`
- [ ] Typecheck/lint passes

### US-005: Integrate Location into Reconciliation
**Description:** As a developer, I need to combine screen-time and location evidence in the reconciliation pipeline.

**Acceptance Criteria:**
- [ ] Reconciliation priority order: Protected > Screen-time > Location > Unknown
- [ ] Screen-time evidence takes precedence (more specific than location)
- [ ] Location blocks fill gaps between screen-time events
- [ ] When screen-time occurs during detected commute: show both (commute block with app annotation)
- [ ] Location blocks use `meta.source = "ingestion"`, `meta.kind = "location_block"`
- [ ] Typecheck/lint passes

### US-006: Create Session Block Schema
**Description:** As a developer, I need a database structure to store sessionized blocks that the UI reads by default.

**Acceptance Criteria:**
- [ ] Session blocks stored in `tm.events` with `meta.kind = "session_block"`
- [ ] Session block schema includes:
  - `title`: "Cafe — Work", "Office — Distracted Work", "Home — Sleep"
  - `meta.place_id`, `meta.place_label`
  - `meta.intent`: "work" | "leisure" | "distracted_work" | "sleep" | "commute"
  - `meta.summary`: array of `{ label: string, seconds: number }` (top 3 apps)
  - `meta.children`: array of child event IDs (granular events)
  - `meta.confidence`: number (location confidence)
- [ ] Child events retain their individual records but are hidden in default view
- [ ] Typecheck/lint passes

### US-007: Implement Sessionization Pass
**Description:** As a developer, I need a post-reconciliation step that collapses granular events into session blocks.

**Acceptance Criteria:**
- [ ] New function `sessionizeWindow(userId, windowStart, windowEnd)`
- [ ] Runs after reconciliation completes
- [ ] Groups events by location (place changes = session boundary)
- [ ] Merges micro-gaps <5 min into adjacent sessions
- [ ] Only creates session blocks ≥10 min duration
- [ ] Shorter sessions absorbed into neighbors
- [ ] Links child events via `meta.children` array
- [ ] Typecheck/lint passes

### US-008: Implement Intent Classification
**Description:** As a user, I want sessions labeled by what I was doing (Work, Leisure, Distracted Work) so I understand my day at a glance.

**Acceptance Criteria:**
- [ ] App category mapping: Work (Slack, Docs, Gmail, Meet, Calendar, Figma), Social (Instagram, TikTok, X, Reddit), Entertainment (YouTube, Netflix, Spotify), Comms (Messages, WhatsApp), Utility (Maps, Photos, Weather)
- [ ] Intent rules:
  - Work ≥60% of screen-time → "work"
  - Social + Entertainment ≥60% → "leisure"
  - Work 40-60% AND Social ≥25% → "distracted_work"
  - No screen-time → use place category ("At Office", "At Home")
- [ ] Store intent in `meta.intent`
- [ ] Typecheck/lint passes

### US-009: Handle Sleep Sessions
**Description:** As a user, I want overnight time at home shown as a "Sleep" block, with interruptions shown clearly.

**Acceptance Criteria:**
- [ ] Detect overnight gap at home (configurable via user's scheduled sleep time)
- [ ] Create "Home — Sleep" session block for sleep period
- [ ] If screen-time detected during scheduled sleep:
  - Split: Sleep → Screen-time (with "scheduled sleep" annotation) → Sleep resumes
- [ ] Screen-time block during sleep shows subtitle: "During scheduled sleep"
- [ ] Typecheck/lint passes

### US-010: Handle Commute Sessions
**Description:** As a user, I want my commutes shown appropriately based on duration.

**Acceptance Criteria:**
- [ ] Commutes ≥10 min: Create "Commute" session block with `meta.intent = "commute"`
- [ ] Commutes <10 min: No block created; add annotation to next session: "Traveled X min to [Place]"
- [ ] If screen-time during commute: Show both (Commute block contains app summary)
- [ ] Commute detection: location changing between places, speed/distance thresholds
- [ ] Typecheck/lint passes

### US-011: Display Session Blocks in UI
**Description:** As a user, I want to see my actual calendar as clean session blocks by default.

**Acceptance Criteria:**
- [ ] Default view shows session blocks only (not granular events)
- [ ] Session block display:
  - Title: "Cafe — Work"
  - Subtitle: "Chrome (8m), Docs (5m), Slack (4m)" (top 3 apps)
  - Icon: Location pin for place blocks, car/walking for commute
  - Color: Based on intent (work=blue, leisure=green, distracted=orange, sleep=purple)
- [ ] Granular timeline is future "zoom" feature (out of scope for this PRD)
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-012: Show Classification Reasoning on Tap
**Description:** As a user, I want to understand why a session was classified a certain way.

**Acceptance Criteria:**
- [ ] Tapping a session block shows detail view
- [ ] Detail view includes:
  - "Classified as Work because: Slack 45%, Docs 30%, Gmail 15%"
  - Breakdown of app usage within session
  - Location confidence indicator
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-013: User Can Split Session Blocks
**Description:** As a user, I want to split a session into two if it combined things I consider separate.

**Acceptance Criteria:**
- [ ] "Split" action available in session detail view
- [ ] User selects split point (time picker)
- [ ] Creates two new session blocks, original marked as replaced
- [ ] New blocks have `meta.source = "user"` (protected)
- [ ] Child events redistributed to appropriate new parent
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-014: User Can Merge Session Blocks
**Description:** As a user, I want to merge adjacent sessions if they represent one activity.

**Acceptance Criteria:**
- [ ] "Merge" action when viewing a session (shows mergeable neighbors)
- [ ] Creates single session block spanning both
- [ ] Recalculates intent based on combined app usage
- [ ] New block has `meta.source = "user"` (protected)
- [ ] Combined children from both original sessions
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-015: User Can Edit Places
**Description:** As a user, I want to label places so future visits are recognized automatically.

**Acceptance Criteria:**
- [ ] "Add Place" action when at unknown location
- [ ] User provides label (Home, Office, Gym, custom)
- [ ] Saves to `tm.user_places` with current coordinates and default 150m radius
- [ ] Future location samples within radius auto-match to this place
- [ ] Edit/delete existing places from settings
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-016: Google Places Auto-Suggest
**Description:** As a user, I want the app to suggest place names when I'm somewhere new.

**Acceptance Criteria:**
- [ ] When location doesn't match `user_places`, query Google Places API
- [ ] Show suggestion: "Are you at Starbucks?" with accept/reject
- [ ] If accepted, save to `user_places` with Google Place metadata
- [ ] If rejected, prompt for manual label or use "Near [Area]"
- [ ] Cache Google Places responses to reduce API calls
- [ ] Typecheck/lint passes

### US-017: App Category Overrides
**Description:** As a user, I want to recategorize apps if the defaults don't match my usage.

**Acceptance Criteria:**
- [ ] Settings screen: "App Categories"
- [ ] Shows apps used in last 30 days with current category
- [ ] User can change category: Work, Social, Entertainment, Comms, Utility, Ignore
- [ ] Overrides stored in `tm.user_app_categories` table
- [ ] Ingestion respects user overrides over hardcoded defaults
- [ ] Typecheck/lint passes
- [ ] Verify in browser/simulator

### US-018: Handle Location Permission Denied
**Description:** As a user, I want the app to work without location but remind me of the benefits.

**Acceptance Criteria:**
- [ ] If location permission denied: fall back to screen-time only ingestion
- [ ] Gaps filled with "Unknown" instead of place blocks
- [ ] Show periodic prompt (max 1x per week): "Enable location for better insights"
- [ ] Prompt explains value: "See where you spent your time"
- [ ] User can dismiss or go to settings
- [ ] Typecheck/lint passes

### US-019: Lock Windows After Processing
**Description:** As a developer, I need to mark windows as processed so they're never reprocessed.

**Acceptance Criteria:**
- [ ] New table `tm.actual_ingestion_window_locks`
  - `user_id`, `window_start`, `window_end`, `locked_at`, `stats` (jsonb)
- [ ] After successful window processing, insert lock record
- [ ] Before processing any window, check if lock exists; skip if locked
- [ ] Checkpoint table continues tracking "last processed" for scheduling
- [ ] Typecheck/lint passes

### US-020: Update Ingestion Hook for New Pipeline
**Description:** As a developer, I need the ingestion hook to use the new immutable pipeline.

**Acceptance Criteria:**
- [ ] `useActualIngestion` updated to:
  1. Check for next unprocessed window (not locked)
  2. Fetch screen-time + location evidence
  3. Run reconciliation with new priority order
  4. Run sessionization pass
  5. Lock the window
  6. Update checkpoint
- [ ] Graceful error handling (non-fatal, retry on next trigger)
- [ ] Typecheck/lint passes

---

## Functional Requirements

### Event Immutability
- **FR-1:** Events from processed windows are immutable; `locked_at` timestamp prevents modification
- **FR-2:** Only the trailing edge of the most recent event (screen-time or location) can be extended into the next window
- **FR-3:** Window locks prevent reprocessing; stored in `tm.actual_ingestion_window_locks`

### Evidence Sources
- **FR-4:** Screen-time evidence from `tm.screen_time_app_sessions` (existing)
- **FR-5:** Location evidence from `tm.location_samples` + `tm.location_hourly` + `tm.user_places`
- **FR-6:** Reconciliation priority: Protected > Screen-time > Location > Unknown

### Sessionization
- **FR-7:** Session blocks are place-anchored; location change = session boundary
- **FR-8:** Minimum session duration: 10 minutes (shorter absorbed into neighbors)
- **FR-9:** Micro-gaps <5 minutes merged into adjacent sessions
- **FR-10:** Session blocks stored with `meta.kind = "session_block"` and `meta.children` linking granular events

### Intent Classification
- **FR-11:** Apps categorized as Work, Social, Entertainment, Comms, Utility (hardcoded defaults)
- **FR-12:** Intent rules: Work ≥60% → "work", Social+Entertainment ≥60% → "leisure", Work 40-60% + Social ≥25% → "distracted_work"
- **FR-13:** Session summary shows top 3 apps by duration

### Commute Handling
- **FR-14:** Commutes ≥10 minutes shown as "Commute" session blocks
- **FR-15:** Commutes <10 minutes become annotations on the next session
- **FR-16:** Screen-time during commute: show Commute block with app summary inside

### Sleep Handling
- **FR-17:** Overnight gaps at home become "Home — Sleep" session blocks
- **FR-18:** Screen-time during scheduled sleep splits the sleep block
- **FR-19:** Interrupting screen-time shows "During scheduled sleep" annotation

### User Control
- **FR-20:** Users can split session blocks at any point
- **FR-21:** Users can merge adjacent session blocks
- **FR-22:** User-edited blocks become protected (`meta.source = "user"`)
- **FR-23:** Users can add/edit places in `tm.user_places`
- **FR-24:** Users can override app categories

### Location Fallback
- **FR-25:** Location permission denied: fall back to screen-time only + periodic prompt
- **FR-26:** Low-confidence location: use fuzzy label "Near [City/Area]"
- **FR-27:** Unknown place: auto-suggest from Google Places

---

## Non-Goals (Out of Scope)

- **Granular timeline zoom view** — Future feature; this PRD only implements collapsed session view
- **iOS screen-time ingestion** — Android first; iOS to be added later
- **Backfilling historical data** — New data only; existing events unchanged
- **Push notifications for place labels** — Only in-app prompts
- **Automatic sleep detection** — Relies on user's scheduled sleep time
- **Multi-device location merging** — Single device location source
- **Offline-first location processing** — Requires connectivity for Google Places

---

## Technical Considerations

### Database Schema Changes

**New table: `tm.actual_ingestion_window_locks`**
```sql
CREATE TABLE tm.actual_ingestion_window_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  locked_at timestamptz DEFAULT now(),
  stats jsonb DEFAULT '{}',
  UNIQUE(user_id, window_start)
);
```

**New table: `tm.user_app_categories`**
```sql
CREATE TABLE tm.user_app_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  app_id text NOT NULL,
  category text NOT NULL, -- 'work', 'social', 'entertainment', 'comms', 'utility', 'ignore'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, app_id)
);
```

**Modify `tm.events`:**
```sql
ALTER TABLE tm.events ADD COLUMN locked_at timestamptz;
CREATE INDEX idx_events_locked ON tm.events(user_id, locked_at) WHERE locked_at IS NOT NULL;
```

### Key Files to Modify
- `/apps/mobile/src/lib/supabase/services/actual-ingestion.ts` — Core pipeline changes
- `/apps/mobile/src/lib/supabase/hooks/use-actual-ingestion.ts` — Hook updates
- `/apps/mobile/src/lib/supabase/services/evidence-data.ts` — Location evidence fetching
- `/apps/mobile/src/lib/calendar/actual-display-events.ts` — Session block rendering

### Integration Points
- Google Places API for place auto-suggest (needs API key configuration)
- User's scheduled sleep time from existing settings/preferences

### Performance Considerations
- Session block computation is O(n) on events in window
- Location sample queries should use spatial index on `geom` column
- Google Places responses should be cached (15-min TTL or similar)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unknown blocks | <10% of waking hours | % of day classified as Unknown |
| User accuracy feedback | <5% of sessions edited by user | Edits / Total sessions |
| Calendar stability | 0 events shift after initial write | Regression test |
| Session block coverage | >90% of day covered by session blocks | Sessions / Day duration |

**Primary Success Indicator:** User accuracy feedback — users report fewer incorrect events and make fewer manual corrections.

---

## Migration Plan

1. **Deploy schema changes** — Add `locked_at` column, new tables
2. **Deploy new ingestion pipeline** — Behind feature flag initially
3. **Enable for new data only** — Existing events unaffected
4. **Monitor for 1 week** — Check stability, accuracy feedback
5. **Remove feature flag** — Full rollout

---

## Open Questions

1. **Google Places API quota** — What's the expected API call volume? Need rate limiting?
2. **Sleep time source** — Where is scheduled sleep time stored? Need to verify schema.
3. **Commute speed threshold** — What speed (m/s) indicates movement vs. stationary?
4. **Session block ID stability** — When extending a session, does the ID change? (Recommend: keep same ID)
5. **Timezone handling** — All times in UTC or user's local timezone for window alignment?

---

## Appendix: Intent Classification Algorithm

```typescript
function classifyIntent(screenTimeSummary: AppSummary[]): Intent {
  const total = screenTimeSummary.reduce((sum, app) => sum + app.seconds, 0);
  if (total === 0) return 'offline';

  const workSeconds = screenTimeSummary
    .filter(app => WORK_APPS.includes(app.appId))
    .reduce((sum, app) => sum + app.seconds, 0);

  const socialSeconds = screenTimeSummary
    .filter(app => SOCIAL_APPS.includes(app.appId) || ENTERTAINMENT_APPS.includes(app.appId))
    .reduce((sum, app) => sum + app.seconds, 0);

  const workPercent = workSeconds / total;
  const socialPercent = socialSeconds / total;

  if (workPercent >= 0.6) return 'work';
  if (socialPercent >= 0.6) return 'leisure';
  if (workPercent >= 0.4 && workPercent < 0.6 && socialPercent >= 0.25) return 'distracted_work';

  return 'mixed';
}
```

---

## Appendix: Default App Category Mapping

| Category | Apps |
|----------|------|
| **Work** | Slack, Google Docs, Gmail, Google Meet, Zoom, Calendar, Figma, Notion, Linear, VS Code, Chrome (default) |
| **Social** | Instagram, TikTok, X (Twitter), Reddit, Facebook, Snapchat, LinkedIn |
| **Entertainment** | YouTube, Netflix, Spotify, Apple Music, Twitch, Disney+, Podcasts |
| **Comms** | Messages, WhatsApp, Telegram, Signal, Phone, FaceTime |
| **Utility** | Maps, Photos, Weather, Calculator, Settings, Files, Notes |

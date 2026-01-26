# PRD: Today Matters V2 — Critical Bugs, Timeline Accuracy & Feature Expansion

## Introduction

This PRD addresses a comprehensive set of critical bugs, timeline accuracy issues, and new feature requests for the Today Matters app. The feedback comes from real-world usage on Android where location data is not collecting, events are being inferred incorrectly, edits are not persisting, and the evidence pipeline is exhibiting excessive re-processing. Beyond fixes, this PRD introduces major features: the "Big 3" daily priorities system, hierarchical categories/subcategories, location intelligence with place labeling, setup screen enhancements, a redesigned split-event workflow, location-based reminders, and event-based contextual lists.

**Platform Focus:** Android first (fix location collection, then build intelligence), iOS follow-up.

**Priority Order:** All critical bugs (US-026 through US-031) must be resolved before feature work begins.

**Continues from:** `prd-calendar-actual-timeline-fix.md` (US-001 through US-025)

---

## Goals

- **[URGENT]** Fix Android location data collection — diagnostics show `canStart: false` despite all permissions granted
- **[URGENT]** Fix event edit persistence — edits revert or fail to save
- Eliminate excessive log repetition / re-processing loops in the evidence pipeline
- Improve event inference accuracy — correct mislabeled activities, wrong times, unrecognized travel
- Make all events editable, including "Unknown" events
- Introduce the "Big 3" daily priorities concept as an optional onboarding feature
- Implement hierarchical categories with unlimited subcategories and "Other" as a top-level category
- Build location intelligence: place labeling, auto-tagging, and historical mining
- Enhance setup flow with contact/location mining from last 30 days
- Redesign split-event UX for multi-segment splitting with inline editing
- Lay groundwork for location-based reminders and event-based contextual lists

---

## User Stories

### Phase 1: Critical Bug Fixes (URGENT)

---

### US-026: Fix Android Location Data Collection
**Description:** As an Android user, I want location data to actually collect in the background so the app can infer where I was throughout the day.

**Context:** Diagnostics show all permissions granted, services enabled, background task registered — but `canStart: false` and `pendingSamples: 0`. The `SparseLocationFallback` is permanently active because no location data exists. Screen time shows "5 sessions, 0 min" which also appears incorrect.

**Acceptance Criteria:**
- [ ] Investigate why `canStart` returns `false` despite permissions granted and task started
- [ ] Verify `expo-location` background task is actually registering and firing on Android
- [ ] Confirm location samples are being written to `tm.location_samples` and `tm.location_hourly`
- [ ] Verify screen time session duration collection (currently showing "0 min" for 5 sessions)
- [ ] Add diagnostic logging: last successful location sample timestamp, sample count last 24h
- [ ] After fix, `SparseLocationFallback` should only activate when genuinely sparse (not always)
- [ ] Test on physical Android device — background location must collect hourly
- [ ] Typecheck/lint passes

**Investigation Notes:**
- Check `apps/mobile/src/lib/android-location/index.ts` — `canStart` logic
- Check `apps/mobile/src/lib/android-location/location-task.ts` — task registration and execution
- Check `apps/mobile/src/lib/android-location/queue.ts` — sample queuing
- Check `apps/mobile/modules/android-insights/android/src/main/java/expo/modules/androidinsights/AndroidInsightsModule.kt` — native usage stats
- Possible causes: task not actually starting despite `taskStarted: true`, Expo background task restrictions on newer Android versions, battery optimization killing the task

---

### US-027: Fix Event Edit Persistence
**Description:** As a user, I want my edits to event titles, categories, and times to persist reliably after saving.

**Context:** Some title edits save, some revert. Example: changed title to "Walking the boys" but it reverts. This could be a state update race condition, backend write failure, or optimistic UI rollback.

**Acceptance Criteria:**
- [ ] Diagnose the root cause: trace from UI save → store update → Supabase write → reload
- [ ] Verify `updateActual()` in `calendar-events.ts` is called and succeeds (check response)
- [ ] Verify the events store is updated after successful Supabase write (not before)
- [ ] Verify `syncDerivedActualEvents` does not overwrite user edits with re-derived data
- [ ] After edit + save, navigate away and back — edit must persist
- [ ] After edit + save, close app and reopen — edit must persist
- [ ] Add error handling: show user-visible error if save fails (not silent rollback)
- [ ] Typecheck/lint passes

**Key Files:**
- `apps/mobile/src/app/actual-adjust.tsx` — save handler
- `apps/mobile/src/lib/supabase/services/calendar-events.ts` — `updateActual()`
- `apps/mobile/src/stores/events-store.ts` — local state
- `apps/mobile/src/lib/supabase/hooks/use-calendar-events-sync.ts` — sync logic

---

### US-028: Make Unknown Events Editable
**Description:** As a user, I want to be able to edit "Unknown" events (title, time, category) just like any other event.

**Context:** At least one "Unknown" event blocks editing entirely — tapping it does nothing or the edit screen fails to load.

**Acceptance Criteria:**
- [ ] All events with `meta.kind === 'unknown_gap'` are tappable and open the edit screen
- [ ] Unknown events support editing: title, start/end time, category, subcategory, Big 3 assignment
- [ ] Edited unknown events are persisted as `source: 'user_input'` or `source: 'actual_adjust'`
- [ ] After editing, the event no longer shows as "Unknown" in the timeline
- [ ] Typecheck/lint passes

---

### US-029: Fix Excessive Evidence Pipeline Re-Processing
**Description:** As a developer, I need the evidence pipeline to run once per data change, not 8+ times in a loop.

**Context:** Logs show SparseLocationFallback, EvidenceAvailability, and EvidenceFusion repeating 8+ times in a single cycle. This suggests a re-render loop or polling interval that re-triggers the entire pipeline.

**Acceptance Criteria:**
- [ ] Identify what triggers re-runs: React re-renders, polling intervals, state changes, or all three
- [ ] Add memoization or caching so the pipeline skips if inputs haven't changed
- [ ] Evidence pipeline runs at most once per user action or data sync event
- [ ] Log repetition reduced from 8+ to 1-2 per cycle
- [ ] Pipeline result is cached and reused until inputs change (events, evidence, or user edits)
- [ ] Typecheck/lint passes

---

### US-030: Fix Event Time Accuracy
**Description:** As a user, I want event times to reflect reality — not rounded, bucketed, or offset incorrectly.

**Context:** User left for church at ~9:30, app shows ~9:00. Times are systematically wrong.

**Acceptance Criteria:**
- [ ] Audit time sources for each event type: calendar start times vs location arrival/departure vs rounding logic
- [ ] Identify and document where rounding/bucketing is applied (e.g., hourly location → startMinutes)
- [ ] Ensure timezone offsets are handled correctly (UTC → local conversion)
- [ ] When location data shows arrival at 9:32, the event should start at 9:32 (or nearest minute), not 9:00
- [ ] Calendar-sourced events use actual calendar start time, not bucketed approximation
- [ ] Add logging that shows raw time data vs displayed time for debugging
- [ ] Typecheck/lint passes

**Key Files:**
- `apps/mobile/src/lib/calendar/actual-display-events.ts` — time assignment logic
- `apps/mobile/src/lib/calendar/evidence-fusion.ts` — time from evidence sources
- `apps/mobile/src/lib/supabase/services/evidence-data.ts` — raw evidence times

---

### US-031: Improve Event Inference Accuracy
**Description:** As a user, I want the app to correctly identify activities based on available evidence rather than mislabeling them.

**Context:** Morning routine labeled "productive screen time" even though user wasn't on screens. Church mislabeled and mis-timed. Travel segments (home → church → restaurant) not recognized as travel.

**Acceptance Criteria:**
- [ ] When no screen time evidence exists for a time block, do not label it as screen time
- [ ] Detect travel segments: when location changes between two known places, insert a "Travel" event
- [ ] Use location type hints: church → "Faith/Worship", restaurant → "Meal/Eating", home → "Home/Family"
- [ ] Leverage user's `tm.location_mappings` for known places before falling back to generic labels
- [ ] Screen time should only be the primary label when screen usage is the dominant activity (>50% of block)
- [ ] Add "Travel" as a recognized activity type in the evidence fusion pipeline
- [ ] Typecheck/lint passes

---

### Phase 2: Core Feature — Categories, Subcategories & Big 3

---

### US-032: Implement Hierarchical Category/Subcategory System
**Description:** As a user, I want to organize my time into top-level categories with unlimited subcategories so I can track granular analytics (e.g., "How many Sundays did we attend church?").

**Context:** Current system has 14 flat `EventCategory` values and 6 core values with limited subcategories. Need to allow many subcategories per category, and "Other" must be a top-level category.

**Acceptance Criteria:**
- [ ] Database schema: `tm.activity_categories` table with `id`, `user_id`, `parent_id` (null = top-level), `name`, `icon`, `color`, `sort_order`
- [ ] Seed top-level categories: Faith, Family, Work, Health, Personal Growth, Finances, Other
- [ ] Users can add unlimited subcategories under any top-level category
- [ ] Users can add sub-subcategories (2 levels deep max: Category → Subcategory → Sub-subcategory)
- [ ] "Other" is a permanent top-level category that cannot be deleted
- [ ] Category picker in event editing shows hierarchical tree (tap to expand)
- [ ] Analytics can group by any level: top-level, subcategory, or specific sub-subcategory
- [ ] Migration from existing `EventCategory` enum to new hierarchical system
- [ ] Typecheck/lint passes

**Examples:**
```
Faith
  ├── Church
  │   ├── Sunday Service
  │   └── Wednesday Bible Study
  ├── Prayer
  └── Devotional

Family
  ├── Dog Walking
  │   ├── Morning Walk (Park A)
  │   └── Evening Walk (Park B)
  ├── Family Dinner
  └── Kids Activities

Work
  ├── Deep Work
  ├── Meetings
  └── Email/Slack

Health
  ├── Exercise
  │   ├── Gym
  │   └── Running
  ├── Nutrition
  └── Sleep/Recovery
```

---

### US-033: Implement "Big 3" Daily Priorities System
**Description:** As a user, I want to optionally define 3 big priorities each day and assign time blocks to them so I can track what matters most.

**Context:** `isBig3` flag already exists in `CalendarEventMeta` but the feature is not implemented in UI or onboarding.

**Acceptance Criteria:**
- [ ] Setup flow: add screen asking "Do you want to use the Big 3 concept?" (opt-in)
- [ ] If opted in: daily prompt (morning or previous evening) to set 3 priorities for the day
- [ ] Big 3 stored in `tm.daily_big3` table: `id`, `user_id`, `date`, `priority_1`, `priority_2`, `priority_3`, `category_id` (optional link to subcategory)
- [ ] In event editing (`actual-adjust`): "Mark as Big 3" button shows the day's 3 priorities, user taps to assign
- [ ] Home screen: show Big 3 progress (which ones have time allocated, how much time)
- [ ] Activity review: highlight Big 3 completion at end of day
- [ ] Analytics: weekly/monthly Big 3 completion rate, time spent on Big 3 vs other
- [ ] If user opts out of Big 3, it is hidden from all UI: event editing, home screen, analytics
- [ ] Preference stored in `tm.user_preferences` and synced
- [ ] Typecheck/lint passes

---

### US-034: Update Core Categories Setup Screen
**Description:** As a user, I want to add many subcategories to each major category during setup, and "Other" should always be available as a main category.

**Acceptance Criteria:**
- [ ] `core-categories.tsx` updated to use hierarchical category system (US-032)
- [ ] Users can add unlimited subcategories per value/category during setup
- [ ] "Other" always appears as a top-level category in setup
- [ ] LLM suggestion engine generates subcategory ideas based on user's goals and values
- [ ] Categories created during setup are saved to `tm.activity_categories`
- [ ] Existing `core_categories` data migrated to new system
- [ ] Typecheck/lint passes

---

### Phase 3: Location Intelligence

---

### US-035: Place Labeling and Auto-Tagging
**Description:** As a user, I want to label a location once (e.g., "This is my dog walking park") and have the app auto-tag future visits.

**Context:** `tm.location_mappings` table already exists (US-022). This builds the user-facing feature on top.

**Acceptance Criteria:**
- [ ] When user edits an event with location evidence, offer "Label this place" option
- [ ] Place label stored in `tm.location_mappings`: lat/lng, radius, label, category_id, subcategory_id
- [ ] On future visits to labeled places, auto-fill: event title, category, subcategory
- [ ] Auto-tagged events show "Auto-tagged from [Place Name]" in evidence details
- [ ] Confidence boosted for auto-tagged events (location match = high confidence)
- [ ] User can view/edit/delete place labels in Settings
- [ ] Typecheck/lint passes

**Acceptance Example:**
> User labels a park as "Walking the boys" → Category: Family → Subcategory: Dog Walking.
> Next time location matches that park, event auto-populates as "Walking the boys" / Family / Dog Walking.

---

### US-036: Location-Based Activity Inference
**Description:** As a user, I want the app to use location context to make better guesses about what I was doing.

**Acceptance Criteria:**
- [ ] Home location (from setup or frequent overnight) → default to "Home / Family"
- [ ] Work location (from setup or frequent weekday) → default to "Work"
- [ ] Place-type hints from GPS data or reverse geocoding:
  - Church/religious → "Faith / Worship"
  - Restaurant/café → "Meal / Eating"
  - Gym/fitness → "Health / Exercise"
  - Park (repeated visits) → use learned label or "Recreation"
- [ ] Location inference is lower priority than user labels (US-035) and explicit edits
- [ ] Unknown places without labels default to "Unknown" with location address shown
- [ ] Typecheck/lint passes

---

### US-037: Travel Segment Detection
**Description:** As a user, I want the app to detect when I'm traveling between locations and create travel events automatically.

**Acceptance Criteria:**
- [ ] When location data shows movement between two stationary points, insert "Travel" event
- [ ] Travel event duration = time between leaving location A and arriving at location B
- [ ] Travel events show origin → destination (e.g., "Travel: Home → Church")
- [ ] Travel categorized under "Travel" top-level category
- [ ] Short movements (<5 min) within same general area are not flagged as travel
- [ ] User can edit travel events like any other event
- [ ] Typecheck/lint passes

---

### Phase 4: Setup & Onboarding Enhancements

---

### US-038: Mine Historical Contacts During Setup
**Description:** As a user, I want the app to organize my most frequent contacts into a categorized VIP list during setup so I can review and confirm them.

**Acceptance Criteria:**
- [ ] During setup, request contacts permission and mine last 30 days of communication history (calls, texts)
- [ ] Rank contacts by frequency and recency
- [ ] Auto-categorize contacts into groups: Family, Work, Friends, Other
- [ ] Present categorized VIP list on "Does this look right?" screen
- [ ] User can re-categorize, add, or remove contacts from VIP list
- [ ] VIP contacts stored in `tm.vip_contacts` table
- [ ] Mining runs in background during earlier setup screens (non-blocking)
- [ ] Typecheck/lint passes

---

### US-039: Mine Historical Locations During Setup
**Description:** As a user, I want the app to identify my most frequent locations during setup so I can label them.

**Acceptance Criteria:**
- [ ] During setup, mine last 30 days of location history (requires location permission already granted)
- [ ] Cluster locations by proximity to identify distinct places
- [ ] Rank places by visit frequency
- [ ] Present frequent locations on "Does this look right?" screen with map pins
- [ ] User can label each location: name, category, subcategory
- [ ] Labels saved to `tm.location_mappings` for auto-tagging (connects to US-035)
- [ ] Mining runs in background during earlier setup screens (non-blocking)
- [ ] Show reverse-geocoded addresses for user-friendly display
- [ ] Typecheck/lint passes

---

### US-040: Enhanced "Does This Look Right?" Setup Screen
**Description:** As a user, I want the final setup screen to show me everything the app learned about me so I can confirm or correct it before starting.

**Acceptance Criteria:**
- [ ] Screen displays: core values, categories/subcategories, goals, Big 3 preference, VIP contacts, frequent locations
- [ ] Each section is expandable/collapsible
- [ ] User can tap any item to edit inline
- [ ] "Looks good" button finalizes setup and saves all data
- [ ] "Go back" allows returning to any setup screen to make changes
- [ ] Typecheck/lint passes

---

### Phase 5: Split Event Redesign

---

### US-041: Multi-Segment Event Splitting
**Description:** As a user, I want to split an event into 2, 3, 4, or 5+ segments instead of just two.

**Acceptance Criteria:**
- [ ] Replace current slider with multi-point split interface
- [ ] User taps to add split points on a time bar (like adding markers)
- [ ] Can add up to N-1 split points to create N segments (practical limit: 10 segments)
- [ ] Split points can be dragged to adjust after placement
- [ ] Split points can be removed by tapping a delete button on each marker
- [ ] Preview shows resulting segment count and durations
- [ ] Typecheck/lint passes

---

### US-042: Inline Sub-Event Editing After Split
**Description:** As a user, I want to edit each sub-event's details (title, category, Big 3) right on the split screen without navigating away.

**Acceptance Criteria:**
- [ ] After setting split points, show compact sub-event cards below the time bar
- [ ] Each sub-event card shows: time range, title (editable), category picker, Big 3 toggle
- [ ] Tap a card to expand it for full editing (title, description, category, subcategory, Big 3)
- [ ] Collapse card to return to compact view
- [ ] "Save All" button at bottom commits all sub-events in a single transaction
- [ ] If any sub-event save fails, rollback all and show error
- [ ] Original parent event is deleted/replaced after successful save
- [ ] Typecheck/lint passes

---

### Phase 6: Future Features (Groundwork Only)

---

### US-043: Location-Based Reminders (Design & Data Model)
**Description:** As a user, I want to set reminders triggered by proximity to a location (e.g., "Remind me to return the Amazon package when I'm near Whole Foods").

**Context:** This is a major feature. This story covers only the data model and basic infrastructure — not the full implementation.

**Acceptance Criteria:**
- [ ] Database schema: `tm.location_reminders` table: `id`, `user_id`, `title`, `description`, `target_location` (lat/lng/radius), `trigger_type` ('on_arrival' | 'on_route' | 'nearby'), `linked_event_id` (optional), `items` (JSONB list), `active`, `created_at`
- [ ] API types defined in TypeScript
- [ ] Basic CRUD service for location reminders in Supabase services
- [ ] No UI or trigger logic in this story (deferred to future PRD)
- [ ] Typecheck/lint passes

**Example Use Case:**
> "Set a reminder next time I'm going to an event where Whole Foods is on the way — remind me to leave 10 minutes early and to take that Amazon package."

---

### US-044: Event-Based Contextual Lists (Design & Data Model)
**Description:** As a user, I want the app to prompt me with relevant checklists based on upcoming events (e.g., packing list before a flight).

**Context:** This is a major feature. This story covers only the data model and basic infrastructure.

**Acceptance Criteria:**
- [ ] Database schema: `tm.contextual_lists` table: `id`, `user_id`, `name`, `trigger_type` ('event_type' | 'calendar_keyword' | 'manual'), `trigger_value` (e.g., 'flight', 'business_trip'), `items` (JSONB array of checklist items), `advance_hours` (how far in advance to prompt), `created_at`
- [ ] API types defined in TypeScript
- [ ] Basic CRUD service for contextual lists in Supabase services
- [ ] No notification or trigger logic in this story (deferred to future PRD)
- [ ] Typecheck/lint passes

**Example Use Cases:**
> - Flight tomorrow → prompt with packing list the evening before
> - Business trip vs vacation → different list templates
> - Leaving for office → daily carry checklist
> - Walking the dogs → leash, bags, treats checklist

---

## Functional Requirements

### Bug Fixes
- **FR-16:** The Android location background task must actually collect and store location samples when permissions are granted
- **FR-17:** Event edits (title, category, time) must persist to Supabase and survive app restart
- **FR-18:** All events including "Unknown" must be editable via the adjust screen
- **FR-19:** The evidence pipeline must not re-process more than once per data change or user action
- **FR-20:** Event times must reflect actual evidence timestamps, not rounded/bucketed approximations
- **FR-21:** Events must not be labeled as "screen time" when no screen usage evidence exists for that time block

### Categories & Big 3
- **FR-22:** The category system must support hierarchical nesting: Category → Subcategory → Sub-subcategory (2 levels deep)
- **FR-23:** "Other" must always exist as a permanent top-level category
- **FR-24:** The "Big 3" feature must be entirely opt-in — when disabled, no Big 3 UI appears anywhere
- **FR-25:** Big 3 daily priorities must be assignable to time blocks from the event editor

### Location Intelligence
- **FR-26:** User-labeled places must auto-populate event details on future visits
- **FR-27:** Travel segments must be detected and inserted when location data shows movement between stationary points
- **FR-28:** Location-based inference must be lower priority than user labels and explicit edits

### Setup & Onboarding
- **FR-29:** Setup flow must mine 30 days of contacts and locations in the background during setup
- **FR-30:** The "Does this look right?" screen must display VIP contacts, frequent locations, values, categories, and goals

### Split Events
- **FR-31:** Users must be able to split events into 2–10 segments
- **FR-32:** All sub-events from a split must be saved in a single atomic transaction

---

## Non-Goals

- No iOS-specific fixes in Phase 1 (Android-first)
- No push notification system for location-based reminders (groundwork only)
- No natural language processing for reminder creation ("Hey Today Matters, set a reminder...")
- No automatic contact categorization without user confirmation
- No third-party map/places API integration (use raw GPS + user labels)
- No real-time location tracking or geofencing (batch/hourly sampling only)
- No changes to the AI coach persona or voice features
- No changes to the analytics dashboard layout (only data model changes for new categories)

---

## Design Considerations

### Event Editing UX
- Edit screen must load for ALL event types (including Unknown, derived, sleep)
- Save must show loading indicator and confirmation — no silent failures
- Category picker should show hierarchical tree with expand/collapse

### Split Event UX
- Multi-point time bar with tap-to-add markers (not slider)
- Compact sub-event cards below time bar
- Expand/collapse for detailed editing
- Single "Save All" action at bottom

### Setup Flow
- Background mining should not block setup progression
- "Does this look right?" screen uses card-based layout with expand/collapse sections
- Place labeling uses map view with pins

---

## Technical Considerations

### Key Files (Bugs)
- **Android Location:** `apps/mobile/src/lib/android-location/index.ts`, `location-task.ts`, `queue.ts`
- **Native Module:** `apps/mobile/modules/android-insights/android/src/main/java/expo/modules/androidinsights/AndroidInsightsModule.kt`
- **Event Persistence:** `apps/mobile/src/lib/supabase/services/calendar-events.ts`
- **Evidence Pipeline:** `apps/mobile/src/lib/calendar/actual-display-events.ts`
- **Event Editor:** `apps/mobile/src/app/actual-adjust.tsx`

### Key Files (Features)
- **Categories:** `apps/mobile/src/app/core-categories.tsx`, `apps/mobile/src/stores/onboarding-store.ts`
- **Big 3:** `apps/mobile/src/stores/events-store.ts` (existing `isBig3` flag)
- **Split:** `apps/mobile/src/app/actual-split.tsx`, `apps/mobile/src/components/templates/ActualSplitTemplate.tsx`
- **Setup:** `apps/mobile/src/app/setup-questions.tsx`, `apps/mobile/src/constants/setup-screens.ts`
- **Location Mappings:** `apps/mobile/src/lib/supabase/services/location-mappings.ts`

### Database Migrations Needed
1. `tm.activity_categories` — hierarchical category system (US-032)
2. `tm.daily_big3` — daily priorities (US-033)
3. `tm.vip_contacts` — VIP contact list (US-038)
4. `tm.location_reminders` — location-based reminders (US-043)
5. `tm.contextual_lists` — event-based checklists (US-044)
6. Possible migration: `tm.location_mappings` may need `category_id` and `subcategory_id` columns

### Architecture Notes
- Evidence pipeline caching: use a hash of inputs (events + evidence + user edits) to skip re-processing
- Category migration: map existing `EventCategory` enum values to new `activity_categories` rows, maintain backward compatibility during transition
- Big 3 opt-in: store preference in `tm.user_preferences`, check before rendering any Big 3 UI
- Split transaction: use Supabase RPC or batch insert for atomic multi-event creation

### Data Flow for Location Intelligence
1. Background task collects location samples → `tm.location_samples`
2. Hourly aggregation → `tm.location_hourly`
3. Evidence pipeline reads hourly data → matches against `tm.location_mappings`
4. If match found: auto-populate event title + category from mapping
5. If no match: use place-type hints or mark as Unknown with address
6. User labels place → creates/updates `tm.location_mappings` entry
7. Next visit auto-tags from mapping

---

## Success Metrics

### Bug Fixes
- Android location samples collected every hour on physical device (verified over 24h)
- 100% of event edits persist after save → navigate away → return (verified over 10 edits)
- All "Unknown" events are tappable and editable
- Evidence pipeline logs appear 1-2 times per cycle (not 8+)
- Event times accurate to within 5 minutes of actual evidence timestamps

### Features
- Users can create 3+ subcategories per top-level category during setup
- Big 3 daily completion visible on home screen after opt-in
- Place labeling: after labeling once, next visit auto-tags correctly
- Split event: can split into 3+ segments with inline editing in under 30 seconds
- Setup "Does this look right?" shows at least 5 frequent locations and top 10 contacts

---

## Open Questions

1. **Location data source for setup mining:** Should we use Google Location History export, or only GPS samples collected by the app? (App-only means limited history on first install)
2. **Contact mining permissions:** What specific permissions are needed on Android for call/text history? Are there Play Store policy concerns?
3. **Category migration:** Should we keep backward compatibility with the old `EventCategory` enum during transition, or do a hard cutover?
4. **Big 3 timing:** When should the Big 3 prompt appear — morning alarm time, first app open, or previous evening review?
5. **Travel detection accuracy:** With hourly location sampling, can we reliably detect travel segments, or do we need more frequent sampling during detected movement?
6. **Split save atomicity:** Does Supabase support multi-row transactional inserts, or do we need an RPC function?
7. **Screen time "0 min":** Is the Android Usage Stats API returning 0 for foreground time, or is the app not parsing it correctly? Needs investigation alongside US-026.

---

## Investigation Checklist (Pre-Implementation)

Before coding, the dev team should:

1. [ ] **[URGENT]** Debug Android location: add verbose logging to `location-task.ts` callback, verify it fires on physical device
2. [ ] **[URGENT]** Debug `canStart` logic in `android-location/index.ts` — what condition is failing?
3. [ ] **[URGENT]** Trace event edit lifecycle: UI save → store update → Supabase call → response → reload
4. [ ] Profile evidence pipeline: what triggers each re-run? React state changes? setInterval? useEffect deps?
5. [ ] Audit time conversion: trace raw location timestamp → `startMinutes` assignment → UI display
6. [ ] Test Unknown event tap handler: is the navigation to actual-adjust failing for certain event shapes?
7. [ ] Review `AndroidInsightsModule.kt` — verify usage stats query returns non-zero foreground times
8. [ ] Check if battery optimization or Doze mode is killing the background location task

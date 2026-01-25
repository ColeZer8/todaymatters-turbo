# PRD: Calendar Actual Timeline Fix (Android-Focused)

## Introduction

Fix the calendar's "Actual" timeline to be accurate, non-overlapping, and reliable. The core problem is that actual events currently overlap, duplicate, fail to cross-reference with planned events, and sometimes get erased for prior days. This PRD addresses the complete actual timeline pipeline: evidence fusion, overlap elimination, cross-referencing, persistence, and rendering.

**Platform Focus:** Android (Usage Access + Location data)

## Goals

- Eliminate all overlaps in the Actual timeline—events must never visually stack
- Ensure Actual is always filled for past time (with unknown gaps as fallback) and blank for future time
- Properly cross-reference planned events with actual evidence (location, screen time)
- Fix duplicate React key errors causing rendering issues
- Persist all events (including unknown/derived) to Supabase without duplication or erasure
- Handle screen time inside sleep correctly (embed ≤10 min, separate >10 min)
- Show evidence details in event detail view

## User Stories

### US-001: Enforce No-Overlap Invariant in Timeline Builder
**Description:** As a user, I want the actual timeline to never show overlapping events so I can clearly see my day.

**Acceptance Criteria:**
- [ ] Create `ActualTimelineBuilder` that produces a single ordered list with no overlaps
- [ ] When events overlap, split the lower-priority event around the higher-priority event
- [ ] Priority order: (1) User-edited actual, (2) Supabase actual (non-derived), (3) Derived actual from evidence fusion, (4) Screen time inferred, (5) Unknown gaps
- [ ] Add unit test: no two events in final output have overlapping time ranges
- [ ] Typecheck/lint passes

### US-002: Generate Unique Deterministic Event IDs
**Description:** As a developer, I need every derived event to have a unique ID so React renders correctly without duplicate key warnings.

**Acceptance Criteria:**
- [ ] Derived event IDs use format: `derived:{type}:{startMinutes}:{endMinutes}:{source}`
- [ ] Add uniqueness validation before rendering—log warning if duplicates found
- [ ] Fix `derived_actual:sleep_interrupted_60_8` duplicate issue specifically
- [ ] No React duplicate key warnings in console
- [ ] Typecheck/lint passes

### US-003: Fix Actual Data Persistence for Prior Days
**Description:** As a user, I want my actual data from previous days to persist and not be erased.

**Acceptance Criteria:**
- [ ] Investigate `syncDerivedActualEvents` and cleanup logic for erasure bug
- [ ] Derived events synced to Supabase are not re-derived and duplicated on reload
- [ ] Prior day actual events remain intact after app restart
- [ ] Add logging to trace actual event lifecycle (create, sync, retrieve)
- [ ] Typecheck/lint passes

### US-004: Implement Evidence Source Priority Resolution
**Description:** As a user, I want my actual timeline to reflect reality using the best available evidence.

**Acceptance Criteria:**
- [ ] Resolution order: (1) User's ideal/planned event, (2) Location data, (3) Screen time as intentionality check
- [ ] Screen time within expected context (e.g., calculator at work) doesn't override location
- [ ] Screen time outside expected context (e.g., Instagram at work) adds "distracted" note
- [ ] Location is primary source when available; screen time confirms/adjusts
- [ ] Typecheck/lint passes

### US-005: Cross-Reference Planned Events with Actual Evidence
**Description:** As a user, I want my planned events to be reconciled with what actually happened based on evidence.

**Acceptance Criteria:**
- [ ] For each planned event, check evidence to confirm, shift, shorten, or mark as skipped
- [ ] If evidence shows late arrival: shift actual block start time, add "arrived X min late" in description
- [ ] If evidence shows different activity: keep planned as-is, create actual block showing reality
- [ ] Example: "Go to gym" planned + McDonald's location → mark planned, create "Fast food" actual with evidence
- [ ] Planned events are never modified—actual timeline shows reality
- [ ] Typecheck/lint passes

### US-006: User-Defined Location and App Mappings for Cross-Reference
**Description:** As a user, I want to define what locations and apps correspond to my activities so the system can infer correctly.

**Acceptance Criteria:**
- [ ] User can map locations to activities (e.g., "123 Main St" = "Work", "456 Gym Ave" = "Gym")
- [ ] User can map apps to activity types (e.g., "Slack" = "Work", "MyFitnessPal" = "Gym")
- [ ] Cross-reference logic uses these mappings to infer actual from evidence
- [ ] Settings UI for managing location/app mappings
- [ ] Mappings persisted to Supabase
- [ ] Typecheck/lint passes

### US-007: Handle Screen Time Inside Sleep Blocks
**Description:** As a user, I want brief phone usage during sleep to be noted on the sleep block, but longer usage to be a separate event.

**Acceptance Criteria:**
- [ ] Screen time ≤10 min during sleep: embed in sleep block description (e.g., "Sleep (phone: 5 min)")
- [ ] Screen time >10 min during sleep: create separate "Screen Time" block, split sleep around it
- [ ] Sleep block shows total duration excluding screen time interruptions >10 min
- [ ] Typecheck/lint passes

### US-008: Handle Distraction Detection
**Description:** As a user, I want to see when I was distracted from my planned activity based on app usage.

**Acceptance Criteria:**
- [ ] If planned work + location is work but distraction app caused late start: shift actual to arrival, add "distracted" note
- [ ] Distraction <10 min: note on same block
- [ ] Distraction >10 min: separate distraction block
- [ ] Distraction apps configurable by user (default: social media, games)
- [ ] Typecheck/lint passes

### US-009: Fill Unknown Gaps with Interactive Prompts
**Description:** As a user, I want gaps in my actual timeline to prompt me for input while offering smart suggestions.

**Acceptance Criteria:**
- [ ] Unknown gaps show interactive "What were you doing?" prompt
- [ ] Suggestions inferred from planned events for that time slot
- [ ] User can select from suggestions or enter custom activity
- [ ] Selected activity persisted to Supabase as actual event
- [ ] Unknown blocks only appear for past time, never future
- [ ] Typecheck/lint passes

### US-010: Show Evidence in Event Detail View
**Description:** As a user, I want to see the evidence (location, screen time) that informed an actual event when I tap on it.

**Acceptance Criteria:**
- [ ] Event detail view shows source evidence (location data, screen time sessions)
- [ ] Shows confidence score for derived events (visible on expand/tap only)
- [ ] Evidence formatted clearly (e.g., "Location: 123 Main St from 9:00-10:30 AM")
- [ ] Screen time details show apps and durations
- [ ] Typecheck/lint passes

### US-011: Consolidate Evidence Fusion Pipeline
**Description:** As a developer, I need a single pipeline that fuses all evidence sources before rendering.

**Acceptance Criteria:**
- [ ] Create unified evidence fusion in `actual-display-events.ts`
- [ ] Pipeline: merge evidence blocks + screen time + planned cross-ref → single ordered list
- [ ] Each event has unique ID and attached metadata for description rendering
- [ ] Screen time ≤10 min embedded in event description, not separate block
- [ ] Pipeline runs once per render cycle, not multiple times
- [ ] Typecheck/lint passes

### US-012: Android-Specific Evidence Pipeline
**Description:** As an Android user, I need the pipeline to work with Usage Access and location data.

**Acceptance Criteria:**
- [ ] Use Usage Access sessions + location hourly to build fused blocks
- [ ] When location is sparse, fallback to screen time + unknown with confidence tags
- [ ] Handle Android-specific data formats and timing
- [ ] Log evidence source availability for debugging
- [ ] Typecheck/lint passes

## Functional Requirements

- **FR-1:** The system must never render overlapping events in the Actual timeline
- **FR-2:** The system must generate unique, deterministic IDs for all derived events
- **FR-3:** The system must persist all actual events (user-entered, derived, unknown) to Supabase
- **FR-4:** The system must not erase or duplicate actual events for prior days
- **FR-5:** The system must resolve evidence conflicts using priority: ideal/planned → location → screen time
- **FR-6:** The system must cross-reference each planned event with evidence to determine actual
- **FR-7:** The system must allow users to define location-to-activity and app-to-activity mappings
- **FR-8:** The system must embed screen time ≤10 min in parent block description
- **FR-9:** The system must create separate blocks for screen time >10 min
- **FR-10:** The system must detect and annotate distractions based on app usage
- **FR-11:** The system must fill past-time gaps with interactive unknown prompts
- **FR-12:** The system must keep future time blank (no events rendered)
- **FR-13:** The system must display evidence details in event detail view
- **FR-14:** The system must show confidence scores only in event detail view (on tap)
- **FR-15:** The system must run evidence fusion once per render cycle

## Non-Goals

- No changes to planned event editing or creation
- No push notifications for unknown gap prompts
- No automatic priority assignment
- No iOS-specific fixes in this phase
- No changes to evidence data collection (location polling, screen time access)
- No calendar sync with external calendars (Google, Apple)
- No confidence scores displayed inline on timeline (only in detail view)

## Technical Considerations

### Key Files
- **Orchestration:** `apps/mobile/src/app/comprehensive-calendar.tsx`
- **Merge/Derivation:** `apps/mobile/src/lib/calendar/actual-display-events.ts`
- **Screen Time Derivation:** `apps/mobile/src/lib/calendar/derive-screen-time-actual-events.ts`
- **Evidence Data:** `apps/mobile/src/lib/supabase/services/evidence-data.ts`
- **Render:** `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx`

### Architecture
- `ActualTimelineBuilder` class to consolidate all fusion logic
- Split algorithm for overlap resolution (split lower-priority around higher-priority)
- Deterministic ID generation: `derived:{type}:{startMinutes}:{endMinutes}:{source}`
- Evidence metadata attached to events for detail view rendering

### Data Flow
1. Load planned events, evidence (location, screen time), existing actuals from Supabase
2. Cross-reference planned with evidence
3. Derive actual events from evidence
4. Resolve overlaps using priority order
5. Fill unknown gaps for past time
6. Render single non-overlapping timeline
7. Persist derived/unknown to Supabase (idempotently, no duplicates)

### Known Issues to Fix
- `ComprehensiveCalendarTemplate.tsx` lines 552-559: duplicate key error
- `buildActualDisplayEvents` producing overlaps despite dedup logic
- `syncDerivedActualEvents` possibly erasing prior day data
- Cross-reference path incomplete for planned event reconciliation

## Success Metrics

- Zero overlapping events in Actual timeline (visual inspection + unit test)
- Zero React duplicate key warnings in console
- Prior day actual data persists after 7 days without erasure
- Planned events correctly reconciled with evidence (manual verification with test cases)
- Unknown gaps prompt appears only for past time
- Screen time correctly embedded or separated based on 10 min threshold

## Open Questions

1. Should location mappings be auto-suggested based on frequent visits, or always manual entry?
2. How should we handle conflicting evidence with equal confidence (e.g., two locations at same time)?
3. Should distraction threshold (10 min) be user-configurable?
4. What happens when a user dismisses an unknown gap prompt—should it remain or be auto-filled?
5. Should we add an "undo" for auto-reconciled events if user disagrees with inference?

## Investigation Checklist (Pre-Implementation)

Before coding, Ralph should:

1. [ ] Reproduce on Android sim with logging of `combinedActualEvents` + `event.id` uniqueness
2. [ ] Trace duplicate IDs in `buildActualDisplayEvents` (likely derived sleep interruptions)
3. [ ] Trace actual wipe for prior days: check if `syncDerivedActualEvents` or cleanup removes old actual events
4. [ ] Verify cross-reference path for planned events (verification engine + evidence)
5. [ ] Add a test for overlap elimination (no two events overlap in final output)
6. [ ] Verify Supabase persistence of unknown/derived; confirm they're not re-derived and duplicated

# PRD: Critical Flow & Data Issues - Timeline, Location, and Event Management

## Introduction

This PRD addresses critical flow and data issues affecting user trust and core app functionality. The primary problems include: timeline blocks showing "Unknown" activities that cannot be edited, location transitions not being used to segment the timeline, calendar events missing from the timeline, inconsistent edit/create flows, and system UI violations. These issues prevent users from accurately tracking their day and destroy confidence in the app's data.

**Golden Rule:** If the app guesses wrong, the user must be able to fix it in 2 taps or less.

**Platform Scope:** Both iOS and Android unless explicitly noted as Android-only.

**Priority Hierarchy for Data:** User edits > Calendar events > Auto-detected activity > Email data

---

## Goals

- Enable full editability of all timeline blocks (title, time, category, split/merge)
- Use location transitions to accurately segment timeline into meaningful activity blocks
- Ensure calendar events always appear as anchors in the daily timeline
- Fix all system UI/safe area violations across both platforms
- Make date/time handling robust and consistent
- Provide clear visual feedback for all state changes
- Allow users to correct any app inference in 2 taps or less
- Establish trust through accurate, explainable data

---

## User Stories

### P0 — CRITICAL FLOW & DATA ISSUES

---

#### US-001: Fix System UI / Safe Area Violations

**Description:** As a user, I want the app UI to never overlap system icons (time, battery, signal) so I can see critical device information.

**Acceptance Criteria:**

- [ ] All screens use `SafeAreaView` from `react-native-safe-area-context` as root container
- [ ] Headers never overlap iOS notch or Android status bar
- [ ] Remove or correctly position any floating/debug icons (orange icon in header)
- [ ] No white background overwrites system UI area
- [ ] Buttons never appear under status bar on any screen
- [ ] QA all screens for status bar compliance on iPhone 15 Pro and Pixel 8
- [ ] Typecheck passes

**Affected Files:**

- All template files in `/apps/mobile/src/components/templates/`
- Screen files in `/apps/mobile/src/app/`

---

#### US-002: Fix Date/Time/Timezone Handling (Both Platforms)

**Description:** As a user, I want dates and times to display correctly relative to my timezone so events appear at the right time.

**Acceptance Criteria:**

- [ ] Events never appear in the future when they occurred in the past
- [ ] All times display correctly vs device local time
- [ ] AI summaries use correct event times (not incorrect inferred times)
- [ ] Date/time pickers persist state after selection
- [ ] Typecheck passes

---

#### US-003: Fix Event Creation Time Lock (Android-Only)

**Description:** As an Android user, I want to create events at any time, not just 9:30am.

**Acceptance Criteria:**

- [ ] Event creation allows any start time selection
- [ ] Time picker changes persist and save correctly
- [ ] No modal lock-in states when using Android native date/time pickers
- [ ] Supabase saves immediately without forcing user back to picker screen
- [ ] Explicit Save/Cancel paths available
- [ ] Typecheck passes
- [ ] Verify on Android emulator

---

#### US-004: Location-Based Timeline Segmentation

**Description:** As a user, I want my timeline to reflect location transitions (home → travel → office → coffee shop) so I don't see long "Unknown" blocks.

**Acceptance Criteria:**

- [ ] Detect meaningful location changes using hybrid approach:
  - Automatic coarse geofencing for common transitions
  - User-defined specific places (home, work, gym, etc.)
- [ ] Location transitions create timeline segment boundaries
- [ ] Long "Unknown" blocks replaced with inferred transitions when location data available
- [ ] Timeline shows location labels for each segment when available
- [ ] Combine location + device activity + time for accurate segmentation
- [ ] Battery-efficient background location tracking maintained
- [ ] Typecheck passes

**Technical Notes:**

- Leverage existing `/apps/mobile/src/lib/supabase/services/location-samples.ts`
- Enhance `/apps/mobile/src/lib/calendar/actual-display-events.ts` to use location transitions
- Add geofence definitions to user preferences/onboarding store

---

#### US-005: Make All Timeline Blocks Fully Editable

**Description:** As a user, I want to edit any timeline block (including "Unknown") so I can correct what the app got wrong.

**Acceptance Criteria:**

- [ ] Tap any timeline block to open edit modal (inline preview + modal for full edit)
- [ ] Swipe actions available for quick operations (delete, mark as Big 3)
- [ ] Editable fields: title, description, time range (start/end), category, location
- [ ] Changes save immediately and reflect in timeline
- [ ] "Unknown" blocks fully editable - not restricted
- [ ] User edits always override app inference
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

**Affected Files:**

- `/apps/mobile/src/components/molecules/EventEditorModal.tsx`
- `/apps/mobile/src/app/actual-adjust.tsx`
- `/apps/mobile/src/components/templates/ActualAdjustTemplate.tsx`

---

#### US-006: Add Split Action for Timeline Blocks

**Description:** As a user, I want to split one timeline block into multiple activities so I can accurately record what happened during that time.

**Acceptance Criteria:**

- [ ] Split action available on ANY timeline block (including "Unknown")
- [ ] Split action discoverable - visible in edit modal and/or swipe actions
- [ ] Splitting opens interface to define split point(s)
- [ ] Each resulting segment independently editable
- [ ] Each segment can be assigned to different goals/values
- [ ] Existing split screen component activated for all block types
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

**Technical Notes:**

- Split screen exists but is not active when user taps "Unknown" event under actual calendar
- Activate existing component in `/apps/mobile/src/app/actual-adjust.tsx`

---

#### US-007: Merge Calendar Events into Timeline

**Description:** As a user, I want my scheduled calendar events to appear in my daily timeline so I have a complete view of my day.

**Acceptance Criteria:**

- [ ] All calendar events for today appear in timeline
- [ ] Calendar events shown as "anchors" - visually distinct from detected activities
- [ ] Conflict resolution when auto-detected overlaps with calendar event:
  - Calendar event takes precedence by default
  - User can override to use detected activity instead
- [ ] Calendar events maintain their scheduled time regardless of detected activity
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

**Affected Files:**

- `/apps/mobile/src/lib/calendar/actual-display-events.ts` - `buildActualDisplayEvents()`
- `/apps/mobile/src/lib/supabase/services/calendar-events.ts`

---

### P1 — MAJOR USABILITY & LOGIC GAPS

---

#### US-008: Goals/Big 3 Attribution Interface

**Description:** As a user, I want to clearly choose which Big 3 or goal an activity contributes to so I can track my progress accurately.

**Acceptance Criteria:**

- [ ] For each activity, show selectable list of user's actual Big 3 items
- [ ] Single-select or multi-select supported for goal attribution
- [ ] Mark contribution level (yes/no or percentage) per goal
- [ ] Remove or clearly label any test/demo goals
- [ ] Never auto-mark 100% completion without user confirmation
- [ ] Vague labels like "Mark is big three" replaced with actual goal names
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

---

#### US-009: Visual State Change Feedback

**Description:** As a user, I want to understand what changed when I interact with timeline blocks so I'm not confused by unexplained color changes.

**Acceptance Criteria:**

- [ ] Define clear visual states with distinct meanings:
  - **Default/Inferred:** System-detected, not yet reviewed
  - **Confirmed:** User has verified this is correct
  - **Edited:** User has modified this block
  - **Scheduled:** From calendar, not detected
- [ ] Add subtle affordance or tooltip explaining state on first interaction
- [ ] No unexplained color changes - every visual change has meaning
- [ ] State legend accessible from timeline screen
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

---

#### US-010: Sleep Data Refinement & Editing

**Description:** As a user, I want to easily edit my sleep start/end times so my sleep tracking is accurate.

**Acceptance Criteria:**

- [ ] Sleep treated as a special editable timeline block
- [ ] Easy access to edit sleep start time and wake time
- [ ] Sleep interruption data aligns with actual wake times
- [ ] Sleep block prominently displayed in timeline
- [ ] Edits persist and update related calculations (sleep quality, duration)
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

---

#### US-011: Event Title Auto-Promotion from User Input

**Description:** As a user, I want my description of what happened to become the event title so events aren't stuck showing "Unknown".

**Acceptance Criteria:**

- [ ] When user enters note describing activity, AI extracts meaningful title
- [ ] Title auto-populates from user input (not stuck as "Unknown")
- [ ] User can override auto-generated title
- [ ] Title/description sync across all views (timeline, detail, edit)
- [ ] All user-added items are editable and removable
- [ ] Typecheck passes

**Technical Notes:**

- Leverage existing `requestReviewTimeSuggestion()` edge function
- Ensure suggested title is applied to event, not just shown

---

#### US-012: Normalize Create vs Edit Flow (Android-Only Focus)

**Description:** As an Android user, I want create and edit screens to work consistently so I'm not confused by different behaviors.

**Acceptance Criteria:**

- [ ] Create screen fully functional on Android (currently broken)
- [ ] Edit screen has proper safe area padding (Cancel/Confirm not blocked by status bar)
- [ ] Buttons in same locations on both create and edit screens
- [ ] Same fields behave identically on both screens
- [ ] Reuse same component logic for create & edit
- [ ] Typecheck passes
- [ ] Verify on Android emulator

**Affected Files:**

- `/apps/mobile/src/components/templates/AddEventTemplate.tsx`
- `/apps/mobile/src/components/molecules/EventEditorModal.tsx`

---

### P2 — DATA TRUST & COMPLETENESS

---

#### US-013: Fix Email Sync Freshness

**Description:** As a user, I want to see my recent emails so the app reflects current communications.

**Acceptance Criteria:**

- [ ] Email sync retrieves emails from last 24 hours minimum
- [ ] Proper time-based filtering (not showing very old emails)
- [ ] Distinguish inbox vs archive emails
- [ ] Latest emails always appear first
- [ ] Validate account mapping and permissions
- [ ] Handle multiple email accounts correctly
- [ ] Typecheck passes

---

#### US-014: Remove Arbitrary Goal Percentages

**Description:** As a user, I want goal completion percentages to be meaningful, not arbitrary placeholders.

**Acceptance Criteria:**

- [ ] Remove placeholder percentage logic
- [ ] Only show completion percentages when user explicitly sets them
- [ ] Default to "Unassigned" or "Not evaluated" for unset goals
- [ ] No unexpected goals appearing (remove test data from production)
- [ ] No "100% interest rate" or similar nonsensical labels
- [ ] Typecheck passes

---

### P3 — PRODUCT INTELLIGENCE

---

#### US-015: Define Timeline Intelligence Hierarchy

**Description:** As a developer, I want a clear data hierarchy model so the app answers "What was I doing, where was I, and why does it matter?" correctly.

**Acceptance Criteria:**

- [ ] Document and implement clear hierarchy:
  1. User edits (always highest priority - overrides everything)
  2. Scheduled calendar events (anchors)
  3. Location transitions (segment boundaries)
  4. Device activity / screen time (fill gaps)
  5. Email / communication data (context)
- [ ] User corrections always take precedence
- [ ] Any inference correctable in 2 taps or less
- [ ] Confidence scores displayed for inferred data
- [ ] Low-confidence inferences flagged for user review
- [ ] Typecheck passes

**Technical Notes:**

- Update `/apps/mobile/src/lib/calendar/actual-display-events.ts` to enforce hierarchy
- Ensure `buildActualDisplayEvents()` respects priority order

---

### Cross-Cutting Requirements

---

#### US-016: Setup Flow Stability

**Description:** As a new user, I want the setup/onboarding flow to be stable and consistent so I can complete initial configuration.

**Acceptance Criteria:**

- [ ] Setup flow completes without crashes or hangs
- [ ] Progress persists if user backgrounds app
- [ ] Clear navigation between setup steps
- [ ] No random resets or repeated steps
- [ ] Typecheck passes

---

#### US-017: Explainable App Behavior

**Description:** As a user, I want to understand why the app made certain inferences so I trust the data.

**Acceptance Criteria:**

- [ ] When app auto-categorizes an activity, show brief reason ("Based on location: Home")
- [ ] Confidence indicator for inferred data (high/medium/low)
- [ ] "Why?" affordance to see reasoning for any inference
- [ ] Never change user data without explanation
- [ ] Typecheck passes
- [ ] Verify in browser/simulator

---

## Functional Requirements

### System UI & Platform

- **FR-1:** All screens must use `SafeAreaView` as root container with proper insets
- **FR-2:** Headers must account for notch (iOS) and status bar (Android) heights
- **FR-3:** Floating elements must use `useSafeAreaInsets()` for positioning
- **FR-4:** Android date/time pickers must save state immediately without modal loops

### Timeline & Events

- **FR-5:** All timeline blocks must be tappable to open edit interface
- **FR-6:** Edit interface must support: title, description, time range, category, location, goals
- **FR-7:** Split action must be available on all timeline blocks via edit modal
- **FR-8:** Calendar events must merge into timeline with visual distinction
- **FR-9:** Location transitions must create segment boundaries in timeline
- **FR-10:** "Unknown" blocks must be fully editable with no restrictions

### Data Hierarchy

- **FR-11:** User edits always override all other data sources
- **FR-12:** Calendar events take precedence over auto-detected activity
- **FR-13:** Auto-detected activity takes precedence over email-derived data
- **FR-14:** Confidence scores must be calculated and stored for all inferences

### Location

- **FR-15:** Background location tracking must detect meaningful transitions (>500m or user-defined geofence)
- **FR-16:** Users can define named locations (home, work, gym) in settings
- **FR-17:** Location labels must appear in timeline segment headers when available
- **FR-18:** Location data must be battery-efficient (coarse tracking with fine-grained geofences)

### Goals & Attribution

- **FR-19:** Goal attribution must use user's actual goals, not test/placeholder data
- **FR-20:** Completion percentages only shown when user explicitly sets them
- **FR-21:** Big 3 selection must show actual user-defined Big 3 items

### Visual Feedback

- **FR-22:** Timeline blocks must have distinct visual states: Default, Confirmed, Edited, Scheduled
- **FR-23:** Color changes must always correspond to meaningful state transitions
- **FR-24:** State meanings must be documented in-app (legend or tooltip)

### Email & Sync

- **FR-25:** Email sync must retrieve last 24 hours minimum
- **FR-26:** Email must be properly filtered by inbox vs archive
- **FR-27:** Account permissions must be validated before sync attempts

---

## Non-Goals (Out of Scope)

- Push notifications for timeline corrections
- Automatic calendar event creation from detected activities
- Social sharing of timeline data
- Third-party app integrations beyond email/calendar
- Apple Watch or wearable integrations
- Offline-first architecture changes
- Machine learning model retraining
- Multi-user or family timeline features

---

## Design Considerations

### Interaction Model (Combination Approach)

- **Inline editing:** Tap timeline block to see quick preview with key info
- **Modal editing:** "Edit" button or second tap opens full edit modal
- **Swipe actions:** Swipe left for quick actions (delete, Big 3 toggle)

### Visual States

| State            | Color             | Meaning                       |
| ---------------- | ----------------- | ----------------------------- |
| Default/Inferred | Light gray border | System-detected, not reviewed |
| Confirmed        | Green accent      | User verified as correct      |
| Edited           | Blue accent       | User modified                 |
| Scheduled        | Purple accent     | From calendar                 |

### Timeline Segment Headers

- Show location label when available: "Home", "Office", "Starbucks on Main St"
- Show time range: "9:00 AM - 11:30 AM"
- Show confidence indicator for inferred segments

---

## Technical Considerations

### Existing Components to Leverage

- `EventEditorModal` - extend for full editability
- `ActualAdjustTemplate` - add split action activation
- `LocationSearchModal` - user-defined geofences
- `buildActualDisplayEvents()` - enforce data hierarchy
- `requestReviewTimeSuggestion()` - title extraction from user notes

### Key Files to Modify

- `/apps/mobile/src/lib/calendar/actual-display-events.ts` - timeline building logic
- `/apps/mobile/src/lib/supabase/services/location-samples.ts` - geofencing
- `/apps/mobile/src/components/templates/ActualAdjustTemplate.tsx` - edit UI
- `/apps/mobile/src/components/molecules/EventEditorModal.tsx` - modal editor
- `/apps/mobile/src/app/actual-adjust.tsx` - split action activation
- `/apps/mobile/src/stores/events-store.ts` - state definitions

### Dependencies

- `react-native-safe-area-context` - already installed
- Location services - already implemented
- Supabase edge functions - already deployed

### Performance Considerations

- Location sampling already battery-optimized (background source only)
- Geofence checks should be < 10ms per check
- Timeline rebuild should complete in < 100ms

---

## Success Metrics

- **Editability:** Users can modify any timeline block in 2 taps or less
- **Accuracy:** Location transitions reduce "Unknown" blocks by 70%
- **Calendar Integration:** 100% of scheduled calendar events appear in timeline
- **Trust:** User-reported data accuracy increases (survey metric)
- **Completion:** Setup flow completion rate > 90%
- **Platform Parity:** All features work identically on iOS and Android (except platform-specific fixes)

---

## Open Questions

1. Should location-based segments auto-merge if user stays in same location for extended period?
2. What's the minimum confidence threshold for showing inferred activities vs marking as "Unknown"?
3. Should sleep blocks have different edit affordances than other timeline blocks?
4. How should conflicts between multiple calendar sources (Google + Apple + Outlook) be resolved?
5. Should users be able to "dismiss" inferred blocks they don't want to categorize?

---

## Implementation Phases

### Phase 1: Critical Fixes (P0)

- US-001: Safe area violations
- US-002: Date/time handling
- US-003: Event creation time lock (Android)
- US-005: Timeline block editability
- US-007: Calendar events in timeline

### Phase 2: Location & Intelligence (P0 continued)

- US-004: Location-based segmentation
- US-006: Split action for timeline blocks
- US-015: Timeline intelligence hierarchy

### Phase 3: UX Polish (P1)

- US-008: Goals/Big 3 attribution
- US-009: Visual state feedback
- US-010: Sleep data editing
- US-011: Event title auto-promotion
- US-012: Create vs Edit normalization (Android)

### Phase 4: Data Trust (P2 + P3)

- US-013: Email sync freshness
- US-014: Remove arbitrary percentages
- US-016: Setup flow stability
- US-017: Explainable app behavior

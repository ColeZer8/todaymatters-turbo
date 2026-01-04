# Screen Time → Calendar Actual Blocks (Distracted Annotation)

- Status: Completed
- Owner: Cole
- Started: 2026-01-04
- Completed: 2026-01-04

## Objective

Use iOS Screen Time data we already collect to populate/annotate the **Actual** column in the planned vs actual calendar—without changing UI layout/styling.

## Plan

1. Derive “Screen Time” actual blocks from cached hourly Screen Time buckets.
2. Annotate overlapping planned/actual blocks with a “Distracted: X min on phone” description (e.g., Family Dinner).
3. Wire this derivation into the calendar page (page layer) using `ios-insights` cached Screen Time summary + light auto-sync.

## Done Criteria

- Actual calendar column uses real Screen Time data for today when available.
- Planned/actual blocks that overlap Screen Time get a “Distracted …” note (no new UI components).
- No new UI/layout changes; changes are data-only.

## Progress

- 2026-01-04: Identified calendar source (`ComprehensiveCalendarTemplate`) and hardcoded demo `actualEvents` including “Screen Time”. Located Screen Time data source via `ios-insights` (`ScreenTimeSummary` with hourly buckets + top apps).

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅

## Outcomes

- Actual calendar column uses derived Screen Time data (when available) to:
  - Annotate overlapping blocks with phone-use distraction (Family blocks prioritized).
  - Convert sleep overlap into “Started late …” and optionally insert a pre-sleep Screen Time block when it won’t overlap other non-digital events.
  - Render standalone Screen Time blocks only in open time.

## Follow-ups

- Add per-app/per-interval Screen Time segments when native module supports it (current API is hourly buckets + top apps).


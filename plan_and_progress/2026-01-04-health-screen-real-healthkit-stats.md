# Health Screen: Show Real Apple Health Stats (Steps/Sleep/Active Energy)

- Status: Completed
- Owner: Cole
- Started: 2026-01-04
- Completed: 2026-01-04

## Objective

Keep the existing Category Health UI for the Health category, but populate the “habit” stats with real Apple Health metrics we already pull on iOS (steps, sleep). Replace the “water” placeholder with a metric we can track reliably (active energy).

## Plan

1. Fetch `HealthSummary` in the Health category page (Expo Router screen) based on selected range.
2. Pass the summary + callbacks down into `CategoryHealthTemplate` (no fetching inside templates).
3. In the template, for the `health` category only, replace the displayed habit tracker values with real metrics when available while keeping the same layout and interactions.

## Done Criteria

- Health category screen keeps the same UI layout and navigation behavior.
- On iOS dev client (with native module), steps + sleep show real values; water is replaced by a real metric (active energy).
- Other categories (Faith/Family/Work) are unchanged.

## Progress

- 2026-01-04: Wired Health category page to fetch `HealthSummary` by selected range, and updated Health category UI to display real Steps + Sleep + Active Energy (replacing Water).

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅ (existing warnings remain)
- Manual: Navigate Home → Health category; verify real values appear after tapping “↻ Live Updates” on iOS.

## Outcomes

- Health category screen keeps the existing `CategoryHealthTemplate` layout, but shows real Apple Health values for:
  - Steps (`HealthSummary.steps`)
  - Sleep (`HealthSummary.sleepAsleepSeconds`)
  - Active Energy (`HealthSummary.activeEnergyKcal`) — replaces the old “Water” placeholder

## Follow-ups

- Consider deriving “score/breakdown” and chart from real metrics once goals are formalized.



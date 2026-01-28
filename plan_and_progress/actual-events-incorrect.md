# Actual Events Incorrect

- Status: In Progress
- Owner: cole
- Started: 2026-01-27
- Completed: -

## Objective

Identify why actual events include "test" or wrong times and fix actual event derivation to use real data (screen time/location) with "unknown" when data is missing.

## Plan

1. Inspect actual event derivation and predictive/verification paths.
2. Correct data selection, filtering, and time grouping rules.
3. Validate against the reported screenshots and update logic.

## Done Criteria

- Actual events no longer include predictive/placeholder entries like "test".
- Actual timeline reflects screen time/location data or "unknown" when missing.
- Grouping/splitting aligns with real usage windows.

## Progress

- 2026-01-27: Scoped actual derivation; gated planned-actuals to evidence only, filtered stored derived actuals, and reduced usage-summary fallbacks.
- 2026-01-27: Removed Android foreground capture fallback after runtime EventEmitter crash.
- 2026-01-27: Removed geohash-based location descriptions; keep labels or unknown only.

## Verification

- Not run yet.

## Outcomes

- Pending.

## Follow-ups

- Pending.

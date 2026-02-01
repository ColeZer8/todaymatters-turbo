# Actual Place Labeling in Adjust Actual

- Status: In Progress
- Owner: Cursor
- Started: 2026-01-31
- Completed: -

## Objective

Show place labeling controls in Adjust Actual by preserving location metadata on derived events.

## Plan

1. Trace event meta from ingestion through calendar fetch to UI.
2. Fix meta parsing so location coordinates survive.
3. Verify Adjust Actual shows the label section.

## Done Criteria

- Derived actual events retain `meta.latitude`/`meta.longitude`.
- Adjust Actual shows the place label section for location-derived events.

## Progress

- 2026-01-31: Found meta guard dropping derived event metadata; loosened check.
- 2026-01-31: Added location coords/place info to evidence blocks.
- 2026-01-31: Allow place labels from coordinates when samples missing.
- 2026-01-31: Route session blocks back to Adjust Actual.
- 2026-01-31: Use WKT for user_place center + parse WKT.
- 2026-01-31: Store background samples in native queue and drain on foreground.

## Verification

- Commands run (lint/typecheck/build) and results
- Manual QA steps as needed

## Outcomes

- What changed (links to PRs/commits)
- Impact/tradeoffs

## Follow-ups

- Remove temporary debug logs once confirmed.

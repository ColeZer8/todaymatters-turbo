# Location Actual Events Robustness

- Status: In Progress
- Owner: Cole
- Started: 2026-01-22
- Completed: -

## Objective

Improve location-based actual event creation so movement and transitions are reliably captured.

## Plan

1. Review actual display filtering and evidence sync constraints.
2. Improve location block generation for movement/transition detection.
3. Validate behavior against sample data and update docs if needed.

## Done Criteria

- Location evidence produces actual blocks for movement/transition hours.
- Actual calendar persists location blocks without manual intervention.

## Progress

- 2026-01-22: Started investigation; gathered location_hourly samples showing no labels.
- 2026-01-22: Updated location block generation to split by geohash, detect transitions, and tolerate partial planned overlap.

## Verification

- Not run yet.

## Outcomes

- TBD

## Follow-ups

- Add QA checklist for location evidence in demo data.

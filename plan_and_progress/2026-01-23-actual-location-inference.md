# Actual Location + Screen Time Inference

- Status: In Progress
- Owner: Cole
- Started: 2026-01-23
- Completed: -

## Objective

Infer location-based actual blocks (driving/places) and merge screen time
annotations so the Actual column is useful even when activity is unknown.

## Plan

1. Verify current evidence inputs and gaps for location/screen time.
2. Add location-derived actual blocks for unknown gaps.
3. Merge screen time annotations onto location-derived blocks.
4. Support user overrides for inferred locations.
5. Verify in calendar and review-time flows.

## Done Criteria

- Unknown gaps produce location-based actual blocks (place + commute).
- Screen time annotations attach to inferred blocks without replacement.
- Users can override inferred locations and persist changes.

## Progress

- 2026-01-23: Added location-derived actual blocks, commute inference, and screen time annotations.
- 2026-01-23: Restored screen time actual blocks to override sleep and avoid location conflicts.

## Verification

- Not run (not requested).

## Outcomes

- TBD

## Follow-ups

- TBD

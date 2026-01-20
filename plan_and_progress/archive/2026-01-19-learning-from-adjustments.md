# Learning From User Adjustments

- Status: Completed
- Owner: Codex
- Started: 2026-01-19
- Completed: 2026-01-19

## Objective

Teach the app to learn from user recategorizations in two ways:
1) app-level classification overrides, and 2) stronger pattern influence for corrected events.

## Plan

1. Define learning data model + persistence for app overrides.
2. Wire recategorization capture to update overrides and expose them in classification.
3. Weight corrected events in pattern learning.

## Done Criteria

- Overrides are stored per user and applied to app classification.
- Corrections influence pattern suggestions via learned weighting.
- Documentation updated to reflect the learning system.

## Progress

- 2026-01-19: Started implementation plan for learning from user adjustments.
- 2026-01-19: Added user app override persistence + client wiring, and weighted learned events in patterns.

## Verification

- Not run (logic + schema changes only).

## Outcomes

- Added per-app override learning and pattern weighting to the mobile pipeline.

## Follow-ups

- Pending.

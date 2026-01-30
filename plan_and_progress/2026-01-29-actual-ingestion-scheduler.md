# Actual Ingestion Scheduler

- Status: In Progress
- Owner: colezerman
- Started: 2026-01-29
- Completed: -

## Objective

Wire the actual ingestion pipeline to run on 30-minute boundaries (:00/:30), catch up missed windows on foreground, and run in the background when possible.

## Plan

1. Review existing ingestion hook and app lifecycle wiring points.
2. Add a scheduler hook that aligns to half-hour boundaries and calls ingestion.
3. Wire the scheduler in the app layout alongside other sync hooks.

## Done Criteria

- Scheduler triggers ingestion at :00/:30 using the existing 30-minute windows.
- Foreground catch-up runs missed windows safely.
- No changes to ingestion logic beyond scheduling.

## Progress

- 2026-01-29: Added scheduler hook, wired into layout, restored blank future actuals, and added background fetch task.
- 2026-01-29: Added Android screen-time session fallback from hourly data.

## Verification

- Not run yet.

## Outcomes

- Added ingestion scheduler, background fetch, and surfaced screen-time/location evidence in actual-adjust.

## Follow-ups

- Consider background fetch integration if required.

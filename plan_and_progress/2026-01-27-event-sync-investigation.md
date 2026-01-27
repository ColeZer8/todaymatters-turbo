# Event Sync Investigation (Ideal/Planned/Actual)

- Status: In Progress
- Owner: Assistant
- Started: 2026-01-27
- Completed: -

## Objective

Verify that ideal/planned/actual events are saved to Supabase correctly and identify why a user has no stored actual events for a day despite on-device collection.

## Plan

1. Map the data flow for ideal, planned, and actual events from app to Supabase.
2. Validate schema columns for evidence tables causing query errors.
3. Identify potential sync gaps and propose targeted verification queries.

## Done Criteria

- Evidence schema confirmed (correct column names).
- Ideal/planned/actual write paths identified.
- Clear explanation of likely failure point and verification steps.

## Progress

- 2026-01-27: Confirmed screen time sessions use `started_at`/`ended_at`/`local_date` columns; mapped ideal day + planned event write paths.

## Verification

- None (investigation only).

## Outcomes

- TBD

## Follow-ups

- TBD

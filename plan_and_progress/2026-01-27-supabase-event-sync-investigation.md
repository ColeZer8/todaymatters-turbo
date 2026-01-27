# Supabase Event Sync Investigation

- Status: In Progress
- Owner: AI
- Started: 2026-01-27
- Completed: -

## Objective

Identify why stale or deleted events still appear in the mobile calendar and fix the sync logic so the UI reflects current Supabase data.

## Plan

1. Locate event sync + fetch logic between Supabase and mobile calendar.
2. Reproduce the stale events path and identify the source of duplicates.
3. Implement and verify a fix for event reconciliation/deletion.

## Done Criteria

- Events removed from Supabase no longer render in the calendar.
- Sync logic reliably updates status for existing events.
- No duplicate or phantom events appear for the same time range.

## Progress

- 2026-01-27: Logged investigation kickoff and gathered user report.
- 2026-01-27: Isolated `public.events` merge as source of ghost events.

## Verification

- Commands run (lint/typecheck/build) and results
- Not run (not requested)
- Manual QA steps as needed

## Outcomes

- What changed (links to PRs/commits)
- Impact/tradeoffs

## Follow-ups

- Deferred items or next steps

# iOS Location Tracking (Background + Hourly Summaries)

- Status: In Progress
- Owner: Cursor Agent
- Started: 2026-01-12
- Completed: -

## Objective

Collect iOS location data in production using Expo-supported APIs so we can compare a user’s planned schedule to their actual day (meeting vs lunch vs commute, etc.).

## Plan

1. Use Expo `expo-location` + `expo-task-manager` to collect background location updates on iOS only.
2. Queue raw samples locally; flush to Supabase when authenticated.
3. Add Postgres schema for raw samples + hourly aggregation view (and RLS).

## Done Criteria

- iOS-only background location task is wired and gated behind authentication.
- Location samples are queued locally and flushed to Supabase without duplicates.
- SQL exists for raw samples + hourly view and matches app insert shape.
- `pnpm --filter mobile check-types` passes for edited files.

## Progress

- 2026-01-12: Started research + codebase audit; identified `_layout.tsx` as the right authenticated mount point for collection and syncing.

## Verification

- Pending

## Outcomes

- Pending

## Follow-ups

- Add Android implementation (mirroring the same schema + hourly semantics).
- Add UX surface to explain and request “Always” permission at the right moment in onboarding.



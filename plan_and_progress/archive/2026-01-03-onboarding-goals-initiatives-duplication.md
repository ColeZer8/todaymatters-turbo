# Onboarding Goals/Initiatives Duplication Fix

- Status: Completed
- Owner: colezerman
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

Stop Goals and Work Initiatives from multiplying each time a user revisits onboarding.

## Plan

1. Trace how onboarding Goals/Initiatives are stored and synced to Supabase.
2. Fix the server sync to be truly idempotent (replace + dedupe).
3. Dedupe persisted onboarding state on hydration so stale duplicates disappear.

## Done Criteria

- Revisiting the onboarding Goals step does not create or display duplicate Goals/Initiatives.
- Saving Goals/Initiatives to Supabase is idempotent across repeated saves with unchanged values.

## Progress

- 2026-01-03: Root cause identified: Goals step debounced “bulk save” could repeatedly insert duplicates when server-side replacement wasn’t reliably deleting prior rows; stale duplicates then rehydrated into onboarding store.
- 2026-01-03: Implemented robust id-based replacement + dedupe at both save-time and hydration-time.

## Verification

- `pnpm --filter mobile check-types` (pass)
- `pnpm --filter mobile lint` (pass)
- Manual: revisit onboarding Goals step multiple times; confirm Goals/Initiatives list remains stable (no multiplication).

## Outcomes

- Supabase bulk save now deletes existing goals/initiatives **by fetched IDs** and inserts a **deduped** title list.
- Onboarding persisted state dedupes `goals` / `initiatives` on hydration for immediate UI cleanup.

## Follow-ups

- Consider consolidating goals/initiatives storage (onboarding vs profile/events) if we see further drift.

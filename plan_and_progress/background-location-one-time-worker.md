# Background Location One-Time Worker

- Status: In Progress
- Owner: Cole
- Started: 2026-01-31
- Completed: -

## Objective

Provide a manual, immediate trigger for the Android WorkManager background location worker to verify native background capture without waiting for periodic scheduling.

## Plan

1. Add a native module method for one-time worker execution.
2. Expose the method in the JS wrapper.
3. Add a dev screen action to trigger the one-time worker and refresh status.

## Done Criteria

- A one-time background worker can be triggered from the dev screen.
- Native pending samples update (or explicit error shown) after trigger.

## Progress

- 2026-01-31: Added one-time WorkManager trigger and dev UI action.
- 2026-01-31: Added dev UI flush-to-Supabase action.
- 2026-01-31: Enabled Android foreground service background updates with fallback.
- 2026-01-31: Increased Android foreground update frequency and added task diagnostics.

## Verification

- Not run yet.

## Outcomes

- Native module exposes one-time worker execution.
- Dev screen can trigger a one-time background run and refresh status.
- Dev screen can flush native samples to Supabase on demand.
- Android now prefers continuous foreground-service updates.
- Dev screen shows foreground task diagnostics and last task activity.

## Follow-ups

- Decide whether to add expedited or constraints for debug runs.

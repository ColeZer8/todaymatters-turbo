# Screen Time physical device sync + invisible report

- Status: In Progress
- Owner: colezerman
- Started: 2025-12-30
- Completed: -

## Objective

Restore Screen Time syncing on physical devices while keeping the report-generation UI invisible and rendering results in the React Native Screen Time UI.

## Plan

1. Make the native module backward-compatible with legacy method names/keys so a rebuilt app reliably exposes required methods.
2. Ensure the report extension writes to the expected shared keys and the app reads with fallback.
3. Verify iOS build succeeds and the Screen Time screen syncs without presenting a second screen.

## Done Criteria

- Screen Time sync works on a physical iPhone (today + range) with no visible report screen.
- React Native Screen Time screen populates totals/top apps/hourly data.
- iOS build passes.

## Progress

- 2025-12-30: Investigating physical device method mismatch and App Group cache key compatibility.

## Verification

- pnpm --filter mobile check-types
- pnpm --filter mobile lint
- pnpm --filter mobile ios

## Outcomes

- Pending.

## Follow-ups

- Add a small in-app debug panel (dev-only) to show available native methods + last cache timestamps.



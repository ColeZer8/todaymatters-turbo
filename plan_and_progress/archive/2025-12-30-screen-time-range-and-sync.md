# Screen Time — Range Toggle + Invisible Sync (No Black Report Screen)

- Status: Completed
- Owner: cole
- Started: 2025-12-30
- Completed: 2025-12-30

## Objective

Make the Screen Time page feel like a first-class Today Matters screen:

- **No visible “black report” screen** during refresh (sync runs invisibly).
- Range toggle (**Today / Week / Month / Year**) is functional and drives real data.
- Remove “connected / we sync…” copy; only show messaging when permission is required or an error occurs.

## Plan

1. Update the iOS report extension to generate and cache summaries per range.
2. Update the iOS native module + JS bindings to request a report for a given range and read cached results.
3. Wire the RN Screen Time page to range state and auto-sync per range.
4. Verify via `pnpm --filter mobile check-types` and `pnpm --filter mobile lint`. (Dev client rebuild may be required.)

## Done Criteria

- Range toggles work and update totals/top apps.
- No visible report UI appears during auto-sync.
- Screen UI matches our design language and removes unnecessary “connected” status copy.

## Progress

- 2025-12-30:
  - Implemented range-based Screen Time report syncing (Today/Week/Month/Year) with per-range cache keys.
  - Removed the visible report UI during sync by presenting the report host over-current-context with full transparency + no interaction.
  - Removed “connected / we sync…” copy from the UI; status row now appears only when permissions are needed or when an error occurs.
  - Added hourly bucket data to the cached summary for Today (best-effort from DeviceActivity segments).
  - Verified TypeScript + ESLint for mobile.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅

## Notes

- iOS changes touch the native module + report extension; if you’re running an older dev client you may need to rebuild the iOS app (`pnpm --filter mobile ios`) for the new range APIs to take effect.



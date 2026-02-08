# Codebase Audit — 2026-02-08

## 1. Calendar Migration Files Audit

### `src/lib/hooks/use-location-blocks-for-day.ts`
- **FIXED**: `refresh()` didn't set `isLoading` state — users saw stale data during manual refresh
- **Good**: Inference caching is solid (per-userId, invalidated on refresh)
- **Good**: Matches LocationBlockList.tsx's data flow steps 1-6 faithfully
- **Note**: Inference cache is only invalidated on explicit refresh or userId change. Date changes don't invalidate it, which is correct since inference spans 14 days

### `src/lib/calendar/location-blocks-to-events.ts`
- **FIXED**: Duration calculation failed when `endMinutes <= startMinutes` (midnight-spanning blocks). Now falls back to `block.durationMinutes` from the source data
- **Good**: Gap-filling logic is sound — 5-minute minimum, 50% overlap threshold for sleep detection
- **Good**: Overlap filtering uses midpoint check which is a reasonable heuristic
- **Edge case noted**: `dateToMinutesFromMidnight` clamps to [0, 1440]. Blocks starting before midnight but ending after are truncated to end-of-day. This is acceptable for day-view rendering

### `src/lib/calendar/simple-verification.ts`
- **Clean**: Well-structured, under 150 lines as intended
- **Assumption documented**: `minutesFromMidnight()` uses `getHours()/getMinutes()` which works correctly for same-day blocks (the only use case)
- **Note**: `CATEGORY_LOCATION_MAP` doesn't include `"free"`, `"social"`, `"family"`, `"digital"`, or `"comm"` categories. These default to "no expectation → can't contradict" which is reasonable
- **Note**: Division by zero impossible since `event.duration` can't be 0 in ScheduledEvent (enforced elsewhere)

## 2. Files Importing from `actual-display-events.ts` (deprecated)

These files still import from the deprecated 3,453-line monster. They're needed for the legacy pipeline rollback and for `actual-adjust`/`actual-split` screens:

| File | Imports | Status |
|------|---------|--------|
| `src/app/comprehensive-calendar.tsx` | `buildActualDisplayEvents`, `DERIVED_ACTUAL_PREFIX`, `DERIVED_EVIDENCE_PREFIX` | **Required** — legacy pipeline fallback behind feature flag |
| `src/components/templates/ComprehensiveCalendarTemplate.tsx` | `DERIVED_ACTUAL_PREFIX`, `DERIVED_EVIDENCE_PREFIX` | **Required** — used for event ID prefix checks |
| `src/app/actual-adjust.tsx` | Various types/utilities | **Required** — adjust screen uses old pipeline types |
| `src/app/actual-split.tsx` | Various types/utilities | **Required** — split screen uses old pipeline types |
| `src/lib/calendar/index.ts` | Re-exports everything | **Barrel file** — keep until deprecation is complete |

**Recommendation**: Once `useNewLocationPipeline` is permanently enabled, extract only the needed constants (`DERIVED_ACTUAL_PREFIX`, `DERIVED_EVIDENCE_PREFIX`) into a small constants file and delete the monster.

## 3. TODO/FIXME/HACK Comments

| File | Comment | Priority |
|------|---------|----------|
| `src/constants/churches.ts:11` | `TODO: Replace with the purchased national dataset (e.g. Barna)` | Low — feature not user-facing yet |
| `src/components/templates/HomeTemplate.tsx:12,87` | `TODO: Re-enable ElevenLabs voice coach integration` | Medium — feature disabled |

Only 3 TODOs in the entire codebase — very clean.

## 4. Unused Imports / Dead Code

No significant unused imports found in key files. The codebase is quite clean:
- Calendar-related modules are all referenced
- Store exports in `stores/index.ts` are all consumed
- Template imports are all used

## 5. Inconsistent Patterns

- **`supabase as any`**: Used in both `use-location-blocks-for-day.ts` and `LocationBlockList.tsx` for `.schema("tm")` calls. This is a known Supabase typing limitation — not a code issue
- **Date formatting**: Mix of manual `getFullYear()-getMonth()-getDate()` and `dateToYmd()` helper. The helper exists in `comprehensive-calendar.tsx` but isn't exported. Could be centralized
- **Error handling**: Both the hook and LocationBlockList use try/catch with console.warn for non-critical errors and setError for critical ones — consistent pattern

## 6. Git Status

- Working tree clean (no uncommitted changes)
- Currently on branch: `ralph/data-pipeline-phase1`
- Stale branches noted:
  - `main-backup-20260128` — backup branch, can be deleted after confirming main is good
  - `ralph/calendar-actual-timeline-fix` — may be merged already
  - `ralph/critical-flow-data-issues` — check if merged
  - `ui-baseline` — historical reference

## 7. Performance Observations

### ComprehensiveCalendarTemplate (1,191 lines)
- Uses `useMemo` and `useCallback` appropriately (5 instances found)
- `combinedActualEvents` in comprehensive-calendar.tsx is properly memoized
- **Potential issue**: `combinedActualEvents` useMemo has a large dependency array (13 deps). Any change to any dep triggers recalculation of the entire actual event list. The new pipeline simplifies this significantly (only depends on `locationBlocks`, `displayActualEvents`, `plannedEvents`, `selectedDateYmd`)

### Calendar Page (comprehensive-calendar.tsx)
- **Good**: Feature flag pattern allows clean A/B between old and new pipeline
- **Good**: Real-time Supabase channel subscriptions properly cleaned up
- **Note**: 30-minute polling interval for actual events refresh is reasonable

### Activity Timeline
- **Not touched** per Cole's explicit rule
- LocationBlockList.tsx has good performance patterns (FlatList, keyExtractor, memoized callbacks)

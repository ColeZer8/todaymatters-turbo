# Supabase tm schema sync (services + onboarding wiring)

- Status: Completed
- Owner: colezerman
- Started: 2026-01-02
- Completed: 2026-01-02

## Objective

Align the mobile app’s Supabase integration with the updated `tm` schema so onboarding + core flows persist cleanly with correct table/column contracts and minimal refactoring.

## Plan

1. Confirm latest migrations and the intended `tm.*` table contracts.
2. Audit app Supabase usage for stale table/column/type assumptions.
3. Patch services/hooks/screens surgically to match the new schema and remove outdated fallbacks.
4. Verify via TypeScript typecheck (and lint if needed) for `apps/mobile`.

## Done Criteria

- `apps/mobile/src/lib/supabase/**` uses `tm` schema tables matching latest migrations.
- No stale references to pre-`tm` tables/columns in the onboarding + core flows.
- `pnpm --filter mobile check-types` passes.

## Progress

- 2026-01-02: Reviewed latest migrations for `tm.profiles`, `tm.profile_values`, `tm.events`, `tm.routines`, and ideal-day tables; audited current service/hook usage in `apps/mobile`.

## Verification

- ✅ `pnpm --filter mobile check-types`
- ✅ `pnpm --filter mobile lint`

## Outcomes

- Service layer and hooks aligned with updated `tm` schema contracts; removed outdated fallbacks that obscured schema mismatches.

## Follow-ups

- Move this file to `plan_and_progress/archive/` (completion housekeeping).



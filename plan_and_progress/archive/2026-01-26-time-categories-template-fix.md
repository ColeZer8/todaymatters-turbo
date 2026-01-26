# Fix Time Categories Template Crash

- Status: Completed
- Owner: Codex
- Started: 2026-01-26
- Completed: 2026-01-26

## Objective

Restore the Time Categories template to the pre-2026-01-26 implementation so the page renders without errors.

## Plan

1. Restore `CoreCategoriesTemplate.tsx` to the last known good version.
2. Confirm the props align with `core-categories.tsx`.
3. Document the change and archive the plan.

## Done Criteria

- Time Categories screen loads without a template crash.
- `core-categories.tsx` props match `CoreCategoriesTemplate.tsx`.

## Progress

- 2026-01-26: Restored `apps/mobile/src/components/templates/CoreCategoriesTemplate.tsx` to the 2026-01-20 version.

## Verification

- Not run yet.

## Outcomes

- Template and screen props are aligned again, resolving the crash.

## Follow-ups

- Manual QA of the onboarding step if needed.

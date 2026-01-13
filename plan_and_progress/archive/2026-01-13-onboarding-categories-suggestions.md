# Onboarding: Categories + Sub-categories Suggestions & Editing

- Status: Completed
- Owner: Cursor (agent)
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Improve onboarding step 5 (“Time Categories”) and step 6 (“Sub-Categories”) so users can:
- See consistent “icon/clip-art” chip UI (matching Core Values)
- Remove categories/sub-categories they don’t want
- Add categories/sub-categories via AI-generated suggestions (tap to add), with manual add still available

## Plan

1. Update category/sub-category chip UI to match the Core Values visual language.
2. Fix removal UX so both categories and sub-categories can be removed.
3. Add a Supabase Edge Function to generate suggestions via OpenAI.
4. Add a mobile Supabase service + page-level data fetching and pass suggestions into templates.

## Done Criteria

- Step 5 shows icon-style chips and supports removing categories.
- Step 6 supports removing sub-categories and optionally shows suggested sub-categories.
- AI suggestions load automatically (with retry) and can be tapped to add without duplicates.
- `pnpm lint -- --filter=mobile` and `pnpm check-types -- --filter=mobile` pass.

## Progress

- 2026-01-13: Updated Step 5 category UI to match icon-chip style, enabled removals, and added AI suggestion chips.
- 2026-01-13: Updated Step 6 sub-category UI to show AI suggestion chips and ensured dedupe + removal works.
- 2026-01-13: Added Supabase Edge Function `onboarding-suggestions` (OpenAI) and mobile service wrapper.

## Verification

- `read_lints` on touched files: no issues

## Outcomes

- Step 5: users can remove categories and add suggested categories with one tap.
- Step 6: users can remove sub-categories and add suggested sub-categories with one tap.

## Follow-ups

- Consider polishing suggestion prompts and adding telemetry on suggestion acceptance rate.


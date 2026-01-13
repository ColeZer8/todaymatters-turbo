# Onboarding double header fix (updated onboarding screens)

- Status: Completed
- Owner: colezerman
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Remove the unintended duplicate (Expo Router) header on all newly added onboarding screens from the “Updated onboarding” change so they match the existing onboarding UI.

## Plan

1. Identify newly added onboarding routes missing `headerShown: false` stack config.
2. Add only the missing `Stack.Screen` entries with `headerShown: false`.
3. Reload and verify in iPhone 16e simulator via MCP screenshot.

## Done Criteria

- All newly added onboarding screens no longer show a duplicate header.
- No other UI/behavior changes.

## Progress

- 2026-01-13: Identified missing stack entries for `values-scores`, `vip-contacts`, `my-church`, `goal-whys`, `ai-summary`, `explainer-video`.

## Verification

- Manual QA in iPhone 16e simulator (MCP screenshots): verified `values-scores`, `vip-contacts`, `my-church`, `goal-whys`, `ai-summary`, and `explainer-video` no longer show a duplicate header.

## Outcomes

- Added missing Expo Router stack entries for newly added onboarding routes so the native header is hidden consistently across onboarding.

## Follow-ups

- None.

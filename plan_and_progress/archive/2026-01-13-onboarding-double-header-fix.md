# Onboarding double header fix

- Status: Completed
- Owner: colezerman
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Remove the unintended duplicate (Expo Router) header on newly added onboarding screens so they match the existing onboarding UI.

## Plan

1. Identify onboarding routes showing a duplicate header.
2. Apply the smallest possible Expo Router stack configuration change to hide the extra header.
3. Verify in iPhone 16e simulator via MCP screenshot.

## Done Criteria

- Affected onboarding screens no longer show a duplicate header.
- No other UI/behavior changes.

## Progress

- 2026-01-13: Started investigation; identified missing `headerShown: false` stack entries for new onboarding routes.

## Verification

- Manual QA in iPhone 16e simulator (MCP screenshots): verified `core-values`, `core-categories`, and `sub-categories` no longer show a duplicate header.

## Outcomes

- Added missing Expo Router stack entries for new onboarding routes so the native header is hidden consistently across onboarding.

## Follow-ups

- None.

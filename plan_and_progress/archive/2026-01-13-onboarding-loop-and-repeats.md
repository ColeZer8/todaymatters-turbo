# Onboarding loop + repeated screens fix

- Status: Completed
- Owner: colezerman
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Fix onboarding navigation so it no longer repeats screens or loops back to earlier steps near the end.

## Plan

1. Trace `router.replace(...)` transitions across onboarding pages and compare against `ONBOARDING_STEPS`.
2. Fix only miswired next/back routes causing repeats/loops.
3. Verify in iPhone 16e simulator that onboarding reaches the end and exits correctly.

## Done Criteria

- No repeated onboarding steps in the normal forward path.
- Final step does not loop back to earlier onboarding pages.

## Progress

- 2026-01-13: Identified backward navigation from `morning-mindset` → `goals` and `build-routine` → `ideal-day` / back → `goals` causing loops/repeats.

## Verification

- Manual QA in iPhone 16e simulator (MCP): verified `morning-mindset` continues to `build-routine` and final “Looks Good” completes without looping back to earlier onboarding screens.

## Outcomes

- Fixed miswired route transitions near the end of onboarding that caused repeats/looping.

## Follow-ups

- None.

# Add final “Does This Look Right?” screen to onboarding

- Status: Completed
- Owner: Cole
- Started: 2026-01-14
- Completed: 2026-01-14

## Objective

Add the “Does This Look Right?” screen as the final step of the onboarding/setup flow.

## Plan

1. Insert the existing `ai-summary` page at the end of the setup flow.
2. Move onboarding completion (`hasCompletedOnboarding`) to the final confirmation action on that screen.
3. Update step counts so the progress indicator reflects the final step.

## Done Criteria

- After `my-church`, the user lands on “Does This Look Right?” (`ai-summary`).
- Tapping “Looks Good!” completes onboarding and routes to `home`.
- Back routes to `my-church`.

## Progress

- 2026-01-14: Wired `ai-summary` (“Does This Look Right?”) as the final step after `my-church`, moved onboarding completion to “Looks Good!”, and updated setup step counts.

## Verification

- `cursor` lints: no errors on touched files (Cursor diagnostics).

## Outcomes

- `my-church` now routes to `ai-summary` instead of `home`.
- `ai-summary` “Looks Good!” sets `hasCompletedOnboarding=true` and routes to `home`.


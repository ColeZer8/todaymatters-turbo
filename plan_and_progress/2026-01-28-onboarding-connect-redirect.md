# Onboarding connect redirect fix

- Status: In Progress
- Owner: AI
- Started: 2026-01-28
- Completed: -

## Objective

Stop onboarding from redirecting off the sign-in/connect screen to the add
account screen after the initial navigation.

## Plan

1. Locate onboarding auth navigation and redirect logic.
2. Adjust flow so sign-in/connect remains the active route.
3. Verify no regression in add-account flows.

## Done Criteria

- Onboarding stays on the sign-in/connect screen after initial redirect.
- Add-account screen only appears when explicitly chosen.

## Progress

- 2026-01-28: Added auth return path handling for connect flow.

## Verification

- Not run yet.

## Outcomes

- Pending.

## Follow-ups

- None.

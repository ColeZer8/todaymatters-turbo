# Actual adjust screen

- Status: In Progress
- Owner: cole
- Started: 2026-01-16
- Completed: -

## Objective

Add an adjust screen for actual blocks with manual category selection and AI-based classification.

## Plan

1. Build a dedicated adjust screen and template for a selected actual block.
2. Wire AI suggestion via existing review-time suggestion endpoint.
3. Navigate to the adjust screen from actual blocks only.

## Done Criteria

- Tapping an actual block opens the adjust screen for that block.
- Users can manually change category or use AI suggestion to update it.
- Changes save back to actual events.

## Progress

- 2026-01-16: Built actual adjust screen with AI/manual category flow.
- 2026-01-16: Added Big 3, values, and linked goals/initiatives selectors from onboarding data.
- 2026-01-16: Switched review-time-suggest edge function to Anthropic.

## Verification

- Not run yet.

## Outcomes

- Added actual-adjust page with manual and AI-assisted category updates.
- Actual block taps now open the adjust screen with context.
- Adjust screen now uses onboarding values/goals for selections and writes to meta.

## Follow-ups

- None.

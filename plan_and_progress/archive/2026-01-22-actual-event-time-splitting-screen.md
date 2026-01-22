# Actual Event Time Splitting Screen Revert

- Status: Completed
- Owner: Codex
- Started: 2026-01-22
- Completed: 2026-01-22

## Objective

Restore the time splitting screen when tapping an "actual" event, replacing the current review time screen.

## Plan

1. Locate the actual event tap flow and current review time screen routing.
2. Identify the prior time splitting screen implementation (pre "read me ralph" save).
3. Revert just the affected screen and update navigation if needed.

## Done Criteria

- Tapping an actual event shows the time splitting screen (not review time).
- Only the targeted screen reverts; other changes remain untouched.

## Progress

- 2026-01-22: Disabled Review Time shortcut for actual event taps so actual events open the adjust screen.

## Verification

- Not run (not requested).

## Outcomes

- What changed: `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx` routes actual event taps directly to actual adjust, bypassing Review Time.
- Impact: Actual events no longer open the Review Time assignment screen from the calendar.

## Follow-ups

- Deferred items or next steps

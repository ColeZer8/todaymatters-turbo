# Calendar Centering and Grid Polish

- Status: In Progress
- Owner: Codex
- Started: 2025-12-08
- Completed: ->

## Objective

Align the comprehensive calendar view with the current-time marker by default, add clearer hourly grid cues, and prevent overscrolling beyond the 12 AM and 12 PM bounds so the grid feels tight and intentional.

## Plan

1. Review the comprehensive calendar template to understand scroll setup, sizing, and current-time indicator math.
2. Add automatic centering on the current-time line without breaking existing scroll behavior.
3. Strengthen hourly grid visibility and adjust top/bottom padding plus overscroll limits to prevent peeking past 12 AM/12 PM.

## Done Criteria

- Calendar opens with the red current-time line centered (when within the day window) without jarring jumps.
- Hour marks show faint, gray horizontal lines spanning the grid.
- Scrolling is bounded at the start and end of the day (no blank space beyond 12 AM/12 PM), and the 12 AM area no longer feels clipped.

## Progress

- 2025-12-08: Scoped changes and began implementing auto-centering, hourly grid lines, and scroll bounds polish for the comprehensive calendar.
- 2025-12-08: Adjusted grid height handling to show the full day through 11:59 PM and darkened hourly lines for better readability.

## Verification

- Not run yet.

## Outcomes

- Pending.

## Follow-ups

- Pending.

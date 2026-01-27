# Plan: Apple Calendar Features Implementation

Objective: Implement "press and hold to add event" and "current time label on red bar" features inspired by Apple Calendar.

## Scope

- Update `ComprehensiveCalendarTemplate.tsx` to display the current time next to the red indicator line.
- Implement a long-press gesture on the calendar grid to create a temporary 15-minute event.
- Allow dragging the temporary event to a start time.
- On release, trigger the event creation flow.

## Done Criteria

- [ ] Current time label (e.g., "3:02") is visible next to the red dot on the current time indicator.
- [ ] Long-pressing on the calendar grid spawns a 15-minute event block.
- [ ] The spawned block follows the finger (clamped to the grid) while the user is still pressing.
- [ ] Releasing the press opens the event creation screen with the selected start time.
- [ ] The interaction is smooth and matches Apple Calendar's feel.

## Status: Planned

Date: 2026-01-06

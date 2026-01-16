# Investigate Duplicate Sleep On Homepage

- Status: In Progress
- Owner: Cole
- Started: 2026-01-16
- Completed: -

## Objective

Identify why sleep appears twice on the homepage schedule and ensure only the current day's events display, even when sleep spans midnight.

## Plan

1. Inspect data model, query filters, and UI list composition for homepage schedule.
2. Confirm how sleep events are split across days and how "current day" is defined.
3. Adjust filtering or aggregation so only today's events appear once.

## Done Criteria

- Homepage schedule shows a single sleep entry for today, even if sleep spans days.
- Upcoming day sleep entries do not appear on the homepage.
- Logic is documented in code/comments where needed.

## Progress

- 2026-01-16: Traced homepage schedule data flow; updated Home/ScheduleList to use today's events and collapse duplicate sleep schedule entries.

## Verification

- Manual QA: verify homepage schedule on a sleep span day.

## Outcomes

- Pending.

## Follow-ups

- Add regression coverage if needed.

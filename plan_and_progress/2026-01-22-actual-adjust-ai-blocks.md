# Actual Adjust AI Blocks Fix

- Status: In Progress
- Owner: Codex
- Started: 2026-01-22
- Completed: -

## Objective

Fix the "tell us what really happened" AI summary time mismatch and ensure user input triggers proper AI categorization and event renaming instead of leaving the title as "unknown".

## Plan

1. Inspect the data flow for actual events, AI summary generation, and renaming logic.
2. Fix time sourcing so the AI summary matches the actual time block.
3. Fix renaming so AI output updates the event title when user input is provided.

## Done Criteria

- AI summary uses the same start/end times as the actual event block.
- User input results in a categorized event with a brief AI-generated title (no lingering "unknown").
- Changes are validated with a manual walkthrough.

## Progress

- 2026-01-22: Inspected actual-adjust and review-time-suggest flow; added AI fallback handling and stronger prompt/validation.

## Verification

- Manual QA: adjust an actual event, enter text, confirm AI summary time matches block and title updates.

## Outcomes

- TBD

## Follow-ups

- TBD

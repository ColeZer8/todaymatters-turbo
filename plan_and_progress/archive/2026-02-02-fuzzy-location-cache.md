# Fuzzy location cache + labels

- Status: Completed
- Owner: Cole
- Started: 2026-02-02
- Completed: 2026-02-02

## Objective

Apply fuzzy reverse-geocoding labels in sessionization and match cached Google place names within a radius.

## Plan

1. Wire fuzzy labels into the actual ingestion pipeline.
2. Update the hourly location view to match cached places within a radius.
3. Summarize setup/notes.

## Done Criteria

- Session blocks get fuzzy labels when configured.
- Cached Google place names associate within a radius.

## Progress

- 2026-02-02: Wired fuzzy labels + cache radius match.

## Verification

- Not run (code changes only).

## Outcomes

- Added fuzzy reverse-geocoding labels in ingestion.
- Added radius-based matching for cached Google place names.

## Follow-ups

- None yet.

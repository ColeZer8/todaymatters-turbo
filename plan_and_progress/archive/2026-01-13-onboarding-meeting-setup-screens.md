# Onboarding meeting “Setup Screens” flow

- Status: Completed
- Owner: Cole
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Make onboarding show only the “Setup Screens” needed for the client meeting (per screenshot), and update the Church screen to a type-ahead dropdown + improve the default Core Values list.

## Plan

1. Audit existing onboarding/setup routes and current navigation chain.
2. Rewire the flow so only the desired pages are reachable in sequence; keep the rest in code but out of the main path.
3. Update “My Church” to a searchable dropdown (type-ahead) with a fallback for manual entry.
4. Expand/curate the default Core Values list.

## Done Criteria

- Only the desired onboarding/setup screens are reachable from the onboarding start, in the correct order.
- Church screen uses a type-ahead dropdown for church selection (with a “not found” fallback).
- Core Values default list is expanded and curated.

## Progress

- 2026-01-13: Rewired onboarding into a “meeting flow” subset; updated progress steps; added church type-ahead dropdown + expanded default core values list.

## Verification

- `cursor` lints: no errors on touched files (Cursor diagnostics).

## Outcomes

- Onboarding now follows the meeting flow subset:
  - `explainer-video` → `permissions` → `core-values` → `core-categories` → `sub-categories` → `daily-rhythm` → `goals` → `my-church` → `home`
- “My Church” now uses a type-ahead dropdown fed by a starter list, with a manual entry fallback.
- Default Core Values list expanded to a curated set (still supports custom adds/removals).

## Follow-ups

- Replace starter church dataset with the purchased Barna (or other) national dataset and wire to remote updates.

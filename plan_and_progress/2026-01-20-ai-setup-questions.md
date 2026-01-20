# AI Setup Questions Onboarding Expansion

- Status: In Progress
- Owner: Cole Zerman
- Started: 2026-01-20
- Completed: -

## Objective

Expand onboarding with AI-personality signals while keeping the current 12-screen flow intact, adding new screens or making minor edits to existing ones.

## Plan

1. Audit current onboarding screens and data persistence for reuse.
2. Add AI setup questions screens and data model fields (store + Supabase meta).
3. Integrate navigation updates and verify persistence.

## Done Criteria

- New AI setup questions captured and stored in profile preferences.
- Existing onboarding screens remain intact and functional.
- Navigation completes onboarding without regressions.

## Progress

- 2026-01-20: Added AI setup questions data model, sync, and setup flow routing.
- 2026-01-20: Updated core values taxonomy defaults, locked presets, and category guidance.
- 2026-01-20: Refined core values explainer UI and added quick add examples.
- 2026-01-20: Improved core values visuals and seeded health/finances categories.

## Verification

- Commands run (lint/typecheck/build) and results
- Manual QA steps as needed

## Outcomes

- What changed (links to PRs/commits)
- Impact/tradeoffs

## Follow-ups

- Define AI behavior mapping based on captured signals.

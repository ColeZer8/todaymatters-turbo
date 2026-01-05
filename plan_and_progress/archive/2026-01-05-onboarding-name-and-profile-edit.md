# Onboarding Name + Profile Name Editing

- Status: Completed
- Owner: colezerman
- Started: 2026-01-05
- Completed: 2026-01-05

## Objective

Capture a user’s name during onboarding (mid-flow), allow editing it in Profile, and ensure Home greets using the user’s first name.

## Plan

1. Add `fullName` to shared user/onboarding state and sync to Supabase `tm.profiles.full_name`.
2. Insert a new onboarding step to collect the name in a polished, on-brand way.
3. Add profile editing for the name and make Home update instantly.

## Done Criteria

- Onboarding includes a Name step (not last) and step numbers remain correct.
- Profile screen allows editing the name.
- Home greeting uses the user’s first name and updates immediately after edits.
- Typecheck + lint pass for mobile.

## Progress

- 2026-01-05: Implemented shared `fullName` state + onboarding insertion and connected Profile/Home.

## Verification

- `pnpm --filter mobile check-types` (pass)
- `pnpm --filter mobile lint` (pass)
- Manual: set name in onboarding → see it on Home; edit name in Profile → Home updates.

## Outcomes

- Added onboarding Name step (inserted after Setup Questions) and updated step numbering.
- Added shared `fullName` state (persisted) and synced to Supabase `tm.profiles.full_name`.
- Profile can edit name; Home greeting uses the user’s first name and updates immediately.

## Follow-ups

- Later: auto-fill name from auth/email and potentially remove/skip this step.



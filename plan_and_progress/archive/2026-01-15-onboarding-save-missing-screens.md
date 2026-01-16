# Onboarding Save Coverage

- Status: Completed
- Owner: codex
- Started: 2026-01-15
- Completed: 2026-01-15

## Objective

Ensure all visible onboarding screens persist to Supabase and the schema supports new fields.

## Plan

1. Inventory onboarding screens and save paths
2. Add missing schema fields (additive)
3. Wire missing save calls to Supabase

## Done Criteria

- All visible onboarding screens save to Supabase
- Schema includes fields for every saved value

## Progress

- 2026-01-15: Audited visible onboarding screens and wired missing save paths; added profile columns to migration

## Verification

- Commands run: read_lints (no issues)
- Manual QA: -

## Outcomes

- What changed: Added profile columns + wired save hooks for explainer video, core values/categories, values scores, goal whys, my church, and onboarding completion
- Impact/tradeoffs: Adds JSON fields to tm.profiles for onboarding data

## Follow-ups

- Apply migration to Supabase to add new columns

# Location Samples Migration Review

## Objective

Review and refine the Supabase migration for location samples + hourly aggregation so it supports planned-vs-actual comparisons.

## Plan

1. Inspect the current migration and identify correctness/performance/RLS issues.
2. Update the migration SQL to align with Supabase/PostGIS best practices.
3. Summarize changes and note follow-ups/testing.

## Done Criteria

- Migration creates required tables, indexes, policies, and view without errors.
- RLS aligns with expected user access.
- Hourly aggregation supports planned vs actual comparisons.

## Progress

- 2026-01-12: Reviewed migration and updated schema checks, policies, view join, and grants.

## Verification

- Not run (SQL migration not applied locally).

## Outcomes

- Tightened constraints for coordinates and metrics, added user_places update/delete policies, and added grants.
- Improved hourly view to return a stable place_id alongside label/category.

## Follow-ups

- Apply migration in Supabase and validate view performance with sample data.

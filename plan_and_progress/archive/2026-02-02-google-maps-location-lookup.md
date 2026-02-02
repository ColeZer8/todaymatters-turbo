# Google Maps location lookup

- Status: Completed
- Owner: Cole
- Started: 2026-02-02
- Completed: 2026-02-02

## Objective

Enable Google Maps/Places lookups so coordinate-based location data resolves to human-readable places.

## Plan

1. Confirm current Google Places/Maps integration points.
2. Document local env setup for API keys.
3. Update example env file for the new key(s).

## Done Criteria

- Local env setup documented for mobile + edge function lookups.
- Example env file includes the Google Places API key variable.

## Progress

- 2026-02-02: Located integration points; documented env setup; updated `.env.example`.

## Verification

- Not run (docs-only changes).

## Outcomes

- Added Google Places API key variable to `apps/mobile/.env.example`.

## Follow-ups

- Set `GOOGLE_MAPS_API_KEY` as a Supabase secret for non-local usage.

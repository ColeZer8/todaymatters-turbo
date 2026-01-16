# Actual Calendar Phone Intelligence

- Status: In Progress
- Owner: Cole
- Started: 2026-01-15
- Completed: -

## Objective

Make the “Actual” calendar populate intelligently from phone data (location, screen time, health), allow Review Time to refine/assign categories (with AI support), and persist final actual blocks to `tm.events` with `type="calendar_actual"`.

## Plan

1. Audit current actual-calendar pipeline and Review Time UI constraints.
2. Implement data ingestion pipelines for Screen Time + Health into Supabase.
3. Add place labeling flow for work/gym/home to improve verification.
4. Add AI analysis flow for Review Time (suggestions + natural language input).
5. Persist reviewed actual blocks to `tm.events` with `calendar_actual`.

## Done Criteria

- Actual column shows Supabase-backed `calendar_actual` events plus verified data.
- Screen Time + Health data ingested to Supabase on-device.
- Review Time supports AI-assisted categorization + free-text input.
- Place labeling supports “work” and “gym” verification.
- Reviewed assignments save as `calendar_actual` events.

## Progress

- 2026-01-15: Started implementation; reviewing device insights sync + Review Time wiring.
- 2026-01-15: Added device insights sync (Screen Time/Health), Review Time AI + notes, place labeling, and evidence-to-actual persistence.

## Verification

- TBD (device manual QA + Supabase queries)

## Outcomes

- TBD

## Follow-ups

- Optimize evidence weighting + personalization logic.

# Communications page powered by real Gmail data

- Status: Completed
- Owner: Cole
- Started: 2026-01-12
- Completed: 2026-01-12

## Objective

Turn the existing “Pending actions → Communications” experience into a real, data-backed page by loading Gmail email events from Supabase (keeping the existing UI styling). Preserve the current styling patterns for other channels (Slack/SMS/Outlook) for later.

## Plan

1. Identify the Supabase source of Gmail emails and its fields.
2. Add a small Supabase service to query Gmail email events.
3. Refactor `/communication` page to fetch Gmail and pass data into `CommunicationTemplate` (presentational).
4. Update Home “Pending Actions” tile to show real unread Gmail count + a short sender preview.

## Done Criteria

- `/communication` renders real Gmail emails (from Supabase) with existing styling.
- Home “Pending Actions” → “Communications” count/preview reflects real Gmail unread state.
- `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` pass.

## Progress

- 2026-01-12: Implemented `public.events` Gmail email fetch, passed real data into `/communication`, and updated Home “Pending Actions” copy/count to reflect unread Gmail.

## Verification

- `pnpm --filter mobile check-types` (pass)
- `pnpm --filter mobile lint` (pass)

## Outcomes

- Communications UI now renders real Gmail email events from Supabase (instead of mock data).
- Home “Pending Actions” now reflects real unread Gmail count and shows a sender preview string.

## Follow-ups

- Wire Slack/SMS/Outlook ingestion into the same comms page once those data sources are available.

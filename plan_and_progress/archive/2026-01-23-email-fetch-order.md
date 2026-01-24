# Email Fetch Order Investigation

- Status: Completed
- Owner: Codex
- Started: 2026-01-23
- Completed: 2026-01-23

## Objective

Determine how the app fetches emails, whether sorting/filters can surface years-old items out of order, and identify likely causes or fixes.

## Plan

1. Locate email ingestion/fetch flows in the mobile app and shared packages.
2. Review query parameters, sorting, pagination, and any date normalization.
3. Summarize likely cause and propose next steps or fixes.

## Done Criteria

- Email fetch/query paths identified with ordering rules documented.
- Likely cause of out-of-order old emails explained or a gap identified.
- Next steps suggested (code change, backend check, or logging).

## Progress

- 2026-01-23: Found Gmail fetch logic in mobile app; ordering uses tm.events.created_at.
- 2026-01-23: Identified UI displays created_at as the email time; backend ingestion not in repo.

## Verification

- Not run (investigation only).

## Outcomes

- Gmail emails are fetched from tm.events ordered by created_at desc and displayed using created_at timestamps.
- If backend backfills older Gmail messages, created_at reflects ingestion time, which surfaces old emails as “new” and can appear out of order.

## Follow-ups

- Confirm Gmail payload meta fields and consider ordering by the email's original date (e.g., meta.raw.internalDate) or store a dedicated email_date column.
- Add a stable secondary sort (e.g., created_at desc, id desc) if created_at ties are common.

# Client Update — 2026-01-27

## Executive Summary

- Hardened the “actuals” pipeline to rely only on real evidence (screen time + location + health) and removed predictive noise.
- Built out a sturdier location pipeline so background tracking, syncing, and labeling behave consistently across devices.
- Prepared production build metadata bump to version 4 (iOS build number + Android version code).

## Highlights

- Refined event filtering and overlap logic to eliminate false positives in the actual timeline.
- Preserved user edits while keeping derived evidence blocks accurate and stable.
- Reworked location evidence to prioritize real places, avoid coordinate/geo‑hash noise, and keep the day timeline clean.

## Location & Evidence Work (Flowery But Accurate)

- Orchestrated a background‑first location capture flow with adaptive sync that respects movement state while still delivering steady, reliable samples.
- Introduced robust queueing + sanitization for samples so each location point is clean, deduped, and sync‑safe before it ever touches Supabase.
- Added a diagnostics trail (task heartbeat, pending queue visibility, and error logging) to make device‑specific issues provable and debuggable.
- Tightened the evidence‑to‑event pipeline so real places become actual events, and “Unknown” replaces raw coordinates when place labels are missing.
- Strengthened the reliability of hourly location blocks and evidence fusion, so actuals feel like a faithful story of the day rather than a guess.

## Work Log (Git)

- feat: Refactor event filtering and enhance actual display logic
- feat: Refactor event overlap handling and improve batch deletion for calendar events
- feat: US-009 - Implement adaptive sync intervals based on movement state
- feat: Refactor event handling to incorporate core values and subcategories
- Spacing changes

## Ready for Production

- Build numbers bumped to 4 (iOS build number + Android version code).

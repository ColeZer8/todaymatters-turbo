# Android Background Location Reliability

- Status: In Progress
- Owner: GPT-5.2-Codex
- Started: 2026-01-28
- Completed: -

## Objective

Diagnose why Android background location samples stop when the app is not active and ensure the background agent is reliably scheduled.

## Plan

1. Review current Android background location implementation and config.
2. Validate task scheduling/foreground service requirements on Android.
3. Trace data pipeline from background sample to storage.
4. Identify gaps and implement fixes/tests.

## Done Criteria

- Background task is scheduled and runs when app is in background.
- Android config meets OS requirements (permissions, service, battery).
- Observed background samples recorded without the app open.

## Progress

- 2026-01-28: Added Android 13+ notification permission handling, battery optimization prompt, task heartbeat tracking, stale-task restarts, and richer diagnostics.

## Verification

- Not run yet.

## Outcomes

- Background task diagnostics now include notifications + task heartbeat metadata.
- Android 13+ notification permission is required for foreground service reliability.

## Follow-ups

- Pending.

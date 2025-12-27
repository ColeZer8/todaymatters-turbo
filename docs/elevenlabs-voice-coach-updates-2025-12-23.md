# ElevenLabs Voice Coach — Updates (2025-12-23)

This document captures the changes made to restore ElevenLabs Voice Coach reliability (Option A: `.env`-only) and remove the visible Home “flash” when toggling the voice session.

## Context

Symptoms reported:
- Home screen flashes/white flicker when tapping the greeting to start/stop voice.
- Agent no longer runs (connect attempt → immediate disconnect).

## Root cause(s)

### 1) Token endpoint `source` validation (causing 422)
Our diagnostic “public token preflight” call was sending a custom `source=` query parameter.
ElevenLabs appears to validate `source` against a fixed allowlist in some environments, so the custom value triggered a **422**, which made the situation look like the agent/token flow was broken.

### 2) SDK internal token exchange fragility
Even for public agents, the SDK internally performs a token exchange (`agentId` → `conversationToken`) before starting the LiveKit/WebRTC session.
When this step becomes unreliable (or fails without a clear surfaced error), the session can bounce between `connecting` → `disconnected`.

## Changes made

### A) Make public token fetch “known-good” + add explicit token start fallback

**File:** `apps/mobile/src/hooks/use-voice-coach.ts`

- **Changed diagnostics to use an allowlisted source**
  - Before: `source=todaymatters_debug&version=dev`
  - After: `source=react_native_sdk`
- **Added a public token fetch helper**
  - Calls `GET /v1/convai/conversation/token?agent_id=...&source=react_native_sdk`
  - Parses JSON response `{ token: string }`
- **Start logic updated**
  - First try: `startSession({ conversationToken })` when token is available
  - Fallback: `startSession({ agentId })` if token fetch fails or returns an unexpected body

**Why this helps**
- Removes false negatives from the diagnostics (no more 422 due to unrecognized `source`).
- Avoids relying on the SDK’s internal token exchange as a single point of failure.

**New logs to watch**
- `[VoiceCoach] Public token fetch { ok, status, hasToken, ... }`

### B) Isolate voice hook updates so Home UI doesn’t rerender/flash

**File:** `apps/mobile/src/app/home.tsx`

- Moved the `useVoiceCoach()` hook into a tiny `VoiceCoachController` component that renders `null`.
- The controller only updates a ref (`voiceApiRef`) used by the stable greeting tap handler.

**Why this helps**
- Voice `status` changes no longer force `HomeTemplate` (and its subtree) to rerender, which is a common cause of the “white flash” during rapid connect/disconnect state changes.

## Files touched

- `apps/mobile/src/hooks/use-voice-coach.ts`
- `apps/mobile/src/app/home.tsx`
- `plan_and_progress/elevenlabs-voice-coach-fix.md` (implementation log)

## Verification

Commands:
- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅ (warnings only, no errors)

Manual QA:
- Tap greeting to start:
  - Expect `[VoiceCoach] Public token fetch ... hasToken: true` (ideal) and `Status: connected`
- Tap greeting to stop:
  - Expect transition to `disconnecting` then `disconnected`
- Observe UI:
  - Home should no longer flash/white flicker on voice status changes

## If it still disconnects

Paste these logs:
- `[VoiceCoach] Public token fetch ...`
- `[VoiceCoach] Status: ...` sequence
- Any `[VoiceCoach] Error: ...`

Interpretation:
- **401/403 on token fetch**: ElevenLabs is not issuing public tokens → Option A cannot work; switch to server-minted `conversationToken` (Option B).
- **Token fetch OK but still disconnects**: likely LiveKit/WebRTC connect failure; we’ll narrow it with the error logs.



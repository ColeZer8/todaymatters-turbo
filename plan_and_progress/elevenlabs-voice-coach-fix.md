# ElevenLabs Voice Coach — Fix flicker + restore agent connection

- Status: In Progress
- Owner: Cole + Cursor agent
- Started: 2025-12-23
- Completed: -

## Objective

Restore reliable ElevenLabs voice coach start/stop from the Home greeting tap, while eliminating visible Home “flash/flicker” during status changes.

## Plan

1. Capture the current failure mode from logs and confirm where rerenders are coming from.
2. Make the voice session start path robust (token fetch + SDK startSession) and improve diagnostics.
3. Isolate voice state updates from the Home template render tree to eliminate flicker.

## Done Criteria

- Home greeting tap starts a session and the agent remains connected (no instant disconnect).
- Home greeting tap stops a session reliably (no stuck connecting/disconnecting).
- No visible white flash when toggling.
- `pnpm --filter mobile lint` and `pnpm --filter mobile check-types` pass.

## Progress

- 2025-12-23: Observed `422` from ElevenLabs token endpoint diagnostics, followed by `Status: connecting` → `Getting conversation token` → `Status: disconnected`.
- 2025-12-23: Updated the token diagnostics to use an allowlisted `source=react_native_sdk` and added a fallback that fetches the public `{ token }` and passes it as `conversationToken` to `startSession` (avoids SDK-internal token exchange issues).
- 2025-12-23: Moved the voice hook into a tiny controller component so Home’s main template doesn’t rerender on voice status changes (removes flash).

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅ (warnings only, no errors)

## Outcomes

- (pending)

## Follow-ups

- If ElevenLabs public token issuance changes, confirm whether server-side token minting (Supabase Edge Function) should be reinstated.

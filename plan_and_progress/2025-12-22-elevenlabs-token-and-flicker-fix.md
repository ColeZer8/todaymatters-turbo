### Objective

Fix ElevenLabs voice agent start/stop from the Home greeting so it is reliable and smooth:

- No disconnect loops when starting sessions
- No white flicker on tap
- Clear diagnostics when token generation fails

### Scope

- `apps/mobile/src/hooks/use-voice-coach.ts`: session start/stop + token flow + logging
- `supabase/functions/conversation-token/index.ts`: allow client-provided `agent_id` (safe) so server config is simpler
- `apps/mobile/src/app/_layout.tsx` + `apps/mobile/src/app/home.tsx`: provider placement to avoid full-app rerenders/flicker

### Done Criteria

- Tapping “Good evening, Paul.” starts a session within ~1–2 seconds and the agent speaks
- Tapping again stops the session reliably (even while connecting / disconnecting)
- No full-screen white flash on start/stop
- If token fetch fails, logs show the exact Supabase invoke error and server response context

### Status

In Progress

### Notes / Findings

- `@elevenlabs/react-native` (v0.5.5) will fetch a conversation token when `startSession({ agentId })` is used.
  This fails for private agents unless an authenticated token exchange is performed server-side.
- We moved `ElevenLabsProvider` off the app root and into the Home screen to avoid whole-app rerenders when voice status changes.

### Verification

- `pnpm --filter mobile check-types` (run after changes)

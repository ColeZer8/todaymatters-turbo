# ElevenLabs Voice Coach — Current Debugging Notes (Option A: .env-only)

## Context / Goal

We want the ElevenLabs voice coach to be:
- **Invisible** UI (no ElevenLabs button/modal visible)
- **Toggled only** by tapping the Home greeting text (e.g. “Good evening, Paul.”)
- **No navigation coupling** (agent should never navigate away from Home)
- **Smooth**: no white flicker, no stuck states, start/stop reliably

We are currently prioritizing **Option A**:
- **No Supabase / no server token minting**
- Use `.env` (`EXPO_PUBLIC_ELEVENLABS_AGENT_ID=...`)
- Must work in-app on device/dev-build


## Current Implementation Snapshot (High-Level)

### Entry point: Home greeting tap
- `apps/mobile/src/components/molecules/Greeting.tsx`
  - Wraps greeting text in `Pressable` hitbox (invisible)
  - Tapping triggers `onPressGreeting`

- `apps/mobile/src/app/home.tsx`
  - Provides `onPressGreeting`
  - Uses a stable handler (refs) to avoid recreating callbacks and causing rerenders
  - Ends session on unmount (so mic isn’t left running invisibly)
  - Wraps **only Home** in `ElevenLabsProvider` (dev builds only) to reduce whole-app rerenders

### Voice orchestration hook
- `apps/mobile/src/hooks/use-voice-coach.ts`
  - Wraps `useConversation()` from `@elevenlabs/react-native`
  - Implements `startConversation()` and `endConversation()`
  - Disables navigation client tools (`navigate_to_screen`, etc.)
  - Uses SDK status (`conversation.status`) as the source of truth
  - Adds dev logging for status changes and preflight diagnostics


## What We Observed (Symptoms)

### 1) “Mic not working” (initial)
- App could hear agent speak but user mic input wasn’t captured reliably.
- Permission handling and audio session setup were suspected.

### 2) “Unwanted navigation / onboarding resets”
- Starting voice sometimes coincided with routing resets (landing back on onboarding).
- We disabled navigation tools in the agent integration and added guards.
- We also fixed a regression where onboarding completion was set on Home mount (incorrect).

### 3) “White flicker” on tap
- A white flash/repaint occurred when tapping the greeting to start/stop voice.
- This correlated with **full-tree rerenders** when the voice provider status changed.

### 4) “Glitchy / can’t stop / race conditions”
- Errors like `UnexpectedConnectionState: PC manager is closed` appeared during start/stop.
- Taps sometimes wouldn’t stop the session (status stuck in `connecting`/`disconnecting`).

### 5) Agent stops working completely (disconnected loop)
Logs show:
- `[VoiceCoach] Starting session...`
- `INFO Getting conversation token for agentId: agent_...`
- `[VoiceCoach] Disconnected`

This indicates the RN SDK is trying to fetch a conversation token and then disconnecting quickly.


## Root Causes Identified (So Far)

### A) SDK token exchange behavior (critical for Option A)
From the `@elevenlabs/react-native` SDK code:
- Calling `startSession({ agentId })` triggers:
  - `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...`
  - **without** an API key header (`xi-api-key`)
- Therefore, `.env-only` **works only if** ElevenLabs allows unauthenticated token issuance for that agent ID (i.e. the agent is truly public/token-enabled).

If token issuance is rejected by ElevenLabs, the SDK falls back to `disconnected` quickly.

### B) LiveKit / WebRTC teardown races
LiveKit can throw errors during teardown (e.g. “PC manager is closed”), typically when:
- stop is called twice
- stop is called during connect teardown
- connect/disconnect happens quickly due to upstream failure

Mitigations implemented:
- Use SDK status directly
- Treat `disconnecting` as stoppable
- In-flight guards to prevent overlap

### C) Provider placement causing app-wide rerenders (white flicker)
When `ElevenLabsProvider` wrapped the entire app, any voice status change caused:
- provider state updates → rerender large subtree → visible flash

Mitigation implemented:
- Remove provider from `apps/mobile/src/app/_layout.tsx`
- Wrap **only** Home screen with provider (`apps/mobile/src/app/home.tsx`)

### D) Supabase Edge Function not deployed (re: Option B)
When token-minting via Supabase was attempted:
- `404 NOT_FOUND "Requested function was not found"`
Meaning:
- `conversation-token` edge function was not deployed to the configured Supabase project.

We are **not** pursuing this right now (Option B later).


## Major Code Changes / Decisions (Timeline-ish)

### 1) Remove visible ElevenLabs UI
- Removed `VoiceCoachOverlay` from `_layout.tsx` to hide call button/modal.
- Replaced activation with invisible greeting hitbox.

### 2) Enforce no navigation from agent
- Navigation client tools return “Navigation is currently disabled.”

### 3) Onboarding logic separation (regression fix)
- Removed `setHasCompletedOnboarding(true)` from `home.tsx` mount
- Set onboarding completion only at the end of onboarding (`ideal-day.tsx`)

### 4) Smooth start/stop
- Added toggle locking and tap debouncing (adjusted after being too strict)
- Allowed stop during `connecting`
- Handled SDK status `disconnecting`

### 5) Use SDK status as source of truth
- Removed duplicated local status state in `use-voice-coach.ts`
- Exposed `status` as SDK status (and `error` when `errorMessage` exists)

### 6) Option A-only mode
- Removed Supabase token flow from `use-voice-coach.ts`
- Always starts with `startSession({ agentId })`
- Added **diagnostic preflight** for public token endpoint in dev builds:
  - logs `ok/status/body`


## Current Known Blockers

### 1) Instant disconnect after “Getting conversation token for agentId…”
This can be caused by either:
- **Token issuance failure** (agent isn’t actually public-token enabled, or agent permissions changed)
- **LiveKit connect failure** after token issuance (network/WebRTC/audio session)

We added logs to disambiguate:
- `onStatusChange` logs
- `Public token preflight` logs (status + body)

### 2) White flicker still present
Most likely caused by one of:
- still-large rerenders on Home when voice status changes
- connect/disconnect loop repainting Home quickly
- other state changes tied to tap flow (less likely after ref stabilization)

Provider is already isolated to Home; next is to confirm the voice state is not causing HomeTemplate to re-layout.


## What We Need Next (Action Items)

### Option A (NO SUPABASE) — Required
1) Confirm the public token endpoint returns 200 for this agent:
   - Look for logs: `[VoiceCoach] Public token preflight`
   - If it returns 401/403/404, the agent is not usable in `.env-only` mode.

2) If token preflight is OK but disconnect still happens:
   - Capture logs for:
     - `[VoiceCoach] Status: ...`
     - `[VoiceCoach] Error: ...`
     - `LiveKit error: ...` (SDK prints this)
   - That points to WebRTC / LiveKit / device audio session issues.

### Option B (Later) — Private agent with server token
When ready:
- Deploy edge function: `conversation-token`
- Set Supabase secrets:
  - `ELEVENLABS_API_KEY`
  - (optional) `ELEVENLABS_AGENT_ID`
- Switch to `startSession({ conversationToken })`


## Key Log Strings to Watch

- `[VoiceCoach] Public token preflight { ok, status, body }`
- `[VoiceCoach] Status: connecting|connected|disconnecting|disconnected`
- `INFO Getting conversation token for agentId: ...` (SDK)
- `LiveKit error: ...` (SDK)


## Summary (Plain English)

- For `.env-only` testing (Option A), the SDK must be able to obtain a conversation token **without** an API key using the agentId.
- If the agentId flow disconnects instantly, either:
  - ElevenLabs is rejecting token issuance for that agent ID, or
  - the LiveKit connection fails immediately after token issuance.
- We’ve removed Supabase dependencies for now, isolated the provider to Home to reduce flicker, and added diagnostics to identify the exact failure.



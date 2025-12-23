# ElevenLabs Realtime Agent (Expo / React Native)

- Status: In Progress
- Owner: Cole
- Started: 2025-12-22
- Completed: -

## Objective

Enable ElevenLabs Conversational AI **realtime agent** in the mobile app (Expo dev build), using secure server-side token generation and client-side realtime audio sessions.

## Plan

1. Confirm ElevenLabs RN SDK requirements and how sessions authenticate (agentId vs conversationToken vs signedUrl).
2. Re-enable/repair Supabase Edge Functions used for auth + tools + webhooks.
3. Re-enable ElevenLabsProvider wiring in `apps/mobile/src/app/_layout.tsx`.
4. Mount a small page-layer overlay for the voice coach UI so we can test quickly.
5. Verify TypeScript + ESLint.

## Done Criteria

- Voice coach can start a realtime session (WebRTC) in a dev build.
- Private agent mode works via `conversation-token` without exposing ElevenLabs API keys in the app.
- Session can end cleanly and reconnect.
- Lint + typecheck pass.

## Progress

- 2025-12-22: Found ElevenLabs SDK already installed; discovered server + provider + UI were intentionally disabled. Implementing re-enable + wiring.

## Verification

- `pnpm lint`
- `pnpm check-types`

## Outcomes

- TBD

## Follow-ups

- Tighten server tool security headers + signature verification in ElevenLabs dashboard config.
- Confirm production strategy (public agent vs private agent) and update `.env` + Supabase secrets accordingly.
- Production hardening:
  - Move runtime config out of local `.env` and into EAS build env/secrets.
  - Keep mobile `.env` limited to **public values only** (e.g. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
  - Never ship Supabase `SERVICE_ROLE_KEY` or ElevenLabs `API_KEY` in the mobile app (server-only).



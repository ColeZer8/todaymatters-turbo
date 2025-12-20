# ElevenLabs Voice Agent Integration

**Status:** In Progress
**Created:** 2025-12-04
**Last Updated:** 2025-12-04

## Objective

Integrate ElevenLabs Conversational AI to provide voice-based coaching interactions in the TodayMatters app.

## Scope

- Install ElevenLabs React Native SDK and dependencies
- Configure app permissions for microphone access (iOS & Android)
- Create reusable voice conversation hook
- Build voice coach UI components
- Set up Supabase Edge Functions for:
  - Token generation (secure API key handling)
  - Post-call webhook handling (conversation logging)
  - Server-side tool calls (database queries)
- Create database schema for storing conversation data

## Done Criteria

- [x] Dependencies installed (`@elevenlabs/react-native`, LiveKit, WebRTC)
- [x] `app.json` updated with permissions and plugins
- [x] `ElevenLabsProvider` added to app layout
- [x] `useVoiceCoach` hook created with full feature set
- [x] `VoiceCoachButton` component created (floating action button)
- [x] `VoiceCoachModal` component created (full-screen conversation UI)
- [x] Supabase Edge Function: `conversation-token`
- [x] Supabase Edge Function: `elevenlabs-webhook`
- [x] Supabase Edge Function: `agent-tools`
- [x] Database migration for `coach_conversations` table
- [x] Documentation updated
- [ ] Environment variables configured
- [ ] ElevenLabs agent created and configured
- [ ] Supabase Edge Functions deployed
- [ ] Tested on physical device

## Current Status

**Implementation Complete - Awaiting Configuration**

All code has been written and compiles successfully. The following manual steps remain:

### 1. ElevenLabs Setup Required

1. Create account at [elevenlabs.io](https://elevenlabs.io)
2. Navigate to Conversational AI section
3. Create a new agent with your coaching persona
4. Note down:
   - Agent ID
   - API Key (from settings)

### 2. Environment Variables

Add to your mobile `.env`:
```bash
EXPO_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id
EXPO_PUBLIC_ELEVENLABS_PRIVATE_AGENT=false  # or true for private agents
```

Add to Supabase secrets:
```bash
supabase secrets set ELEVENLABS_API_KEY=xi_your_api_key
supabase secrets set ELEVENLABS_AGENT_ID=your_agent_id
supabase secrets set ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret
```

### 3. Deploy Supabase Functions

```bash
supabase functions deploy conversation-token
supabase functions deploy elevenlabs-webhook
supabase functions deploy agent-tools
```

### 4. Run Database Migration

```bash
supabase db push
```

### 5. Run Expo Prebuild

WebRTC requires native code:
```bash
cd apps/mobile
npx expo prebuild
```

### 6. Configure Webhooks in ElevenLabs

In your agent settings, add webhook URL:
`https://your-project.supabase.co/functions/v1/elevenlabs-webhook`

## Verification Commands

```bash
# Check TypeScript compilation
pnpm --filter mobile exec tsc --noEmit

# Build iOS (requires prebuild first)
pnpm --filter mobile ios

# Build Android (requires prebuild first)
pnpm --filter mobile android
```

## Files Created/Modified

### New Files
- `apps/mobile/src/lib/elevenlabs/config.ts`
- `apps/mobile/src/lib/elevenlabs/types.ts`
- `apps/mobile/src/lib/elevenlabs/permissions.ts`
- `apps/mobile/src/lib/elevenlabs/index.ts`
- `apps/mobile/src/hooks/use-voice-coach.ts`
- `apps/mobile/src/components/organisms/VoiceCoachButton.tsx`
- `apps/mobile/src/components/organisms/VoiceCoachModal.tsx`
- `supabase/functions/conversation-token/index.ts`
- `supabase/functions/elevenlabs-webhook/index.ts`
- `supabase/functions/agent-tools/index.ts`
- `supabase/migrations/20241204_create_coach_conversations.sql`
- `supabase/config.toml`
- `docs/elevenlabs-voice-agent-integration.md`

### Modified Files
- `apps/mobile/app.json` - Added permissions and plugins
- `apps/mobile/src/app/_layout.tsx` - Added ElevenLabsProvider
- `apps/mobile/src/hooks/index.ts` - Exported useVoiceCoach
- `apps/mobile/src/components/organisms/index.ts` - Exported components

## Follow-ups

1. Create ElevenLabs agent with TodayMatters coaching persona
2. Configure agent tools in ElevenLabs dashboard
3. Test voice conversations on physical devices
4. Add haptic feedback for voice interactions
5. Implement conversation history screen
6. Add push notifications for scheduled coaching sessions









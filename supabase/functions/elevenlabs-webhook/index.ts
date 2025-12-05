/**
 * Supabase Edge Function: elevenlabs-webhook
 *
 * Receives webhook events from ElevenLabs Conversational AI.
 * Handles post-call transcription data and stores it for analytics.
 *
 * Webhook types:
 * - post_call_transcription: Full conversation data after a call ends
 * - transcript: Real-time transcript updates (if enabled)
 * - audio: Audio chunks (if enabled)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, elevenlabs-signature',
};

interface TranscriptMessage {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs: number;
  tool_calls?: unknown;
  tool_results?: unknown;
  feedback?: unknown;
  conversation_turn_metrics?: unknown;
}

interface PostCallTranscriptionPayload {
  type: 'post_call_transcription';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    transcript: TranscriptMessage[];
    metadata: {
      start_time_unix_secs: number;
      call_duration_secs: number;
      cost: number;
      deletion_settings?: unknown;
      feedback?: {
        overall_score: number | null;
        likes: number;
        dislikes: number;
      };
      authorization_method: string;
      charging?: unknown;
      termination_reason: string;
    };
    analysis?: {
      evaluation_criteria_results?: unknown;
      data_collection_results?: unknown;
      call_successful: string;
      transcript_summary: string;
    };
    conversation_initiation_client_data?: {
      conversation_config_override?: unknown;
      custom_llm_extra_body?: unknown;
      dynamic_variables?: Record<string, unknown>;
    };
  };
}

/**
 * Verify the webhook signature (optional but recommended for production)
 */
async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    // Skip verification if not configured
    return true;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Verify signature if webhook secret is configured
    const webhookSecret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');
    const signature = req.headers.get('elevenlabs-signature');

    if (webhookSecret) {
      const isValid = await verifySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Received webhook event:', payload.type);

    // Create Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different event types
    switch (payload.type) {
      case 'post_call_transcription': {
        const data = payload as PostCallTranscriptionPayload;
        await handlePostCallTranscription(supabase, data);
        break;
      }

      case 'transcript': {
        // Real-time transcript updates (if needed)
        console.log('Transcript update received');
        break;
      }

      case 'call_initiation_failure': {
        console.error('Call initiation failed:', payload);
        break;
      }

      default:
        console.log('Unhandled webhook event type:', payload.type);
    }

    return new Response(
      JSON.stringify({ status: 'ok' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle post-call transcription data
 * Stores the conversation for analytics and history
 */
async function handlePostCallTranscription(
  supabase: ReturnType<typeof createClient>,
  payload: PostCallTranscriptionPayload
) {
  const { data } = payload;

  // Extract user_id from dynamic variables (if passed during conversation start)
  const userId = data.conversation_initiation_client_data?.dynamic_variables?.user_id as string | undefined;

  // Prepare the conversation record
  const conversationRecord = {
    conversation_id: data.conversation_id,
    agent_id: data.agent_id,
    user_id: userId || null,
    status: data.status,
    transcript: data.transcript,
    summary: data.analysis?.transcript_summary || null,
    call_successful: data.analysis?.call_successful === 'success',
    duration_secs: data.metadata.call_duration_secs,
    cost_credits: data.metadata.cost,
    started_at: new Date(data.metadata.start_time_unix_secs * 1000).toISOString(),
    ended_at: new Date(payload.event_timestamp * 1000).toISOString(),
    termination_reason: data.metadata.termination_reason || null,
    feedback_likes: data.metadata.feedback?.likes || 0,
    feedback_dislikes: data.metadata.feedback?.dislikes || 0,
    dynamic_variables: data.conversation_initiation_client_data?.dynamic_variables || null,
    raw_data: data, // Store full payload for debugging
  };

  console.log('Storing conversation:', data.conversation_id);

  // Insert into coach_conversations table
  // Note: You'll need to create this table in your Supabase database
  const { error } = await supabase
    .from('coach_conversations')
    .upsert(conversationRecord, { onConflict: 'conversation_id' });

  if (error) {
    console.error('Error storing conversation:', error);
    // Don't throw - we don't want to fail the webhook
  } else {
    console.log('Conversation stored successfully');
  }

  // Optionally: Update user analytics/stats
  if (userId) {
    // You could update a user_stats table here with conversation counts, etc.
    console.log('Updating stats for user:', userId);
  }
}


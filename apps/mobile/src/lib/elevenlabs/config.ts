/**
 * ElevenLabs Configuration
 *
 * Environment variables for ElevenLabs integration.
 * The AGENT_ID can be public (for public agents) but the API_KEY
 * must NEVER be exposed client-side - it's only used in Supabase Edge Functions.
 */

export const ELEVENLABS_CONFIG = {
  /**
   * Your ElevenLabs Agent ID - this can be exposed client-side for public agents.
   * For private agents, we use conversation tokens instead.
   */
  agentId: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID ?? '',

  /**
   * Whether the agent is private (requires token) or public (can use agentId directly)
   */
  isPrivateAgent: process.env.EXPO_PUBLIC_ELEVENLABS_PRIVATE_AGENT === 'true',
} as const;

/**
 * Validate that required environment variables are set
 */
export function validateElevenLabsConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!ELEVENLABS_CONFIG.agentId) {
    missing.push('EXPO_PUBLIC_ELEVENLABS_AGENT_ID');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}



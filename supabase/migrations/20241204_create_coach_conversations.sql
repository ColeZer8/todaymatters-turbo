-- Create coach_conversations table for storing ElevenLabs conversation data
-- This receives data from the elevenlabs-webhook edge function

CREATE TABLE IF NOT EXISTS public.coach_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'done',
    transcript JSONB,
    summary TEXT,
    call_successful BOOLEAN DEFAULT true,
    duration_secs INTEGER,
    cost_credits INTEGER,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    termination_reason TEXT,
    feedback_likes INTEGER DEFAULT 0,
    feedback_dislikes INTEGER DEFAULT 0,
    dynamic_variables JSONB,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user_id ON public.coach_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_started_at ON public.coach_conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_agent_id ON public.coach_conversations(agent_id);

-- Enable RLS
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own conversations
CREATE POLICY "Users can view own conversations"
    ON public.coach_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert/update (for webhook)
CREATE POLICY "Service role can manage conversations"
    ON public.coach_conversations
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create conversation_insights table for storing AI-generated insights
CREATE TABLE IF NOT EXISTS public.conversation_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    conversation_id TEXT REFERENCES public.coach_conversations(conversation_id) ON DELETE CASCADE,
    insight TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_conversation_insights_user_id ON public.conversation_insights(user_id);

-- Enable RLS
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

-- Users can view their own insights
CREATE POLICY "Users can view own insights"
    ON public.conversation_insights
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert (for agent tools)
CREATE POLICY "Service role can manage insights"
    ON public.conversation_insights
    FOR ALL
    USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_coach_conversations_updated_at
    BEFORE UPDATE ON public.coach_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.coach_conversations TO authenticated;
GRANT SELECT ON public.conversation_insights TO authenticated;



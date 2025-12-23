/**
 * Supabase Edge Function: agent-tools
 *
 * Handles server-side tool calls from ElevenLabs Conversational AI agent.
 * The agent can call this endpoint to fetch data, update records, etc.
 *
 * Tools available:
 * - get_user_routine: Fetch the user's current routine status
 * - get_todays_tasks: Get today's tasks and their completion status
 * - mark_task_complete: Mark a specific task as complete
 * - get_user_goals: Get the user's goals and progress
 * - log_conversation_insight: Log an insight from the conversation
 *
 * SECURITY:
 * - If `ELEVENLABS_TOOL_SECRET` is set, requests must include `Authorization: Bearer <secret>`.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ToolRequest {
  tool_name: string;
  parameters: Record<string, unknown>;
  user_id?: string;
  conversation_id?: string;
}

interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
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
    const expectedSecret = Deno.env.get('ELEVENLABS_TOOL_SECRET');
    if (expectedSecret) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const expectedHeader = `Bearer ${expectedSecret}`;
      if (authHeader !== expectedHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body: ToolRequest = await req.json();
    const { tool_name, parameters, user_id } = body;

    console.log('Tool call received:', tool_name, parameters);

    // Create Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result: ToolResponse;

    // Route to the appropriate tool handler
    switch (tool_name) {
      case 'get_user_routine':
        result = await getUserRoutine(supabase, user_id);
        break;

      case 'get_todays_tasks':
        result = await getTodaysTasks(supabase, user_id);
        break;

      case 'mark_task_complete':
        result = await markTaskComplete(
          supabase,
          user_id,
          parameters.task_id as string
        );
        break;

      case 'get_user_goals':
        result = await getUserGoals(supabase, user_id);
        break;

      case 'log_conversation_insight':
        result = await logConversationInsight(
          supabase,
          user_id,
          parameters.insight as string,
          parameters.category as string
        );
        break;

      case 'get_weather':
        result = await getWeather(parameters.location as string);
        break;

      default:
        result = {
          success: false,
          error: `Unknown tool: ${tool_name}`,
        };
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Tool execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get user's routine configuration and current status
 */
async function getUserRoutine(
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<ToolResponse> {
  if (!userId) {
    return { success: false, error: 'User ID required' };
  }

  try {
    // Fetch from your routine tables
    // Adjust table/column names to match your schema
    const { data, error } = await supabase
      .from('user_routines')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      success: true,
      data: data || {
        message: 'No routine configured yet',
        has_routine: false,
      },
    };
  } catch (error) {
    console.error('Error fetching routine:', error);
    return {
      success: true,
      data: {
        message: 'Could not fetch routine data',
        has_routine: false,
      },
    };
  }
}

/**
 * Get today's tasks with completion status
 */
async function getTodaysTasks(
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<ToolResponse> {
  if (!userId) {
    return { success: false, error: 'User ID required' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch from your tasks table
    // Adjust table/column names to match your schema
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today);

    if (error) {
      throw error;
    }

    const tasks = data || [];
    const completed = tasks.filter((t: { completed: boolean }) => t.completed).length;

    return {
      success: true,
      data: {
        tasks,
        total: tasks.length,
        completed,
        remaining: tasks.length - completed,
        progress_percent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      },
    };
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return {
      success: true,
      data: {
        tasks: [],
        total: 0,
        completed: 0,
        remaining: 0,
        progress_percent: 0,
        message: 'Could not fetch task data',
      },
    };
  }
}

/**
 * Mark a specific task as complete
 */
async function markTaskComplete(
  supabase: ReturnType<typeof createClient>,
  userId?: string,
  taskId?: string
): Promise<ToolResponse> {
  if (!userId || !taskId) {
    return { success: false, error: 'User ID and task ID required' };
  }

  try {
    const { error } = await supabase
      .from('daily_tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: {
        message: 'Task marked as complete',
        task_id: taskId,
      },
    };
  } catch (error) {
    console.error('Error marking task complete:', error);
    return {
      success: false,
      error: 'Could not mark task as complete',
    };
  }
}

/**
 * Get user's goals and progress
 */
async function getUserGoals(
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<ToolResponse> {
  if (!userId) {
    return { success: false, error: 'User ID required' };
  }

  try {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return {
      success: true,
      data: {
        goals: data || [],
        count: data?.length || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching goals:', error);
    return {
      success: true,
      data: {
        goals: [],
        count: 0,
        message: 'Could not fetch goals data',
      },
    };
  }
}

/**
 * Log an insight from the conversation for future reference
 */
async function logConversationInsight(
  supabase: ReturnType<typeof createClient>,
  userId?: string,
  insight?: string,
  category?: string
): Promise<ToolResponse> {
  if (!userId || !insight) {
    return { success: false, error: 'User ID and insight required' };
  }

  try {
    const { error } = await supabase.from('conversation_insights').insert({
      user_id: userId,
      insight,
      category: category || 'general',
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: {
        message: 'Insight logged successfully',
      },
    };
  } catch (error) {
    console.error('Error logging insight:', error);
    return {
      success: true,
      data: {
        message: 'Insight noted but could not be persisted',
      },
    };
  }
}

/**
 * Get weather information (example external API call)
 */
async function getWeather(location?: string): Promise<ToolResponse> {
  if (!location) {
    return { success: false, error: 'Location required' };
  }

  // This is a placeholder - you would integrate with a real weather API
  // For example: OpenWeatherMap, WeatherAPI, etc.
  return {
    success: true,
    data: {
      location,
      message: 'Weather API not configured yet',
      // You would return actual weather data here
    },
  };
}


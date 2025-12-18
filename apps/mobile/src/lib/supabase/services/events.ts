import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * Event data structure matching tm.events table
 */
export interface EventData {
  id?: string;
  user_id: string;
  type: string; // 'goal' for goals and initiatives
  title: string;
  meta?: Record<string, any> | null; // JSONB for additional data
  created_at?: string;
  updated_at?: string;
}

/**
 * Goal-specific metadata structure
 */
export interface GoalMeta {
  category: 'goal' | 'initiative';
  color?: string;
  progress?: number; // 0-1
  tasks?: Array<{
    id: string;
    name: string;
    done: boolean;
    createdAt: string;
  }>;
  milestones?: Array<{
    id: string;
    name: string;
    completed: boolean;
    dueDate: string | null;
    createdAt: string;
  }>;
  description?: string;
  dueDate?: string | null;
  teamSize?: number;
  createdAt?: string;
  completedAt?: string | null;
}

/**
 * Fetch all goals for a user
 */
export async function fetchGoals(userId: string): Promise<EventData[]> {
  try {
    console.log('📥 Fetching goals for user:', userId);
    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'goal')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching goals:', error);
      throw handleSupabaseError(error);
    }

    // Filter to only goals (not initiatives) by checking meta.category
    const goals = (data || []).filter((event) => {
      const meta = event.meta as GoalMeta | null;
      return !meta || meta.category === 'goal';
    });

    console.log('✅ Fetched goals:', goals.length);
    return goals as EventData[];
  } catch (error) {
    console.error('❌ Failed to fetch goals:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Fetch all initiatives for a user
 */
export async function fetchInitiatives(userId: string): Promise<EventData[]> {
  try {
    console.log('📥 Fetching initiatives for user:', userId);
    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'goal')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching initiatives:', error);
      throw handleSupabaseError(error);
    }

    // Filter to only initiatives by checking meta.category
    const initiatives = (data || []).filter((event) => {
      const meta = event.meta as GoalMeta | null;
      return meta && meta.category === 'initiative';
    });

    console.log('✅ Fetched initiatives:', initiatives.length);
    return initiatives as EventData[];
  } catch (error) {
    console.error('❌ Failed to fetch initiatives:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Create a goal event
 */
export async function createGoal(
  userId: string,
  title: string,
  meta?: Partial<GoalMeta>
): Promise<EventData> {
  try {
    console.log('➕ Creating goal:', title, 'for user:', userId);
    
    const goalMeta: GoalMeta = {
      category: 'goal',
      ...meta,
    };

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .insert({
        user_id: userId,
        type: 'goal',
        title: title.trim(),
        meta: goalMeta,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating goal:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Goal created successfully:', data.id);
    return data as EventData;
  } catch (error) {
    console.error('❌ Failed to create goal:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Create an initiative event
 */
export async function createInitiative(
  userId: string,
  title: string,
  description?: string,
  meta?: Partial<GoalMeta>
): Promise<EventData> {
  try {
    console.log('➕ Creating initiative:', title, 'for user:', userId);
    
    const initiativeMeta: GoalMeta = {
      category: 'initiative',
      description: description?.trim() || '',
      ...meta,
    };

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .insert({
        user_id: userId,
        type: 'goal',
        title: title.trim(),
        meta: initiativeMeta,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating initiative:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Initiative created successfully:', data.id);
    return data as EventData;
  } catch (error) {
    console.error('❌ Failed to create initiative:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Update an event (goal or initiative)
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<Pick<EventData, 'title' | 'meta'>>
): Promise<EventData> {
  try {
    console.log('💾 Updating event:', eventId, 'Updates:', Object.keys(updates));
    
    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating event:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Event updated successfully');
    return data as EventData;
  } catch (error) {
    console.error('❌ Failed to update event:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Delete an event (goal or initiative)
 */
export async function deleteEvent(eventId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting event:', eventId);
    
    const { error } = await supabase
      .schema('tm')
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('❌ Error deleting event:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Event deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete event:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Bulk create goals from simple string array (from onboarding)
 */
export async function bulkCreateGoals(
  userId: string,
  goalTitles: string[]
): Promise<EventData[]> {
  try {
    console.log('📦 Bulk creating goals:', goalTitles.length, 'for user:', userId);
    
    const goalsToInsert = goalTitles
      .filter((title) => title.trim())
      .map((title, index) => ({
        user_id: userId,
        type: 'goal' as const,
        title: title.trim(),
        meta: {
          category: 'goal' as const,
          createdAt: new Date().toISOString(),
        } as GoalMeta,
      }));

    if (goalsToInsert.length === 0) {
      console.log('⚠️ No valid goals to create');
      return [];
    }

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .insert(goalsToInsert)
      .select();

    if (error) {
      console.error('❌ Error bulk creating goals:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Bulk created goals:', data?.length || 0);
    return (data || []) as EventData[];
  } catch (error) {
    console.error('❌ Failed to bulk create goals:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Bulk create initiatives from simple string array (from onboarding)
 */
export async function bulkCreateInitiatives(
  userId: string,
  initiativeTitles: string[]
): Promise<EventData[]> {
  try {
    console.log('📦 Bulk creating initiatives:', initiativeTitles.length, 'for user:', userId);
    
    const initiativesToInsert = initiativeTitles
      .filter((title) => title.trim())
      .map((title) => ({
        user_id: userId,
        type: 'goal' as const,
        title: title.trim(),
        meta: {
          category: 'initiative' as const,
          description: '',
          createdAt: new Date().toISOString(),
        } as GoalMeta,
      }));

    if (initiativesToInsert.length === 0) {
      console.log('⚠️ No valid initiatives to create');
      return [];
    }

    const { data, error } = await supabase
      .schema('tm')
      .from('events')
      .insert(initiativesToInsert)
      .select();

    if (error) {
      console.error('❌ Error bulk creating initiatives:', error);
      throw handleSupabaseError(error);
    }

    console.log('✅ Bulk created initiatives:', data?.length || 0);
    return (data || []) as EventData[];
  } catch (error) {
    console.error('❌ Failed to bulk create initiatives:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

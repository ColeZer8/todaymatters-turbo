import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';

export interface RoutineItemInput {
  title: string;
  minutes: number;
  iconKey: string | null;
}

export interface RoutineSnapshot {
  wakeTime: string | null;
  items: RoutineItemInput[];
}

export async function fetchRoutine(userId: string, kind: string = 'morning'): Promise<RoutineSnapshot | null> {
  try {
    const { data: routine, error: routineError } = await supabase
      .schema('tm')
      .from('routines')
      .select('id, wake_time')
      .eq('user_id', userId)
      .eq('kind', kind)
      .maybeSingle();

    if (routineError) {
      throw handleSupabaseError(routineError);
    }

    if (!routine) return null;

    const { data: items, error: itemsError } = await supabase
      .schema('tm')
      .from('routine_items')
      .select('title, minutes, icon_key, position')
      .eq('user_id', userId)
      .eq('routine_id', routine.id)
      .order('position', { ascending: true });

    if (itemsError) {
      throw handleSupabaseError(itemsError);
    }

    const wakeTime = (routine.wake_time as string | null) ?? null;

    return {
      wakeTime,
      items: (items ?? []).map((row) => ({
        title: String(row.title),
        minutes: Number(row.minutes),
        iconKey: (row.icon_key as string | null) ?? null,
      })),
    };
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

export async function saveRoutine(
  userId: string,
  snapshot: RoutineSnapshot,
  kind: string = 'morning'
): Promise<void> {
  try {
    const { data: routine, error: upsertError } = await supabase
      .schema('tm')
      .from('routines')
      .upsert(
        {
          user_id: userId,
          kind,
          wake_time: snapshot.wakeTime,
        },
        { onConflict: 'user_id,kind' }
      )
      .select('id')
      .single();

    if (upsertError) {
      throw handleSupabaseError(upsertError);
    }

    const routineId = routine.id as string;

    // Replace items (simple + deterministic)
    const { error: deleteError } = await supabase
      .schema('tm')
      .from('routine_items')
      .delete()
      .eq('routine_id', routineId)
      .eq('user_id', userId);

    if (deleteError) {
      throw handleSupabaseError(deleteError);
    }

    if (snapshot.items.length === 0) return;

    const toInsert = snapshot.items.map((item, index) => ({
      routine_id: routineId,
      user_id: userId,
      position: index,
      title: item.title.trim(),
      minutes: Math.max(1, Math.floor(item.minutes)),
      icon_key: item.iconKey,
    }));

    const { error: insertError } = await supabase.schema('tm').from('routine_items').insert(toInsert);
    if (insertError) {
      throw handleSupabaseError(insertError);
    }
  } catch (error) {
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}


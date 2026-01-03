import { supabase } from '../client';
import { ensureProfileExists } from './profiles';
import { handleSupabaseError } from '../utils/error-handler';

/**
 * Fetch all profile values for the current user
 * Returns values sorted by rank (order matters)
 */
export async function fetchProfileValues(userId: string): Promise<string[]> {
  try {
    console.log('📥 Fetching profile values for user:', userId);
    const { data, error } = await supabase
      .schema('tm')
      .from('profile_values')
      .select('value_label, rank')
      .eq('user_id', userId)
      .order('rank', { ascending: true });

    if (error) {
      console.error('❌ Error fetching profile values:', error);
      throw handleSupabaseError(error);
    }

    const values = (data || []).map((item) => item.value_label);
    console.log('✅ Fetched profile values:', values.length > 0 ? values : '(none found)');
    return values;
  } catch (error) {
    console.error('❌ Failed to fetch profile values:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Save all profile values for a user
 * This replaces all existing values with the new set
 */
export async function saveProfileValues(userId: string, values: string[]): Promise<void> {
  try {
    console.log('💾 Saving profile values for user:', userId, 'Values:', values);
    
    // Ensure profile exists first (required for foreign key constraint)
    await ensureProfileExists(userId);
    
    // First, delete all existing values for this user
    const { error: deleteError } = await supabase
      .schema('tm')
      .from('profile_values')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Error deleting existing profile values:', deleteError);
      throw handleSupabaseError(deleteError);
    }

    // If no values to save, we're done
    if (values.length === 0) {
      console.log('✅ No values to save (cleared all)');
      return;
    }

    // Insert new values with rank = array index
    const valuesToInsert = values.map((valueLabel, index) => ({
      user_id: userId,
      value_label: valueLabel.trim(),
      rank: index,
    }));

    const { data, error: insertError } = await supabase
      .schema('tm')
      .from('profile_values')
      .insert(valuesToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error inserting profile values:', insertError);
      throw handleSupabaseError(insertError);
    }

    console.log('✅ Successfully saved', data?.length || 0, 'profile values');
  } catch (error) {
    console.error('❌ Failed to save profile values:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Add a single profile value
 */
export async function addProfileValue(userId: string, valueLabel: string): Promise<void> {
  try {
    console.log('➕ Adding profile value:', valueLabel, 'for user:', userId);
    
    // Ensure profile exists first (required for foreign key constraint)
    await ensureProfileExists(userId);
    
    // Get current values to determine next rank
    const { data: existing, error: fetchError } = await supabase
      .schema('tm')
      .from('profile_values')
      .select('rank')
      .eq('user_id', userId)
      .order('rank', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching current values for rank:', fetchError);
      throw handleSupabaseError(fetchError);
    }

    const nextRank = existing && existing.length > 0 ? (existing[0].rank ?? -1) + 1 : 0;
    console.log('📊 Next rank:', nextRank);

    const { data, error: insertError } = await supabase
      .schema('tm')
      .from('profile_values')
      .insert({
        user_id: userId,
        value_label: valueLabel.trim(),
        rank: nextRank,
      })
      .select();

    if (insertError) {
      console.error('❌ Error adding profile value:', insertError);
      throw handleSupabaseError(insertError);
    }

    console.log('✅ Successfully added profile value:', data?.[0]?.value_label);
  } catch (error) {
    console.error('❌ Failed to add profile value:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Remove a single profile value by label
 * Note: This removes by label, not ID, since the UI works with labels
 */
export async function removeProfileValue(userId: string, valueLabel: string): Promise<void> {
  try {
    const { error } = await supabase
      .schema('tm')
      .from('profile_values')
      .delete()
      .eq('user_id', userId)
      .eq('value_label', valueLabel);

    if (error) {
      console.error('Error removing profile value:', error);
      throw handleSupabaseError(error);
    }

    // After deletion, re-rank remaining values to maintain order
    await reorderProfileValues(userId);
  } catch (error) {
    console.error('Failed to remove profile value:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}

/**
 * Reorder profile values after a deletion
 * Ensures ranks are sequential starting from 0
 */
async function reorderProfileValues(userId: string): Promise<void> {
  try {
    const { data: values, error: fetchError } = await supabase
      .schema('tm')
      .from('profile_values')
      .select('id, value_label')
      .eq('user_id', userId)
      .order('rank', { ascending: true });

    if (fetchError) {
      console.error('Error fetching values for reorder:', fetchError);
      throw handleSupabaseError(fetchError);
    }

    if (!values || values.length === 0) {
      return;
    }

    // Update each value with new sequential rank
    const updates = values.map((value, index) =>
      supabase
        .schema('tm')
        .from('profile_values')
        .update({ rank: index })
        .eq('id', value.id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      console.error('Error reordering profile values:', errors);
      throw handleSupabaseError(errors[0].error);
    }
  } catch (error) {
    console.error('Failed to reorder profile values:', error);
    throw error instanceof Error ? error : handleSupabaseError(error);
  }
}
